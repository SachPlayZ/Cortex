import { z } from "zod";
import { InvoiceStatuses, RiskTiers } from "../constants/status.js";
import {
  BigIntStringSchema,
  BpsSchema,
  Hex32Schema,
  IsoCurrencySchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  PositiveBigIntStringSchema
} from "./common.js";

export const ParsedInvoiceSchema = z
  .object({
    invoice_number: z.string().min(1),
    seller_name: z.string().min(1),
    seller_email: z.string().email().optional(),
    buyer_name: z.string().min(1),
    buyer_email: z.string().email().optional(),
    buyer_domain: z.string().min(1).optional(),
    original_currency: IsoCurrencySchema,
    original_amount_decimal: z.string().min(1),
    issue_date: IsoDateSchema,
    due_date: IsoDateSchema,
    payment_terms: z.string().optional(),
    line_items: z.array(z.string()).default([]),
    extraction_confidence: z.number().min(0).max(1),
    warnings: z.array(z.string()).default([])
  })
  .superRefine((value, ctx) => {
    if (Date.parse(value.due_date) <= Date.parse(value.issue_date)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["due_date"],
        message: "Due date must be after issue date"
      });
    }
  });

export type ParsedInvoice = z.infer<typeof ParsedInvoiceSchema>;

export const InvoiceRecordSchema = z.object({
  id: z.string().min(1),
  invoiceHash: Hex32Schema,
  sellerAccount: z.string().min(1),
  buyerHash: Hex32Schema,
  originalCurrency: IsoCurrencySchema,
  originalAmountMinor: PositiveBigIntStringSchema,
  usdAmountCents: PositiveBigIntStringSchema,
  advanceAmountUsdCents: PositiveBigIntStringSchema.optional(),
  repaymentAmountUsdCents: PositiveBigIntStringSchema.optional(),
  discountBps: BpsSchema.max(3000).optional(),
  riskScore: z.number().int().min(0).max(100).optional(),
  riskTier: z.enum(RiskTiers).optional(),
  dueDate: IsoDateSchema,
  statusLocal: z.string().min(1),
  statusCasper: z.enum(InvoiceStatuses).optional(),
  evidenceHash: Hex32Schema,
  attestationHash: Hex32Schema.optional(),
  casperInvoiceId: z.string().optional(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema
});

export type InvoiceRecord = z.infer<typeof InvoiceRecordSchema>;

export const CasperInvoiceInputSchema = z.object({
  invoice_id: Hex32Schema,
  invoice_hash: Hex32Schema,
  evidence_hash: Hex32Schema,
  buyer_hash: Hex32Schema,
  original_currency_hash: Hex32Schema,
  invoice_amount_usd_cents: BigIntStringSchema,
  due_timestamp: BigIntStringSchema
});

export type CasperInvoiceInput = z.infer<typeof CasperInvoiceInputSchema>;
