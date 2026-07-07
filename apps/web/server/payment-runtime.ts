import { loadServerEnv } from "./env";
import { ensureBackgroundJobs } from "./background-jobs";
import { InMemoryPaymentStore, PostgresPaymentStore, type PaymentStore } from "./integrations/payment-store";
import {
  CasperSdkSettlementClient,
  type CasperSettlementClient,
  MemoryCasperSettlementClient
} from "./integrations/settlement-relayer";
import { CasperLifecycleClient } from "./integrations/casper-sdk";

loadServerEnv();

export type PaymentRuntime = {
  paymentStore: PaymentStore;
  casperSettlement: CasperSettlementClient;
};

let runtimePromise: Promise<PaymentRuntime> | undefined;

export function getPaymentRuntime(): Promise<PaymentRuntime> {
  runtimePromise ??= createRuntime();
  return runtimePromise;
}

export function getCasperLifecycleClient(): CasperLifecycleClient {
  if (!hasCasperLifecycleConfig()) {
    throw new Error("Casper lifecycle environment not configured");
  }
  return new CasperLifecycleClient({
    rpcUrl: process.env.CASPER_NODE_RPC_URL ?? "",
    chainName: process.env.CASPER_CHAIN_NAME ?? "casper-test",
    registryPackageHash: process.env.INVOICE_REGISTRY_PACKAGE_HASH ?? "",
    fundingVaultPackageHash: process.env.FUNDING_VAULT_PACKAGE_HASH ?? "",
    repaymentEscrowPackageHash: process.env.REPAYMENT_ESCROW_PACKAGE_HASH ?? "",
    agentReputationPackageHash: process.env.AGENT_REPUTATION_PACKAGE_HASH ?? "",
    paymentMotes: parsePaymentMotes(process.env.CASPER_LIFECYCLE_PAYMENT_MOTES) ?? 2_500_000_000
  });
}

export function hasCasperLifecycleConfig(): boolean {
  return (
    Boolean(process.env.CASPER_NODE_RPC_URL) &&
    Boolean(process.env.INVOICE_REGISTRY_PACKAGE_HASH) &&
    Boolean(process.env.FUNDING_VAULT_PACKAGE_HASH) &&
    Boolean(process.env.REPAYMENT_ESCROW_PACKAGE_HASH) &&
    Boolean(process.env.AGENT_REPUTATION_PACKAGE_HASH)
  );
}

export function hasAgentSignerConfig(): boolean {
  return hasCasperLifecycleConfig() && Boolean(process.env.AGENT_PRIVATE_KEY_PATH);
}

export function hasRealCasperSettlementConfig(): boolean {
  return hasCasperLifecycleConfig() && Boolean(process.env.SETTLEMENT_RELAYER_PRIVATE_KEY_PATH);
}

async function createRuntime(): Promise<PaymentRuntime> {
  const runtime = {
    paymentStore: createPaymentStore(),
    casperSettlement: undefined as unknown as CasperSettlementClient
  };
  runtime.casperSettlement = createSettlementClient(runtime.paymentStore);
  ensureBackgroundJobs(runtime);
  return {
    paymentStore: runtime.paymentStore,
    casperSettlement: runtime.casperSettlement
  };
}

function createPaymentStore(): PaymentStore {
  if (process.env.DATABASE_URL?.startsWith("postgres")) {
    return new PostgresPaymentStore(process.env.DATABASE_URL);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL must be a Postgres connection string in production");
  }
  return new InMemoryPaymentStore();
}

function createSettlementClient(paymentStore: PaymentStore): CasperSettlementClient {
  if (hasRealCasperSettlementConfig()) {
    return new CasperSdkSettlementClient(paymentStore, {
      rpcUrl: process.env.CASPER_NODE_RPC_URL ?? "",
      chainName: process.env.CASPER_CHAIN_NAME ?? "casper-test",
      registryPackageHash: process.env.INVOICE_REGISTRY_PACKAGE_HASH ?? "",
      repaymentEscrowPackageHash: process.env.REPAYMENT_ESCROW_PACKAGE_HASH ?? "",
      agentReputationPackageHash: process.env.AGENT_REPUTATION_PACKAGE_HASH ?? "",
      relayerPrivateKeyPath: process.env.SETTLEMENT_RELAYER_PRIVATE_KEY_PATH ?? "",
      paymentMotes: parsePaymentMotes(process.env.CASPER_RELAYER_PAYMENT_MOTES)
    });
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Casper settlement relayer environment is not fully configured");
  }

  return new MemoryCasperSettlementClient(paymentStore);
}

function parsePaymentMotes(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("Casper payment motes must be a positive safe integer");
  }
  return parsed;
}
