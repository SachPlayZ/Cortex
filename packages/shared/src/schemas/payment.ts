import { z } from "zod";
import { PaymentStatuses } from "../constants/status.js";
import { Hex32Schema, IsoDateTimeSchema, PositiveBigIntStringSchema } from "./common.js";

export const DodoCheckoutMetadataSchema = z.object({
  invoice_id: z.string().min(1),
  invoice_hash: Hex32Schema,
  expected_amount_usd_cents: PositiveBigIntStringSchema,
  nonce: z.string().min(16),
  environment: z.literal("test_mode"),
  purpose: z.literal("cortex_invoice_repayment")
});

export type DodoCheckoutMetadata = z.infer<typeof DodoCheckoutMetadataSchema>;

export const DodoWebhookEventSchema = z.object({
  event_id: z.string().min(1),
  event_type: z.string().min(1),
  payment_id: z.string().min(1),
  status: z.string().min(1),
  amount_usd_cents: PositiveBigIntStringSchema,
  currency: z.literal("USD"),
  metadata: DodoCheckoutMetadataSchema,
  received_at: IsoDateTimeSchema
});

export type DodoWebhookEvent = z.infer<typeof DodoWebhookEventSchema>;

export const DodoWebhookRecordSchema = z.object({
  id: z.string().min(1),
  eventId: z.string().min(1),
  paymentId: z.string().min(1),
  gatewayPaymentHash: Hex32Schema,
  invoiceId: z.string().min(1),
  rawBodyHash: Hex32Schema,
  signatureValid: z.boolean(),
  amountUsdCents: PositiveBigIntStringSchema,
  currency: z.literal("USD"),
  processedAt: IsoDateTimeSchema.optional(),
  casperDeployHash: z.string().optional(),
  status: z.enum(PaymentStatuses)
});

export type DodoWebhookRecord = z.infer<typeof DodoWebhookRecordSchema>;
