import { hashJson, type AgentAttestation, type FxQuote, type ParsedInvoice, type RiskPricing, type VerificationReport } from "@cortex/shared";

export function buildAttestation(input: {
  invoiceId: string;
  invoiceHash: `0x${string}`;
  evidenceHash: `0x${string}`;
  buyerHash: `0x${string}`;
  sellerWallet: string;
  parsed: ParsedInvoice;
  fx: FxQuote;
  verification: VerificationReport;
  pricing: RiskPricing;
  createdAt: string;
  model?: string;
}): { attestation: AgentAttestation; attestationHash: `0x${string}` } {
  const attestation: AgentAttestation = {
    version: "cortex-attestation-v1",
    invoice_id: input.invoiceId,
    invoice_hash: input.invoiceHash,
    evidence_hash: input.evidenceHash,
    buyer_hash: input.buyerHash,
    seller_wallet: input.sellerWallet,
    original_currency: input.parsed.original_currency,
    original_amount_minor: input.fx.original_amount_minor,
    fx: {
      quote_currency: "USD",
      rate_decimal: input.fx.rate_decimal,
      source: input.fx.source,
      source_timestamp: input.fx.source_timestamp,
      usd_amount_cents: input.fx.usd_amount_cents
    },
    verification: {
      duplicate_invoice_hash: input.verification.checks.duplicate_invoice_hash,
      due_date_valid: input.verification.checks.due_date_valid,
      buyer_domain_valid: input.verification.checks.buyer_domain_valid,
      extraction_confidence_ok: input.verification.checks.extraction_confidence_ok
    },
    risk: {
      risk_score: input.pricing.risk_score,
      risk_tier: input.pricing.risk_tier,
      discount_bps: input.pricing.discount_bps,
      advance_rate_bps: input.pricing.advance_rate_bps,
      advance_amount_usd_cents: input.pricing.advance_amount_usd_cents,
      repayment_amount_usd_cents: input.pricing.repayment_amount_usd_cents
    },
    agent: {
      agent_id: "cortex-underwriter-v1",
      model: input.model ?? "deterministic-v1",
      created_at: input.createdAt
    }
  };

  return { attestation, attestationHash: hashJson(attestation) };
}
