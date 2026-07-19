import { describe, expect, it, vi } from "vitest";
import { CasperContractCaller, CasperLifecycleClient } from "../server/integrations/casper-sdk";

const config = {
  rpcUrl: "https://node.testnet.cspr.cloud/rpc",
  chainName: "casper-test",
  registryPackageHash: `hash-${"11".repeat(32)}`,
  fundingVaultPackageHash: `hash-${"22".repeat(32)}`,
  repaymentEscrowPackageHash: `hash-${"33".repeat(32)}`,
  agentReputationPackageHash: `hash-${"44".repeat(32)}`
};

describe("CasperLifecycleClient canonical calls", () => {
  it("routes server funding, cashout, repayment, and claim through InvoiceRegistry", async () => {
    const call = vi.fn().mockResolvedValue("tx-hash");
    const registry = { call } as unknown as CasperContractCaller;
    const client = new CasperLifecycleClient(config, { registry });
    const signer = { keyPath: "/tmp/key.pem" };
    const invoice = {
      id: `0x${"55".repeat(32)}`,
      invoiceHash: `0x${"66".repeat(32)}` as `0x${string}`,
      repaymentAmountUsdCents: "100000",
      advanceAmountUsdCents: "97000",
      statusCasper: "Listed"
    };

    await client.fundInvoice(invoice, signer);
    await client.cashOutAdvance(invoice.id, signer);
    await client.recordGatewayRepayment(invoice.id, `0x${"77".repeat(32)}`, `0x${"88".repeat(32)}`, "100000", signer);
    await client.claimRepayment(invoice.id, signer);

    expect(call.mock.calls.map((args) => args[1])).toEqual([
      "fund_invoice",
      "cash_out_advance",
      "record_gateway_repayment",
      "claim_repayment"
    ]);
  });
});
