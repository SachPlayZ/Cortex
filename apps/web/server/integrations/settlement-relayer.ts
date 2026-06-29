import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import type { InvoiceStatus } from "@cortex/shared";
import { type PaymentStore, type RelayerJobRecord } from "./payment-store";
import { toHash32Bytes, stripHashPrefix } from "./casper-sdk";

export type CasperInvoiceSnapshot = {
  invoiceId: string;
  status: InvoiceStatus;
  repaymentAmountUsdCents: string;
};

export type RecordGatewayRepaymentInput = {
  invoiceId: string;
  gatewayPaymentHash: `0x${string}`;
  paidAmountUsdCents: string;
  paymentAttestationHash: `0x${string}`;
};

export interface CasperSettlementClient {
  getInvoice(invoiceId: string): Promise<CasperInvoiceSnapshot>;
  recordGatewayRepayment(input: RecordGatewayRepaymentInput): Promise<{ deployHash: string }>;
}

export class MemoryCasperSettlementClient implements CasperSettlementClient {
  private readonly usedGatewayHashes = new Set<`0x${string}`>();
  private deployCounter = 0;

  constructor(private readonly store: PaymentStore) {}

  async getInvoice(invoiceId: string): Promise<CasperInvoiceSnapshot> {
    const invoice = await this.store.requireInvoice(invoiceId);
    return {
      invoiceId,
      status: invoice.statusCasper,
      repaymentAmountUsdCents: invoice.repaymentAmountUsdCents
    };
  }

  async recordGatewayRepayment(input: RecordGatewayRepaymentInput): Promise<{ deployHash: string }> {
    const invoice = await this.store.requireInvoice(input.invoiceId);
    if (invoice.statusCasper !== "RepaymentPending") {
      throw new Error(`Casper invoice not repayment pending: ${invoice.statusCasper}`);
    }
    if (BigInt(input.paidAmountUsdCents) < BigInt(invoice.repaymentAmountUsdCents)) {
      throw new Error("Casper rejected underpayment");
    }
    if (this.usedGatewayHashes.has(input.gatewayPaymentHash)) {
      throw new Error("Casper rejected duplicate gateway payment hash");
    }
    this.usedGatewayHashes.add(input.gatewayPaymentHash);
    this.deployCounter += 1;
    const deployHash = `casper-deploy-${this.deployCounter.toString().padStart(4, "0")}`;
    await this.store.updateInvoice(input.invoiceId, {
      statusCasper: "Repaid",
      lastRepaymentDeployHash: deployHash
    });
    return { deployHash };
  }
}

type CasperSdk = typeof import("casper-js-sdk");
const require = createRequire(import.meta.url);
const casperSdk = require("casper-js-sdk") as CasperSdk;

export type CasperSdkSettlementClientConfig = {
  rpcUrl: string;
  chainName: string;
  packageHash: string;
  relayerPrivateKeyPath: string;
  paymentMotes?: number | undefined;
};

export class CasperSdkSettlementClient implements CasperSettlementClient {
  private readonly rpcClient: InstanceType<CasperSdk["RpcClient"]>;
  private readonly paymentMotes: number;
  private relayerKey: ReturnType<CasperSdk["PrivateKey"]["fromPem"]> | undefined;

  constructor(
    private readonly store: PaymentStore,
    private readonly config: CasperSdkSettlementClientConfig
  ) {
    this.rpcClient = new casperSdk.RpcClient(new casperSdk.HttpHandler(config.rpcUrl, "fetch"));
    this.paymentMotes = config.paymentMotes ?? 2_500_000_000;
  }

  async getInvoice(invoiceId: string): Promise<CasperInvoiceSnapshot> {
    const invoice = await this.store.requireInvoice(invoiceId);
    return {
      invoiceId,
      status: invoice.statusCasper,
      repaymentAmountUsdCents: invoice.repaymentAmountUsdCents
    };
  }

