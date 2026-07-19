import { beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryPaymentStore } from "../server/integrations/payment-store";

const store = new InMemoryPaymentStore();
const fakeLifecycleClient = {
  prepareCreateInvoice: vi.fn(),
  prepareListInvoice: vi.fn(),
  prepareFundInvoice: vi.fn(),
  prepareCashOutAdvance: vi.fn(),
  prepareClaimRepayment: vi.fn(),
  armEscrowPosition: vi.fn(),
  noteInvoiceScored: vi.fn(),
  getTransactionReceipt: vi.fn(),
  waitForTransaction: vi.fn(),
  postRiskScore: vi.fn(),
  registerRegistryAgent: vi.fn(),
  registerReputationAgent: vi.fn(),
  registerRegistrySettlementRelayer: vi.fn(),
  registerEscrowSettlementRelayer: vi.fn(),
  depositVaultLiquidity: vi.fn(),
  noteSuccessfulRepayment: vi.fn()
};
let lastConfirmedHash = "";

vi.mock("../server/integrations/casper-chain-sync", () => ({
  contractInvoiceIdHash: (invoiceId: string) => invoiceId,
  CasperChainSyncService: class {
    async getInvoiceState(invoiceId: string) {
      const invoice = await store.requireInvoice(invoiceId);
      if (lastConfirmedHash === "tx-create") {
        lastConfirmedHash = "";
        return store.updateInvoice(invoiceId, { casperInvoiceExists: true, statusCasper: "Created" });
      }
      if (lastConfirmedHash === "tx-list") {
        lastConfirmedHash = "";
        return store.updateInvoice(invoiceId, { statusCasper: "Listed" });
      }
      if (lastConfirmedHash === "tx-fund") {
        lastConfirmedHash = "";
        return store.updateInvoice(invoiceId, { statusCasper: "RepaymentPending" });
      }
      if (lastConfirmedHash === "tx-cashout") {
        lastConfirmedHash = "";
        return store.updateInvoice(invoiceId, { statusCasper: "RepaymentPending", cashoutDeployHash: "tx-cashout" });
      }
      if (lastConfirmedHash === "tx-claim") {
        lastConfirmedHash = "";
        return store.updateInvoice(invoiceId, { statusCasper: "Settled" });
      }
      return invoice;
    }

    async updateBootstrapStatus(patch: Record<string, unknown>) {
      return store.upsertBootstrapStatus({
        id: "invoice_registry_bootstrap",
        lifecycleMode: "real",
        agentRegistered: Boolean(patch.agentRegistered),
        settlementRelayerRegistered: Boolean(patch.settlementRelayerRegistered),
        vaultLiquidityDeposited: Boolean(patch.vaultLiquidityDeposited),
        updatedAt: new Date().toISOString()
      });
    }
  }
}));

vi.mock("../server/payment-runtime", () => ({
  getPaymentRuntime: vi.fn(async () => ({
    paymentStore: store,
    casperSettlement: {
      getInvoice: vi.fn(),
      recordGatewayRepayment: vi.fn()
    }
  })),
  getCasperLifecycleClient: vi.fn(() => fakeLifecycleClient),
  hasAgentSignerConfig: vi.fn(() => true),
  hasCasperLifecycleConfig: vi.fn(() => true)
}));

import { CasperLifecycleService } from "../server/integrations/casper-lifecycle";

async function seedInvoice(overrides: Partial<Awaited<ReturnType<InMemoryPaymentStore["requireInvoice"]>>> = {}) {
  await store.upsertInvoice({
    id: "inv_lifecycle_1",
    title: "INV-001",
    sellerAccount: "account-hash-seller",
    sellerPublicKey: "02sellerpub",
    invoiceHash: `0x${"11".repeat(32)}` as `0x${string}`,
    repaymentAmountUsdCents: "100000",
    advanceAmountUsdCents: "97000",
    usdAmountCents: "100000",
    riskTier: "Low",
    riskScore: 92,
    discountBps: 300,
    dueDate: "2026-12-31",
    statusCasper: "Scored",
    attestationHash: `0x${"22".repeat(32)}` as `0x${string}`,
    ...overrides
  });
}

