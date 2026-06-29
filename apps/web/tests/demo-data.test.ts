import { describe, expect, it } from "vitest";
import { demoInvoices, expectedReturnPercent, formatUsd } from "../lib/demo-data";

describe("demo data", () => {
  it("contains required demo samples", () => {
    expect(demoInvoices.map((invoice) => invoice.id)).toEqual(["crd-inr-live-001", "crd-usd-002", "crd-fake-003"]);
    expect(demoInvoices[0]?.statusCasper).toBe("RepaymentPending");
    expect(demoInvoices[2]?.riskTier).toBe("Rejected");
  });

  it("formats money and investor return from integer cents", () => {
    expect(formatUsd("132375")).toBe("$1323.75");
    expect(expectedReturnPercent(demoInvoices[0]!)).toBe("3.09%");
  });
});
