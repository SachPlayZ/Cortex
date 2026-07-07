import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryPaymentStore, type RelayerJobRecord } from "../server/integrations/payment-store";

const syncLatestEvents = vi.fn();

vi.mock("../server/integrations/casper-chain-sync", () => ({
  CasperChainSyncService: class {
    async syncLatestEvents() {
      return syncLatestEvents();
    }
  }
}));

import { runBackgroundJobsOnce } from "../server/background-jobs";

describe("runBackgroundJobsOnce", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CASPER_NODE_RPC_URL;
    delete process.env.INVOICE_REGISTRY_PACKAGE_HASH;
    delete process.env.BACKGROUND_RETRY_BATCH_SIZE;
  });

  it("syncs Casper events before draining retryable relayer jobs", async () => {
    process.env.CASPER_NODE_RPC_URL = "http://rpc";
    process.env.INVOICE_REGISTRY_PACKAGE_HASH = "hash-123";
    const store = new InMemoryPaymentStore();
    const invoiceId = "inv_sync_1";
    await store.upsertInvoice({
      id: invoiceId,
      invoiceHash: `0x${"11".repeat(32)}` as `0x${string}`,
      repaymentAmountUsdCents: "100000",
      statusCasper: "RepaymentPending"
    });
    await store.recordWebhook({
      id: "webhook_1",
      eventId: "evt_1",
      paymentId: "pay_1",
      gatewayPaymentHash: `0x${"22".repeat(32)}` as `0x${string}`,
      invoiceId,
      rawBodyHash: `0x${"33".repeat(32)}` as `0x${string}`,
      signatureValid: true,
      amountUsdCents: "100000",
      currency: "USD",
      status: "relay_queued"
    });
    const job: RelayerJobRecord = {
      id: "job_1",
      webhookEventId: "evt_1",
      invoiceId,
      gatewayPaymentHash: `0x${"22".repeat(32)}` as `0x${string}`,
      paymentAttestationHash: `0x${"44".repeat(32)}` as `0x${string}`,
      paidAmountUsdCents: "100000",
      status: "queued",
      attempts: 0
    };
    await store.upsertRelayerJob(job);
    const casperSettlement = {
      getInvoice: vi.fn(),
      recordGatewayRepayment: vi.fn().mockResolvedValue({ deployHash: "deploy_1" })
    };

    const result = await runBackgroundJobsOnce({ paymentStore: store, casperSettlement });

    expect(syncLatestEvents).toHaveBeenCalledTimes(1);
    expect(casperSettlement.recordGatewayRepayment).toHaveBeenCalledWith({
      invoiceId,
      gatewayPaymentHash: job.gatewayPaymentHash,
      paidAmountUsdCents: "100000",
      paymentAttestationHash: job.paymentAttestationHash
    });
    expect(result).toEqual({
      synced: true,
      attempted: 1,
      confirmed: 1,
      retryableFailed: 0
    });
  });

  it("skips Casper sync when lifecycle config is absent", async () => {
    const store = new InMemoryPaymentStore();
    const casperSettlement = {
      getInvoice: vi.fn(),
      recordGatewayRepayment: vi.fn()
    };

    const result = await runBackgroundJobsOnce({ paymentStore: store, casperSettlement });

    expect(syncLatestEvents).not.toHaveBeenCalled();
    expect(result).toEqual({
      synced: false,
      attempted: 0,
      confirmed: 0,
      retryableFailed: 0
    });
  });
});
