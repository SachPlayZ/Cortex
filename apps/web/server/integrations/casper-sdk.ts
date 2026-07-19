import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import type { ReceivableView } from "../../lib/finance";
import { sha256Hex } from "@cortex/shared";

type CasperSdk = typeof import("casper-js-sdk");
const require = createRequire(import.meta.url);
export const casperSdk = require("casper-js-sdk") as CasperSdk;

export type CasperCallConfig = {
  rpcUrl: string;
  chainName: string;
  packageHash: string;
  paymentMotes?: number | undefined;
};

export type CasperLifecycleConfig = {
  rpcUrl: string;
  chainName: string;
  registryPackageHash: string;
  fundingVaultPackageHash: string;
  repaymentEscrowPackageHash: string;
  agentReputationPackageHash: string;
  paymentMotes?: number | undefined;
};

export type CasperSigner = {
  keyPath: string;
};

export type CasperPreparedTransaction = {
  entryPoint: string;
  transaction: ReturnType<InstanceType<CasperSdk["Transaction"]>["toJSON"]>;
  transactionHash: string;
};

export type CasperTransactionReceipt = {
  rawJSON: unknown;
};

export class CasperContractCaller {
  private readonly rpcClient: InstanceType<CasperSdk["RpcClient"]>;
  private readonly paymentMotes: number;

  constructor(private readonly config: CasperCallConfig) {
    this.rpcClient = new casperSdk.RpcClient(new casperSdk.HttpHandler(config.rpcUrl, "fetch"));
    this.paymentMotes = config.paymentMotes ?? 2_500_000_000;
  }

  prepare(
    publicKeyHex: string,
    entryPoint: string,
    args: InstanceType<CasperSdk["Args"]>,
    paymentMotes = this.paymentMotes
  ): CasperPreparedTransaction {
    const transaction = new casperSdk.ContractCallBuilder()
      .byPackageHash(stripHashPrefix(this.config.packageHash))
      .entryPoint(entryPoint)
      .from(publicKeyFromHex(publicKeyHex))
      .chainName(this.config.chainName)
      .payment(paymentMotes)
      .runtimeArgs(args)
      .build();
    const payload = transaction.toJSON() as { hash: string };
    return {
      entryPoint,
      transaction: payload,
      transactionHash: payload.hash
    };
  }

  async call(
    signer: CasperSigner,
    entryPoint: string,
    args: InstanceType<CasperSdk["Args"]>,
    paymentMotes = this.paymentMotes
  ): Promise<string> {
    const key = await loadSecp256k1PrivateKey(signer.keyPath);
    const transaction = new casperSdk.ContractCallBuilder()
      .byPackageHash(stripHashPrefix(this.config.packageHash))
      .entryPoint(entryPoint)
      .from(key.publicKey)
      .chainName(this.config.chainName)
      .payment(paymentMotes)
      .runtimeArgs(args)
      .build();
    transaction.sign(key);
    const result = await this.rpcClient.putTransaction(transaction);
    return result.transactionHash.toHex();
  }

  async waitForTransaction(transactionHash: string, timeoutMs = 120_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let lastError: unknown;
    while (Date.now() < deadline) {
      try {
        const result = await this.rpcClient.getTransactionByTransactionHash(stripHashPrefix(transactionHash));
        const raw = result.rawJSON as
          | {
              execution_info?: {
                execution_result?: {
                  error_message?: string | null;
                  Version2?: { error_message?: string | null };
                };
              };
            }
          | undefined;
        const executionResult = raw?.execution_info?.execution_result;
        const errorMessage = executionResult?.error_message ?? executionResult?.Version2?.error_message;
        if (errorMessage) {
          throw new Error(errorMessage);
        }
        if (!executionResult) {
          await sleep(5_000);
          continue;
        }
        return;
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : "unknown error";
        if (!/not found|No such|NoSuch/i.test(message)) throw error;
        await sleep(5_000);
      }
    }
    throw new Error(`Timed out waiting for Casper transaction ${transactionHash}: ${readError(lastError)}`);
  }

  async getTransactionReceipt(transactionHash: string): Promise<CasperTransactionReceipt> {
    const result = await this.rpcClient.getTransactionByTransactionHash(stripHashPrefix(transactionHash));
    return { rawJSON: result.rawJSON };
  }
}

