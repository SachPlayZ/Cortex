import { describe, expect, it } from "vitest";
import { sha256Hex } from "@cortex/shared";
import { FxNormalizer, ManualFxRateProvider, parseInvoiceText, runUnderwriting } from "../src/index.js";

const now = new Date("2026-06-28T00:00:00.000Z");
const validInvoice = `
Invoice: INV-018
Seller: Acme Studio
Seller Email: seller@example.com
Buyer: Globex LLC
Buyer Email: ap@globex.com
Buyer Domain: globex.com
Amount: INR 83000.00
Issue Date: 2026-06-28
Due Date: 2026-07-28
Payment Terms: Net 30
Confidence: 0.94
`;

describe("parser agent", () => {
  it("extracts valid invoice fields", () => {
    const parsed = parseInvoiceText({ invoiceText: validInvoice, now });
    expect(parsed.invoice_number).toBe("INV-018");
    expect(parsed.original_currency).toBe("INR");
    expect(parsed.original_amount_decimal).toBe("83000.00");
  });

  it("rejects missing amount and past due dates", () => {
    expect(() => parseInvoiceText({ invoiceText: validInvoice.replace("Amount: INR 83000.00", ""), now })).toThrow("Missing amount");
    expect(() => parseInvoiceText({ invoiceText: validInvoice.replace("Due Date: 2026-07-28", "Due Date: 2026-01-01"), now })).toThrow("past");
  });
});

describe("fx agent", () => {
  it("normalizes INR to USD cents using fixed-point math", async () => {
    const fx = new FxNormalizer(new ManualFxRateProvider({ INR: "0.012" }), 600_000, () => now.getTime());
    const quote = await fx.normalize({
      original_currency: "INR",
      original_amount_decimal: "83000.00",
      invoice_date: "2026-06-28"
    });
    expect(quote.usd_amount_cents).toBe("99600");
    expect(quote.source).toBe("manual-demo");
  });
});

describe("orchestrator", () => {
  it("underwrites low-risk INR invoice deterministically", async () => {
    const result = await runUnderwriting({
      invoiceText: validInvoice,
      sellerWallet: "account-hash-seller",
      fxProvider: new ManualFxRateProvider({ INR: "0.012" }),
      now
    });

    expect(result.status).toBe("ready_to_mint");
    expect(result.fx.usd_amount_cents).toBe("99600");
    expect(result.pricing.risk_tier).toBe("Low");
    expect(result.pricing.discount_bps).toBe(300);
    expect(result.pricing.advance_amount_usd_cents).toBe("96612");
    expect(result.attestationHash).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it("rejects duplicate invoice hash", async () => {
    const invoiceHash = sha256Hex(validInvoice);
    const result = await runUnderwriting({
      invoiceText: validInvoice,
      sellerWallet: "account-hash-seller",
      fxProvider: new ManualFxRateProvider({ INR: "0.012" }),
      existingInvoiceHashes: new Set([invoiceHash]),
      now
    });

    expect(result.status).toBe("rejected");
    expect(result.verification.reject_reasons).toContain("duplicate_invoice_hash");
  });

  it("attestation hash is stable", async () => {
    const input = {
      invoiceText: validInvoice,
      sellerWallet: "account-hash-seller",
      fxProvider: new ManualFxRateProvider({ INR: "0.012" }),
      now
    };
    const first = await runUnderwriting(input);
    const second = await runUnderwriting(input);
    expect(first.attestationHash).toBe(second.attestationHash);
  });
});
