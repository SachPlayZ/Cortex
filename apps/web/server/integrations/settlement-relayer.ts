import { createRequire } from "node:module";
import type { InvoiceStatus } from "@cortex/shared";
import { type PaymentStore, type RelayerJobRecord } from "./payment-store";
import { CasperLifecycleClient } from "./casper-sdk";

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
      lastRepaymentDeployHash: deployHash,
      statusLastSyncedAt: new Date().toISOString()
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
  registryPackageHash: string;
  repaymentEscrowPackageHash: string;
  agentReputationPackageHash: string;
  relayerPrivateKeyPath: string;
  paymentMotes?: number | undefined;
};

export class CasperSdkSettlementClient implements CasperSettlementClient {
  private readonly rpcClient: InstanceType<CasperSdk["RpcClient"]>;
  private readonly lifecycle: CasperLifecycleClient;

  constructor(
    private readonly store: PaymentStore,
    private readonly config: CasperSdkSettlementClientConfig
  ) {
    this.rpcClient = new casperSdk.RpcClient(new casperSdk.HttpHandler(config.rpcUrl, "fetch"));
    this.lifecycle = new CasperLifecycleClient({
      rpcUrl: config.rpcUrl,
      chainName: config.chainName,
      registryPackageHash: config.registryPackageHash,
      fundingVaultPackageHash: process.env.FUNDING_VAULT_PACKAGE_HASH ?? "",
      repaymentEscrowPackageHash: config.repaymentEscrowPackageHash,
      agentReputationPackageHash: config.agentReputationPackageHash,
      paymentMotes: config.paymentMotes
    });
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

    const deployHash = await this.lifecycle.recordGatewayRepayment(
      input.invoiceId,
      input.gatewayPaymentHash,
      input.paymentAttestationHash,
      input.paidAmountUsdCents,
      { keyPath: this.config.relayerPrivateKeyPath }
    );
    await this.waitForTransaction(deployHash);
    await this.noteSuccessfulReputation();
    await this.store.updateInvoice(input.invoiceId, {
      statusCasper: "Repaid",
      lastRepaymentDeployHash: deployHash,
      statusLastSyncedAt: new Date().toISOString()
    });
    return { deployHash };
  }

  private async noteSuccessfulReputation() {
    const adminKeyPath = process.env.CASPER_ADMIN_PRIVATE_KEY_PATH;
    const agentPublicKey = process.env.AGENT_PUBLIC_KEY;
    if (!adminKeyPath || !agentPublicKey) return;
    const deployHash = await this.lifecycle.noteSuccessfulRepayment(agentPublicKey, { keyPath: adminKeyPath });
    await this.waitForTransaction(deployHash);
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
        if (!executionResult) {
          await new Promise((resolve) => setTimeout(resolve, 5_000));
          continue;
        }
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