  async recordGatewayRepayment(input: RecordGatewayRepaymentInput): Promise<{ deployHash: string }> {
    const invoice = await this.store.requireInvoice(input.invoiceId);
    if (invoice.statusCasper !== "RepaymentPending") {
      throw new Error(`Casper invoice not repayment pending: ${invoice.statusCasper}`);
    }
    if (BigInt(input.paidAmountUsdCents) < BigInt(invoice.repaymentAmountUsdCents)) {
      throw new Error("Casper rejected underpayment");
    }

    const relayerKey = await this.getRelayerKey();
    const transaction = new casperSdk.ContractCallBuilder()
      .byPackageHash(stripHashPrefix(this.config.packageHash))
      .entryPoint("record_gateway_repayment")
      .from(relayerKey.publicKey)
      .chainName(this.config.chainName)
      .payment(this.paymentMotes)
      .runtimeArgs(
        casperSdk.Args.fromMap({
          invoice_id: casperSdk.CLValue.newCLByteArray(toHash32Bytes(input.invoiceId)),
          gateway_payment_hash: casperSdk.CLValue.newCLByteArray(toHash32Bytes(input.gatewayPaymentHash)),
          webhook_event_hash: casperSdk.CLValue.newCLByteArray(toHash32Bytes(input.paymentAttestationHash)),
          paid_amount_usd_cents: casperSdk.CLValue.newCLUInt256(input.paidAmountUsdCents)
        })
      )
      .build();
    transaction.sign(relayerKey);

    const result = await this.rpcClient.putTransaction(transaction);
    const deployHash = result.transactionHash.toHex();
    await this.waitForTransaction(deployHash);
    await this.store.updateInvoice(input.invoiceId, {
      statusCasper: "Repaid",
      lastRepaymentDeployHash: deployHash
    });
    return { deployHash };
  }

  private async getRelayerKey(): Promise<ReturnType<CasperSdk["PrivateKey"]["fromPem"]>> {
    if (!this.relayerKey) {
      const pem = await readFile(this.config.relayerPrivateKeyPath, "utf8");
      this.relayerKey = casperSdk.PrivateKey.fromPem(pem, casperSdk.KeyAlgorithm.SECP256K1);
    }
    return this.relayerKey;
  }

  private async waitForTransaction(transactionHash: string, timeoutMs = 120_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    let lastError = "not found";
    while (Date.now() < deadline) {
      try {
        const result = await this.rpcClient.getTransactionByTransactionHash(transactionHash);
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
        if (errorMessage) throw new Error(errorMessage);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "unknown error";
        if (!/not found|No such|NoSuch/i.test(lastError)) throw error;
        await new Promise((resolve) => setTimeout(resolve, 5_000));
      }
    }
    throw new Error(`Timed out waiting for Casper transaction ${transactionHash}: ${lastError}`);
  }
}

export class SettlementRelayer {
  constructor(
    private readonly store: PaymentStore,
    private readonly casper: CasperSettlementClient
  ) {}

  async submit(job: RelayerJobRecord): Promise<RelayerJobRecord> {
    const existing = await this.store.getRelayerJobByGatewayHash(job.gatewayPaymentHash);
    const current = existing ?? (await this.store.upsertRelayerJob(job));
    if (current.status === "confirmed") {
      return current;
    }

    const nextAttempt = current.attempts + 1;
    await this.store.updateRelayerJob(current.gatewayPaymentHash, {
      attempts: nextAttempt,
      status: "submitted"
    });

    try {
      const { deployHash } = await this.casper.recordGatewayRepayment({
        invoiceId: current.invoiceId,
        gatewayPaymentHash: current.gatewayPaymentHash,
        paidAmountUsdCents: current.paidAmountUsdCents,
        paymentAttestationHash: current.paymentAttestationHash
      });
      await this.store.updateWebhook(current.webhookEventId, {
        casperDeployHash: deployHash,
        processedAt: new Date().toISOString(),
        status: "relay_confirmed"
      });
      return this.store.updateRelayerJob(current.gatewayPaymentHash, {
        attempts: nextAttempt,
        status: "confirmed",
        casperDeployHash: deployHash
      });
    } catch (error) {
      return this.store.updateRelayerJob(current.gatewayPaymentHash, {
        attempts: nextAttempt,
        status: "retryable_failed",
        lastError: error instanceof Error ? error.message : "Unknown relayer failure"
      });
    }
  }
}
