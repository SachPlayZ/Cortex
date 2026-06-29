import { loadServerEnv } from "./env";
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
  const rpcUrl = process.env.CASPER_NODE_RPC_URL;
  const packageHash = process.env.INVOICE_REGISTRY_PACKAGE_HASH;
  if (!rpcUrl || !packageHash) {
    throw new Error("Casper lifecycle environment not configured");
  }
  return new CasperLifecycleClient({
    rpcUrl,
    chainName: process.env.CASPER_CHAIN_NAME ?? "casper-test",
    packageHash,
    paymentMotes: parsePaymentMotes(process.env.CASPER_LIFECYCLE_PAYMENT_MOTES) ?? 2_500_000_000
  });
}

async function createRuntime(): Promise<PaymentRuntime> {
  const paymentStore = createPaymentStore();
  return {
    paymentStore,
    casperSettlement: createSettlementClient(paymentStore)
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
  const canUseCasperSdk =
    Boolean(process.env.CASPER_NODE_RPC_URL) &&
    Boolean(process.env.INVOICE_REGISTRY_PACKAGE_HASH) &&
    Boolean(process.env.SETTLEMENT_RELAYER_PRIVATE_KEY_PATH);

  if (canUseCasperSdk) {
    return new CasperSdkSettlementClient(paymentStore, {
      rpcUrl: process.env.CASPER_NODE_RPC_URL ?? "",
      chainName: process.env.CASPER_CHAIN_NAME ?? "casper-test",
      packageHash: process.env.INVOICE_REGISTRY_PACKAGE_HASH ?? "",
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
