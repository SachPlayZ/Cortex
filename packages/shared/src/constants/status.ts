export const InvoiceStatuses = [
  "Created",
  "Scored",
  "Listed",
  "Funded",
  "RepaymentPending",
  "Repaid",
  "Settled",
  "Defaulted",
  "Cancelled",
  "Rejected",
  "Disputed"
] as const;

export type InvoiceStatus = (typeof InvoiceStatuses)[number];

export const RiskTiers = ["Low", "MediumLow", "Medium", "High", "Rejected"] as const;

export type RiskTier = (typeof RiskTiers)[number];

export const PaymentStatuses = [
  "checkout_created",
  "webhook_pending",
  "webhook_verified",
  "relay_queued",
  "relay_submitted",
  "relay_confirmed",
  "failed",
  "mismatch"
] as const;

export type PaymentStatus = (typeof PaymentStatuses)[number];
