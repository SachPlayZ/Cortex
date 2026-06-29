import { z } from "zod";
import { InvoiceStatuses, RiskTiers } from "../constants/status.js";
import { BigIntStringSchema, BpsSchema, Hex32Schema } from "./common.js";

export const ContractInvoiceSchema = z.object({
  invoice_id: Hex32Schema,
  seller: z.string().min(1),
  buyer_hash: Hex32Schema,
  invoice_hash: Hex32Schema,
  evidence_hash: Hex32Schema,
  attestation_hash: Hex32Schema.optional(),
  original_currency_hash: Hex32Schema,
  invoice_amount_usd_cents: BigIntStringSchema,
  advance_amount_usd_cents: BigIntStringSchema,
  repayment_amount_usd_cents: BigIntStringSchema,
  discount_bps: BpsSchema.max(3000),
  advance_rate_bps: BpsSchema,
  risk_score: z.number().int().min(0).max(100),
  risk_tier: z.enum(RiskTiers),
  due_timestamp: BigIntStringSchema,
  investor: z.string().optional(),
  status: z.enum(InvoiceStatuses),
  created_at: BigIntStringSchema,
  funded_at: BigIntStringSchema.optional(),
  repaid_at: BigIntStringSchema.optional(),
  settled_at: BigIntStringSchema.optional()
});

export type ContractInvoice = z.infer<typeof ContractInvoiceSchema>;
