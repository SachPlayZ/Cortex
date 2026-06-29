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

export type CasperSigner = {
  keyPath: string;
};

export class CasperContractCaller {
  private readonly rpcClient: InstanceType<CasperSdk["RpcClient"]>;
  private readonly paymentMotes: number;

  constructor(private readonly config: CasperCallConfig) {
    this.rpcClient = new casperSdk.RpcClient(new casperSdk.HttpHandler(config.rpcUrl, "fetch"));
    this.paymentMotes = config.paymentMotes ?? 2_500_000_000;
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
        return;
      } catch (error) {
        lastError = error;
        await sleep(5_000);
      }
    }
    throw new Error(`Timed out waiting for Casper transaction ${transactionHash}: ${readError(lastError)}`);
  }
}

export class CasperLifecycleClient {
  private readonly caller: CasperContractCaller;

  constructor(config: CasperCallConfig) {
    this.caller = new CasperContractCaller(config);
  }

  async registerAgent(agentPublicKeyHex: string, admin: CasperSigner): Promise<string> {
    return this.caller.call(
      admin,
      "register_agent",
      casperSdk.Args.fromMap({ agent: publicKeyAddressArg(agentPublicKeyHex) })
    );
  }

  async registerSettlementRelayer(relayerPublicKeyHex: string, admin: CasperSigner): Promise<string> {
    return this.caller.call(
      admin,
      "register_settlement_relayer",
      casperSdk.Args.fromMap({ relayer: publicKeyAddressArg(relayerPublicKeyHex) })
    );
  }

  async createInvoice(invoice: ReceivableView, seller: CasperSigner): Promise<string> {
    return this.caller.call(
      seller,
      "create_invoice",
      casperSdk.Args.fromMap({
        invoice_id: hashArg(invoice.id),
        invoice_hash: hashArg(invoice.invoiceHash),
        evidence_hash: hashArg(`evidence:${invoice.id}`),
        buyer_hash: hashArg(`buyer:${invoice.id}`),
        original_currency_hash: hashArg(invoice.originalCurrency ?? "USD"),
        invoice_amount_usd_cents: u256Arg(invoice.usdAmountCents ?? invoice.repaymentAmountUsdCents),
        due_timestamp: u64Arg(dateToUnixSeconds(invoice.dueDate ?? new Date().toISOString().slice(0, 10)))
      })
    );
  }

  async postRiskScore(invoice: ReceivableView, agent: CasperSigner): Promise<string> {
    return this.caller.call(
      agent,
      "post_risk_score",
      casperSdk.Args.fromMap({
        invoice_id: hashArg(invoice.id),
        risk_score: casperSdk.CLValue.newCLUint8(invoice.riskScore ?? 0),
        risk_tier: casperSdk.CLValue.newCLUint8(riskTierToContractValue(invoice.riskTier)),
        discount_bps: casperSdk.CLValue.newCLUInt32(invoice.discountBps ?? 0),
        advance_rate_bps: casperSdk.CLValue.newCLUInt32(10_000 - (invoice.discountBps ?? 0)),
        advance_amount_usd_cents: u256Arg(invoice.advanceAmountUsdCents ?? "0"),
        repayment_amount_usd_cents: u256Arg(invoice.repaymentAmountUsdCents),
        attestation_hash: hashArg(invoice.attestationHash ?? `attestation:${invoice.id}`)
      })
    );
  }

  async listInvoice(invoiceId: string, seller: CasperSigner): Promise<string> {
    return this.caller.call(seller, "list_invoice", casperSdk.Args.fromMap({ invoice_id: hashArg(invoiceId) }));
  }

  async fundInvoice(invoice: ReceivableView, investor: CasperSigner): Promise<string> {
    return this.caller.call(
      investor,
      "fund_invoice",
      casperSdk.Args.fromMap({
        invoice_id: hashArg(invoice.id),
        funded_amount_usd_cents: u256Arg(invoice.advanceAmountUsdCents ?? "0")
      })
    );
  }

  async cashOutAdvance(invoiceId: string, seller: CasperSigner): Promise<string> {
    return this.caller.call(seller, "cash_out_advance", casperSdk.Args.fromMap({ invoice_id: hashArg(invoiceId) }));
  }

  async claimRepayment(invoiceId: string, investor: CasperSigner): Promise<string> {
    return this.caller.call(investor, "claim_repayment", casperSdk.Args.fromMap({ invoice_id: hashArg(invoiceId) }));
  }

  async waitForTransaction(transactionHash: string, timeoutMs?: number): Promise<void> {
    await this.caller.waitForTransaction(transactionHash, timeoutMs);
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
  const publicKey = casperSdk.PublicKey.fromHex(publicKeyHex);
  const key = casperSdk.Key.createByType(publicKey.accountHash().toPrefixedString(), casperSdk.KeyTypeID.Account);
  return casperSdk.CLValue.newCLKey(key);
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
