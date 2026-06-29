import { describe, expect, it } from "vitest";
import {
  AgentAttestationSchema,
  DodoWebhookEventSchema,
  ParsedInvoiceSchema,
  RiskPricingSchema
} from "../src/index.js";

const hash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("schemas", () => {
  it("validates parsed invoice output and normalizes currency", () => {
    const parsed = ParsedInvoiceSchema.parse({
      invoice_number: "INV-001",
      seller_name: "Seller LLC",
      buyer_name: "Buyer LLC",
      original_currency: "inr",
      original_amount_decimal: "83000.00",
      issue_date: "2026-06-28",
      due_date: "2026-07-28",
      extraction_confidence: 0.91
    });

    expect(parsed.original_currency).toBe("INR");
    expect(parsed.line_items).toEqual([]);
    expect(parsed.warnings).toEqual([]);
  });

  it("rejects malformed parser output", () => {
    expect(() =>
      ParsedInvoiceSchema.parse({
        invoice_number: "INV-001",
        seller_name: "Seller LLC",
        buyer_name: "",
        original_currency: "XYZ",
        original_amount_decimal: "83000.00",
        issue_date: "2026-07-28",
        due_date: "2026-06-28",
        extraction_confidence: 0.91
      })
    ).toThrow();
  });

  it("validates risk pricing output", () => {
    const pricing = RiskPricingSchema.parse({
      invoice_id: "inv_1",
      risk_score: 92,
      risk_tier: "Low",
      discount_bps: 300,
      advance_rate_bps: 9700,
      invoice_amount_usd_cents: "99600",
      advance_amount_usd_cents: "96612",
      repayment_amount_usd_cents: "99600",
      explanation: "Strong invoice.",
      investor_summary: "Low risk.",
      seller_summary: "Accepted."
    });

    expect(pricing.risk_tier).toBe("Low");
  });

  it("validates payment webhook metadata shape", () => {
    const event = DodoWebhookEventSchema.parse({
      event_id: "evt_1",
      event_type: "payment.succeeded",
      payment_id: "pay_1",
      status: "succeeded",
      amount_usd_cents: "99600",
      currency: "USD",
      metadata: {
        invoice_id: "inv_1",
        invoice_hash: hash,
        expected_amount_usd_cents: "99600",
        nonce: "0123456789abcdef",
        environment: "test_mode",
        purpose: "cortex_invoice_repayment"
      },
      received_at: "2026-06-28T00:00:00.000Z"
    });

    expect(event.metadata.purpose).toBe("cortex_invoice_repayment");
  });

  it("validates attestation without private buyer identity fields", () => {
    const attestation = AgentAttestationSchema.parse({
      version: "cortex-attestation-v1",
      invoice_id: "inv_1",
      invoice_hash: hash,
      evidence_hash: hash,
      buyer_hash: hash,
      seller_wallet: "account-hash",
      original_currency: "INR",
      original_amount_minor: "8300000",
      fx: {
        quote_currency: "USD",
        rate_decimal: "0.012",
        source: "manual-demo",
        source_timestamp: "2026-06-28T00:00:00.000Z",
        usd_amount_cents: "99600"
      },
      verification: {
        duplicate_invoice_hash: false,
        due_date_valid: true,
        buyer_domain_valid: true,
        extraction_confidence_ok: true
      },
      risk: {
        risk_score: 92,
        risk_tier: "Low",
        discount_bps: 300,
        advance_rate_bps: 9700,
        advance_amount_usd_cents: "96612",
        repayment_amount_usd_cents: "99600"
      },
      agent: {
        agent_id: "cortex-underwriter-v1",
        model: "deterministic-v1",
        created_at: "2026-06-28T00:00:00.000Z"
      }
    });

    expect(JSON.stringify(attestation)).not.toContain("buyer_email");
    expect(JSON.stringify(attestation)).not.toContain("buyer_name");
  });
});
