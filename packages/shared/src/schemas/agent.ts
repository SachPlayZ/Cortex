import { z } from "zod";
import { RiskTiers } from "../constants/status.js";
import {
  BigIntStringSchema,
  BpsSchema,
  Hex32Schema,
  IsoCurrencySchema,
  IsoDateTimeSchema,
  PositiveBigIntStringSchema
} from "./common.js";

export const FxQuoteSchema = z.object({
  base_currency: IsoCurrencySchema,
  quote_currency: z.literal("USD"),
  rate_decimal: z.string().min(1),
  source: z.enum(["frankfurter", "exchange-rate-api", "manual-demo"]),
  source_timestamp: IsoDateTimeSchema,
  fetched_at: IsoDateTimeSchema,
  original_amount_minor: PositiveBigIntStringSchema,
  usd_amount_cents: PositiveBigIntStringSchema,
  fx_response_hash: Hex32Schema
});

export type FxQuote = z.infer<typeof FxQuoteSchema>;

export const VerificationReportSchema = z.object({
  invoice_id: z.string().min(1),
  checks: z.object({
    duplicate_invoice_hash: z.boolean(),
    duplicate_invoice_number_for_seller: z.boolean(),
    due_date_valid: z.boolean(),
    buyer_domain_valid: z.boolean(),
    required_fields_present: z.boolean(),
    amount_within_bounds: z.boolean(),
    fx_rate_available: z.boolean(),
    extraction_confidence_ok: z.boolean()
  }),
  x402_receipts: z
    .array(
      z.object({
        service: z.string().min(1),
        endpoint: z.string().min(1),
        payment_proof_hash: Hex32Schema,
        response_hash: Hex32Schema,
        amount_paid: BigIntStringSchema
      })
    )
    .default([]),
  verification_score: z.number().int().min(0).max(100),
  hard_reject: z.boolean(),
  reject_reasons: z.array(z.string()).default([])
});

export type VerificationReport = z.infer<typeof VerificationReportSchema>;

export const RiskPricingSchema = z.object({
  invoice_id: z.string().min(1),
  risk_score: z.number().int().min(0).max(100),
  risk_tier: z.enum(RiskTiers),
  discount_bps: BpsSchema.max(3000),
  advance_rate_bps: BpsSchema,
  invoice_amount_usd_cents: PositiveBigIntStringSchema,
  advance_amount_usd_cents: BigIntStringSchema,
  repayment_amount_usd_cents: PositiveBigIntStringSchema,
  explanation: z.string().min(1),
  investor_summary: z.string().min(1),
  seller_summary: z.string().min(1)
});

export type RiskPricing = z.infer<typeof RiskPricingSchema>;

export const AgentAttestationSchema = z.object({
  version: z.literal("cortex-attestation-v1"),
  invoice_id: z.string().min(1),
  invoice_hash: Hex32Schema,
  evidence_hash: Hex32Schema,
  buyer_hash: Hex32Schema,
  seller_wallet: z.string().min(1),
  original_currency: IsoCurrencySchema,
  original_amount_minor: PositiveBigIntStringSchema,
  fx: z.object({
    quote_currency: z.literal("USD"),
    rate_decimal: z.string().min(1),
    source: z.enum(["frankfurter", "exchange-rate-api", "manual-demo"]),
    source_timestamp: IsoDateTimeSchema,
    usd_amount_cents: PositiveBigIntStringSchema
  }),
  verification: z.object({
    duplicate_invoice_hash: z.boolean(),
    due_date_valid: z.boolean(),
    buyer_domain_valid: z.boolean(),
    extraction_confidence_ok: z.boolean()
  }),
  risk: z.object({
    risk_score: z.number().int().min(0).max(100),
    risk_tier: z.enum(RiskTiers),
    discount_bps: BpsSchema.max(3000),
    advance_rate_bps: BpsSchema,
    advance_amount_usd_cents: BigIntStringSchema,
    repayment_amount_usd_cents: PositiveBigIntStringSchema
  }),
  agent: z.object({
    agent_id: z.string().min(1),
    model: z.string().min(1),
    created_at: IsoDateTimeSchema
  })
});

export type AgentAttestation = z.infer<typeof AgentAttestationSchema>;