export class CasperLifecycleClient {
  private readonly registry: CasperContractCaller;
  private readonly vault: CasperContractCaller;
  private readonly escrow: CasperContractCaller;
  private readonly reputation: CasperContractCaller;

  constructor(
    config: CasperLifecycleConfig,
    callers: Partial<{
      registry: CasperContractCaller;
      vault: CasperContractCaller;
      escrow: CasperContractCaller;
      reputation: CasperContractCaller;
    }> = {}
  ) {
    const shared = {
      rpcUrl: config.rpcUrl,
      chainName: config.chainName,
      paymentMotes: config.paymentMotes
    };
    this.registry = callers.registry ?? new CasperContractCaller({
      ...shared,
      packageHash: config.registryPackageHash
    });
    this.vault = callers.vault ?? new CasperContractCaller({
      ...shared,
      packageHash: config.fundingVaultPackageHash
    });
    this.escrow = callers.escrow ?? new CasperContractCaller({
      ...shared,
      packageHash: config.repaymentEscrowPackageHash
    });
    this.reputation = callers.reputation ?? new CasperContractCaller({
      ...shared,
      packageHash: config.agentReputationPackageHash
    });
  }

  async registerRegistryAgent(agentPublicKeyHex: string, admin: CasperSigner): Promise<string> {
    return this.registry.call(
      admin,
      "register_agent",
      casperSdk.Args.fromMap({ agent: publicKeyAddressArg(agentPublicKeyHex) })
    );
  }

  async registerReputationAgent(agentPublicKeyHex: string, admin: CasperSigner): Promise<string> {
    return this.reputation.call(
      admin,
      "register_agent",
      casperSdk.Args.fromMap({ agent: publicKeyAddressArg(agentPublicKeyHex) })
    );
  }

  async registerRegistrySettlementRelayer(relayerPublicKeyHex: string, admin: CasperSigner): Promise<string> {
    return this.registry.call(
      admin,
      "register_settlement_relayer",
      casperSdk.Args.fromMap({ relayer: publicKeyAddressArg(relayerPublicKeyHex) })
    );
  }

  async registerEscrowSettlementRelayer(relayerPublicKeyHex: string, admin: CasperSigner): Promise<string> {
    return this.escrow.call(
      admin,
      "register_settlement_relayer",
      casperSdk.Args.fromMap({ relayer: publicKeyAddressArg(relayerPublicKeyHex) })
    );
  }

  async createInvoice(invoice: ReceivableView, seller: CasperSigner): Promise<string> {
    return this.registry.call(
      seller,
      "create_invoice",
      createInvoiceArgs(invoice)
    );
  }

  async postRiskScore(invoice: ReceivableView, agent: CasperSigner): Promise<string> {
    return this.registry.call(
      agent,
      "post_risk_score",
      postRiskScoreArgs(invoice)
    );
  }

  async noteInvoiceScored(agentPublicKeyHex: string, admin: CasperSigner): Promise<string> {
    return this.reputation.call(
      admin,
      "note_invoice_scored",
      casperSdk.Args.fromMap({ agent: publicKeyAddressArg(agentPublicKeyHex) })
    );
  }

  async listInvoice(invoiceId: string, seller: CasperSigner): Promise<string> {
    return this.registry.call(seller, "list_invoice", casperSdk.Args.fromMap({ invoice_id: hashArg(invoiceId) }));
  }

  async fundInvoice(invoice: ReceivableView, investor: CasperSigner): Promise<string> {
    return this.registry.call(
      investor,
      "fund_invoice",
      casperSdk.Args.fromMap({
        invoice_id: hashArg(invoice.id),
        funded_amount_usd_cents: u256Arg(invoice.advanceAmountUsdCents ?? "0")
      })
    );
  }

  async cashOutAdvance(invoiceId: string, seller: CasperSigner): Promise<string> {
    return this.registry.call(seller, "cash_out_advance", casperSdk.Args.fromMap({ invoice_id: hashArg(invoiceId) }));
  }

  async claimRepayment(invoiceId: string, investor: CasperSigner): Promise<string> {
    return this.registry.call(investor, "claim_repayment", casperSdk.Args.fromMap({ invoice_id: hashArg(invoiceId) }));
  }

