import { loadServerEnv } from "./env";
import { InMemoryPaymentStore, PostgresPaymentStore, type PaymentStore } from "./integrations/payment-store";
import {
  CasperSdkSettlementClient,
  type CasperSettlementClient,
  MemoryCasperSettlementClient
} from "./integrations/settlement-relayer";
import { CasperLifecycleClient } from "./integrations/casper-sdk";
import { demoInvoices } from "../lib/demo-data";

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
  const paymentStore = process.env.DATABASE_URL?.startsWith("postgres")
    ? new PostgresPaymentStore(process.env.DATABASE_URL)
    : new InMemoryPaymentStore();

  for (const invoice of demoInvoices) {
    await paymentStore.upsertInvoice({
      id: invoice.id,
      invoiceHash: invoice.invoiceHash,
      repaymentAmountUsdCents: invoice.repaymentAmountUsdCents,
      statusCasper: invoice.statusCasper as
        | "Created"
        | "Scored"
        | "Listed"
        | "Funded"
        | "RepaymentPending"
        | "Repaid"
        | "Settled"
        | "Defaulted"
        | "Cancelled"
        | "Rejected"
        | "Disputed"
    });
  }

  const canUseCasperSdk =
    Boolean(process.env.CASPER_NODE_RPC_URL) &&
    Boolean(process.env.INVOICE_REGISTRY_PACKAGE_HASH) &&
    Boolean(process.env.SETTLEMENT_RELAYER_PRIVATE_KEY_PATH);

  const casperSettlement = canUseCasperSdk
    ? new CasperSdkSettlementClient(paymentStore, {
        rpcUrl: process.env.CASPER_NODE_RPC_URL ?? "",
        chainName: process.env.CASPER_CHAIN_NAME ?? "casper-test",
        packageHash: process.env.INVOICE_REGISTRY_PACKAGE_HASH ?? "",
        relayerPrivateKeyPath: process.env.SETTLEMENT_RELAYER_PRIVATE_KEY_PATH ?? "",
        paymentMotes: parsePaymentMotes(process.env.CASPER_RELAYER_PAYMENT_MOTES)
      })
    : new MemoryCasperSettlementClient(paymentStore);

  return { paymentStore, casperSettlement };
}

function parsePaymentMotes(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error("CASPER_RELAYER_PAYMENT_MOTES must be a positive safe integer");
  }
  return parsed;
}