describe("CasperLifecycleService", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    lastConfirmedHash = "";
    process.env.INVOICE_REGISTRY_PACKAGE_HASH = "hash-5fef146666891b7af8465e6030028f336aa2efe6e0e6d2ba520b5210877642c4";
    process.env.FUNDING_VAULT_PACKAGE_HASH = "hash-756757ea8d976f7cdfbae9852fc653f3e0cab00dacd729cc6564943f4584982c";
    process.env.REPAYMENT_ESCROW_PACKAGE_HASH = "hash-5ca1cb4499af61e4cec8e51ae105c005e1d11cc9ba5685e09c2c5d4c4dea448f";
    process.env.AGENT_REPUTATION_PACKAGE_HASH = "hash-1f17052480f6cc3e639eccfb8b5b8aafa600cda610ddcb977f0f10534863984e";
    process.env.AGENT_PRIVATE_KEY_PATH = "/tmp/agent_secret_key.pem";
    process.env.CASPER_ADMIN_PRIVATE_KEY_PATH = "/tmp/admin_secret_key.pem";
    process.env.AGENT_PUBLIC_KEY = "02agentpub";
    await store.upsertBootstrapStatus({
      id: "invoice_registry_bootstrap",
      lifecycleMode: "real",
      agentRegistered: true,
      settlementRelayerRegistered: true,
      vaultLiquidityDeposited: true,
      updatedAt: new Date().toISOString()
    });
    fakeLifecycleClient.prepareCreateInvoice.mockReturnValue({
      entryPoint: "create_invoice",
      transaction: { payload: { fields: { args: { Named: [["invoice_id", { parsed: "inv_lifecycle_1" }]] } } } },
      transactionHash: "tx-create"
    });
    fakeLifecycleClient.prepareListInvoice.mockReturnValue({
      entryPoint: "list_invoice",
      transaction: { payload: { fields: { args: { Named: [["invoice_id", { parsed: "inv_lifecycle_1" }]] } } } },
      transactionHash: "tx-list"
    });
    fakeLifecycleClient.prepareFundInvoice.mockReturnValue({
      entryPoint: "fund_invoice",
      transaction: { payload: { fields: { args: { Named: [["invoice_id", { parsed: "inv_lifecycle_1" }]] } } } },
      transactionHash: "tx-fund"
    });
    fakeLifecycleClient.prepareCashOutAdvance.mockReturnValue({
      entryPoint: "cash_out_advance",
      transaction: { payload: { fields: { args: { Named: [["invoice_id", { parsed: "inv_lifecycle_1" }]] } } } },
      transactionHash: "tx-cashout"
    });
    fakeLifecycleClient.prepareClaimRepayment.mockReturnValue({
      entryPoint: "claim_repayment",
      transaction: { payload: { fields: { args: { Named: [["invoice_id", { parsed: "inv_lifecycle_1" }]] } } } },
      transactionHash: "tx-claim"
    });
    fakeLifecycleClient.getTransactionReceipt.mockImplementation(async (transactionHash: string) => {
      lastConfirmedHash = transactionHash;
      return {
        rawJSON: {
          transaction: {
            Version1: {
              hash: transactionHash,
              payload: {
                initiator_addr: {
                  PublicKey:
                    transactionHash === "tx-fund" || transactionHash === "tx-claim" ? "02investorpub" : "02sellerpub"
                },
                fields: {
                  entry_point:
                    transactionHash === "tx-create"
                      ? "create_invoice"
                      : transactionHash === "tx-list"
                        ? "list_invoice"
                        : transactionHash === "tx-fund"
                          ? "fund_invoice"
                          : transactionHash === "tx-cashout"
                            ? "cash_out_advance"
                            : "claim_repayment",
                  target: {
                    Stored: {
                      id: {
                        ByPackageHash: {
                          addr: "5fef146666891b7af8465e6030028f336aa2efe6e0e6d2ba520b5210877642c4"
                        }
                      }
                    }
                  },
                  args: {
                    Named: [["invoice_id", { parsed: "inv_lifecycle_1" }]]
                  }
                }
              }
            }
          }
        }
      };
    });
    fakeLifecycleClient.postRiskScore.mockResolvedValue("tx-score");
    fakeLifecycleClient.noteInvoiceScored.mockResolvedValue("tx-reputation-score");
    fakeLifecycleClient.armEscrowPosition.mockResolvedValue("tx-arm-escrow");
    fakeLifecycleClient.waitForTransaction.mockResolvedValue(undefined);
    await seedInvoice({
      statusCasper: "Scored",
      casperInvoiceExists: false,
      investorAccount: undefined
    });
  });

  it("prepares and confirms mint, then posts the on-chain risk score", async () => {
    const service = new CasperLifecycleService();

    const prepared = await service.prepareMint("inv_lifecycle_1", "02sellerpub", "account-hash-seller");
    expect(prepared.transaction_hash).toBe("tx-create");

    const invoice = await service.confirmMint("inv_lifecycle_1", prepared.intent_id, "tx-create");
    expect(fakeLifecycleClient.waitForTransaction).toHaveBeenCalledWith("tx-create");
    expect(fakeLifecycleClient.waitForTransaction).toHaveBeenCalledWith("tx-score");
    expect(fakeLifecycleClient.postRiskScore).toHaveBeenCalled();
    expect(fakeLifecycleClient.noteInvoiceScored).toHaveBeenCalledWith("02agentpub", { keyPath: "/tmp/admin_secret_key.pem" });
    expect(invoice.statusCasper).toBe("Created");
    expect(invoice.casperInvoiceExists).toBe(true);
    expect(invoice.createDeployHash).toBe("tx-create");
    expect(invoice.scoreDeployHash).toBe("tx-score");
  });

  it("confirms seller listing after a scored Casper state", async () => {
    const service = new CasperLifecycleService();
    await store.updateInvoice("inv_lifecycle_1", { casperInvoiceExists: true });
    const prepared = await service.prepareList("inv_lifecycle_1", "02sellerpub", "account-hash-seller");
    expect(prepared.transaction_hash).toBe("tx-list");

    const invoice = await service.confirmList("inv_lifecycle_1", prepared.intent_id, "tx-list");
    expect(fakeLifecycleClient.waitForTransaction).toHaveBeenCalledWith("tx-list");
    expect(invoice.statusCasper).toBe("Listed");
    expect(invoice.listDeployHash).toBe("tx-list");
  });

  it("blocks seller self-funding and confirms investor funding", async () => {
    const service = new CasperLifecycleService();
    await store.updateInvoice("inv_lifecycle_1", { casperInvoiceExists: true, statusCasper: "Listed" });

    await expect(service.prepareFund("inv_lifecycle_1", "02sellerpub", "account-hash-seller")).rejects.toThrow("Seller cannot fund");
    const prepared = await service.prepareFund("inv_lifecycle_1", "02investorpub", "account-hash-investor");
    expect(prepared.transaction_hash).toBe("tx-fund");

    const invoice = await service.confirmFund("inv_lifecycle_1", prepared.intent_id, "tx-fund");
    expect(fakeLifecycleClient.waitForTransaction).toHaveBeenCalledWith("tx-fund");
    expect(fakeLifecycleClient.armEscrowPosition).not.toHaveBeenCalled();
    expect(invoice.statusCasper).toBe("RepaymentPending");
    expect(invoice.investorAccount).toBe("account-hash-investor");
    expect(invoice.fundDeployHash).toBe("tx-fund");
  });

  it("allows optional seller cash out without blocking repayment pending status", async () => {
    const service = new CasperLifecycleService();
    await expect(service.prepareCashout("inv_lifecycle_1", "02sellerpub", "account-hash-seller")).rejects.toThrow("RepaymentPending");

    await store.updateInvoice("inv_lifecycle_1", { statusCasper: "RepaymentPending", casperInvoiceExists: true });
    const prepared = await service.prepareCashout("inv_lifecycle_1", "02sellerpub", "account-hash-seller");
    expect(prepared.transaction_hash).toBe("tx-cashout");

    const invoice = await service.confirmCashout("inv_lifecycle_1", prepared.intent_id, "tx-cashout");
    expect(fakeLifecycleClient.waitForTransaction).toHaveBeenCalledWith("tx-cashout");
    expect(invoice.statusCasper).toBe("RepaymentPending");
    expect(invoice.cashoutDeployHash).toBe("tx-cashout");
  });

  it("only lets the recorded investor claim after repayment", async () => {
    const service = new CasperLifecycleService();
    await store.updateInvoice("inv_lifecycle_1", {
      statusCasper: "Repaid",
      investorAccount: "account-hash-investor",
      investorPublicKey: "02investorpub",
      casperInvoiceExists: true
    });

    await expect(service.prepareClaim("inv_lifecycle_1", "02strangerpub", "account-hash-stranger")).rejects.toThrow("Only the investor wallet");
    const prepared = await service.prepareClaim("inv_lifecycle_1", "02investorpub", "account-hash-investor");
    expect(prepared.transaction_hash).toBe("tx-claim");

    // The claim can execute before the confirmation callback reaches the server.
    await store.updateInvoice("inv_lifecycle_1", { statusCasper: "Settled" });

    const invoice = await service.confirmClaim("inv_lifecycle_1", prepared.intent_id, "tx-claim");
    expect(fakeLifecycleClient.waitForTransaction).toHaveBeenCalledWith("tx-claim");
    expect(invoice.statusCasper).toBe("Settled");
    expect(invoice.claimDeployHash).toBe("tx-claim");
  });
});