  async depositVaultLiquidity(amountUsdCents: string, admin: CasperSigner): Promise<string> {
    return this.vault.call(
      admin,
      "deposit_liquidity",
      casperSdk.Args.fromMap({
        amount_usd_cents: u256Arg(amountUsdCents)
      })
    );
  }

  async armEscrowPosition(invoice: ReceivableView, investorPublicKeyHex: string, admin: CasperSigner): Promise<string> {
    return this.escrow.call(
      admin,
      "arm_position",
      casperSdk.Args.fromMap({
        invoice_id: hashArg(invoice.id),
        investor: publicKeyAddressArg(investorPublicKeyHex),
        expected_repayment_usd_cents: u256Arg(invoice.repaymentAmountUsdCents)
      })
    );
  }

  async recordGatewayRepayment(
    invoiceId: string,
    gatewayPaymentHash: string,
    webhookEventHash: string,
    paidAmountUsdCents: string,
    relayer: CasperSigner
  ): Promise<string> {
    return this.registry.call(
      relayer,
      "record_gateway_repayment",
      casperSdk.Args.fromMap({
        invoice_id: hashArg(invoiceId),
        gateway_payment_hash: hashArg(gatewayPaymentHash),
        webhook_event_hash: hashArg(webhookEventHash),
        paid_amount_usd_cents: u256Arg(paidAmountUsdCents)
      })
    );
  }

  async noteSuccessfulRepayment(agentPublicKeyHex: string, admin: CasperSigner): Promise<string> {
    return this.reputation.call(
      admin,
      "note_successful_repayment",
      casperSdk.Args.fromMap({ agent: publicKeyAddressArg(agentPublicKeyHex) })
    );
  }

  async noteDefault(agentPublicKeyHex: string, riskTier: string | undefined, admin: CasperSigner): Promise<string> {
    return this.reputation.call(
      admin,
      "note_default",
      casperSdk.Args.fromMap({
        agent: publicKeyAddressArg(agentPublicKeyHex),
        risk_tier: casperSdk.CLValue.newCLUint8(riskTierToContractValue(riskTier))
      })
    );
  }

  async waitForTransaction(transactionHash: string, timeoutMs?: number): Promise<void> {
    await this.registry.waitForTransaction(transactionHash, timeoutMs);
  }

  async getTransactionReceipt(transactionHash: string): Promise<CasperTransactionReceipt> {
    return this.registry.getTransactionReceipt(transactionHash);
  }

  prepareCreateInvoice(invoice: ReceivableView, sellerPublicKeyHex: string): CasperPreparedTransaction {
    return this.registry.prepare(sellerPublicKeyHex, "create_invoice", createInvoiceArgs(invoice));
  }

  prepareListInvoice(invoiceId: string, sellerPublicKeyHex: string): CasperPreparedTransaction {
    return this.registry.prepare(
      sellerPublicKeyHex,
      "list_invoice",
      casperSdk.Args.fromMap({ invoice_id: hashArg(invoiceId) })
    );
  }

  prepareFundInvoice(invoice: ReceivableView, investorPublicKeyHex: string): CasperPreparedTransaction {
    return this.registry.prepare(
      investorPublicKeyHex,
      "fund_invoice",
      casperSdk.Args.fromMap({
        invoice_id: hashArg(invoice.id),
        funded_amount_usd_cents: u256Arg(invoice.advanceAmountUsdCents ?? "0")
      })
    );
  }

  prepareCashOutAdvance(invoiceId: string, sellerPublicKeyHex: string): CasperPreparedTransaction {
    return this.registry.prepare(
      sellerPublicKeyHex,
      "cash_out_advance",
      casperSdk.Args.fromMap({ invoice_id: hashArg(invoiceId) })
    );
  }

  prepareClaimRepayment(invoiceId: string, investorPublicKeyHex: string): CasperPreparedTransaction {
    return this.registry.prepare(
      investorPublicKeyHex,
      "claim_repayment",
      casperSdk.Args.fromMap({ invoice_id: hashArg(invoiceId) })
    );
  }
}

