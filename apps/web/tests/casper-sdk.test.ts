import { describe, expect, it, vi } from "vitest";
import {
  CasperContractCaller,
  CasperLifecycleClient,
  usdCentsToMockUsdUnits
} from "../server/integrations/casper-sdk";

const config = {
  rpcUrl: "https://node.testnet.cspr.cloud/rpc",
  chainName: "casper-test",
  registryPackageHash: `hash-${"11".repeat(32)}`,
  fundingVaultPackageHash: `hash-${"22".repeat(32)}`,
  repaymentEscrowPackageHash: `hash-${"33".repeat(32)}`,
  agentReputationPackageHash: `hash-${"44".repeat(32)}`,
  mockUsdPackageHash: `hash-${"55".repeat(32)}`
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

  it("approves the FundingVault for the exact 6-decimal mUSDC advance", () => {
    const prepare = vi.fn().mockReturnValue({
      entryPoint: "approve",
      transaction: {},
      transactionHash: "tx-approve"
    });
    const mockUsd = { prepare } as unknown as CasperContractCaller;
    const client = new CasperLifecycleClient(config, { mockUsd });

    client.prepareApproveFunding(
      {
        id: `0x${"55".repeat(32)}`,
        invoiceHash: `0x${"66".repeat(32)}`,
        repaymentAmountUsdCents: "100000",
        advanceAmountUsdCents: "97000",
        statusCasper: "Listed"
      },
      `02${"77".repeat(33)}`
    );

    const args = prepare.mock.calls[0]?.[2];
    expect(prepare.mock.calls[0]?.[1]).toBe("approve");
    expect(args.getByName("spender").toString()).toBe(`hash-${"22".repeat(32)}`);
    expect(args.getByName("amount").toString()).toBe("970000000");
    expect(usdCentsToMockUsdUnits("97000")).toBe("970000000");
  });

  it("mints the exact 6-decimal mUSDC amount to the faucet recipient", async () => {
    const call = vi.fn().mockResolvedValue("tx-mint");
    const mockUsd = { call } as unknown as CasperContractCaller;
    const client = new CasperLifecycleClient(config, { mockUsd });
    const signer = { keyPath: "/tmp/admin.pem" };

    await client.mintMockUsd(`02${"77".repeat(33)}`, "500000", signer);

    expect(call.mock.calls[0]?.[1]).toBe("mint");
    const args = call.mock.calls[0]?.[2];
    expect(args.getByName("amount").toString()).toBe("5000000000");
  });
});