export async function loadSecp256k1PrivateKey(path: string): Promise<ReturnType<CasperSdk["PrivateKey"]["fromPem"]>> {
  const pem = await readFile(path, "utf8");
  return casperSdk.PrivateKey.fromPem(pem, casperSdk.KeyAlgorithm.SECP256K1);
}

export async function readPublicKeyHex(path: string): Promise<string> {
  const key = await loadSecp256k1PrivateKey(path);
  return key.publicKey.toHex();
}

export function hashArg(value: string) {
  return casperSdk.CLValue.newCLByteArray(toHash32Bytes(value));
}

export function u256Arg(value: string) {
  return casperSdk.CLValue.newCLUInt256(value);
}

export function u64Arg(value: number) {
  return casperSdk.CLValue.newCLUint64(value.toString());
}

export function toHash32Bytes(value: string): Uint8Array {
  const normalized = stripHashPrefix(value);
  const hex = /^[a-fA-F0-9]{64}$/.test(normalized) ? normalized : sha256Hex(value).slice(2);
  return Uint8Array.from(Buffer.from(hex, "hex"));
}

export function stripHashPrefix(value: string): string {
  return value.startsWith("hash-") ? value.slice(5) : value.startsWith("0x") ? value.slice(2) : value;
}

function publicKeyAddressArg(publicKeyHex: string) {
  const publicKey = publicKeyFromHex(publicKeyHex);
  const key = casperSdk.Key.createByType(publicKey.accountHash().toPrefixedString(), casperSdk.KeyTypeID.Account);
  return casperSdk.CLValue.newCLKey(key);
}

function accountHashAddressArg(accountHash: string) {
  const key = casperSdk.Key.createByType(accountHash, casperSdk.KeyTypeID.Account);
  return casperSdk.CLValue.newCLKey(key);
}

function invoicePartyAddressArg(publicKeyHex: string | undefined, accountHash: string | undefined) {
  if (publicKeyHex) return publicKeyAddressArg(publicKeyHex);
  if (accountHash) return accountHashAddressArg(accountHash);
  throw new Error("Invoice party address is required");
}

function publicKeyFromHex(publicKeyHex: string) {
  return casperSdk.PublicKey.fromHex(publicKeyHex);
}

function createInvoiceArgs(invoice: ReceivableView) {
  return casperSdk.Args.fromMap({
    invoice_id: hashArg(invoice.id),
    invoice_hash: hashArg(invoice.invoiceHash),
    evidence_hash: hashArg(`evidence:${invoice.id}`),
    buyer_hash: hashArg(`buyer:${invoice.id}`),
    original_currency_hash: hashArg(invoice.originalCurrency ?? "USD"),
    invoice_amount_usd_cents: u256Arg(invoice.usdAmountCents ?? invoice.repaymentAmountUsdCents),
    due_timestamp: u64Arg(dateToUnixSeconds(invoice.dueDate ?? new Date().toISOString().slice(0, 10)))
  });
}

function postRiskScoreArgs(invoice: ReceivableView) {
  return casperSdk.Args.fromMap({
    invoice_id: hashArg(invoice.id),
    risk_score: casperSdk.CLValue.newCLUint8(invoice.riskScore ?? 0),
    risk_tier: casperSdk.CLValue.newCLUint8(riskTierToContractValue(invoice.riskTier)),
    discount_bps: casperSdk.CLValue.newCLUInt32(invoice.discountBps ?? 0),
    advance_rate_bps: casperSdk.CLValue.newCLUInt32(10_000 - (invoice.discountBps ?? 0)),
    advance_amount_usd_cents: u256Arg(invoice.advanceAmountUsdCents ?? "0"),
    repayment_amount_usd_cents: u256Arg(invoice.repaymentAmountUsdCents),
    attestation_hash: hashArg(invoice.attestationHash ?? `attestation:${invoice.id}`)
  });
}

function riskTierToContractValue(tier: string | undefined): number {
  switch (tier) {
    case "Low":
      return 1;
    case "MediumLow":
      return 2;
    case "Medium":
      return 3;
    case "Rejected":
      return 4;
    default:
      return 4;
  }
}

function dateToUnixSeconds(date: string): number {
  return Math.floor(new Date(`${date}T00:00:00.000Z`).getTime() / 1_000);
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
