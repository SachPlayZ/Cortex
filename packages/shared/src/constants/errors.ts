export const CortexErrorCodes = [
  "InvalidCurrency",
  "InvalidAmount",
  "InvalidDueDate",
  "DuplicateInvoiceHash",
  "DuplicateGatewayPaymentHash",
  "UnsupportedCurrency",
  "UnauthorizedAgent",
  "UnauthorizedRelayer",
  "InvalidStatus",
  "InvalidRiskScore",
  "InvalidBpsMath",
  "SellerCannotFundOwnInvoice",
  "InvoiceAlreadyFunded",
  "InvoiceExpired",
  "PaymentAlreadyUsed",
  "Underpayment",
  "ClaimNotAllowed",
  "AlreadyClaimed",
  "NotInvestor",
  "DefaultNotAllowed",
  "WebhookSignatureInvalid",
  "WebhookMetadataInvalid",
  "RawAgentOutputInvalid"
] as const;

export type CortexErrorCode = (typeof CortexErrorCodes)[number];

export class CortexError extends Error {
  readonly code: CortexErrorCode;

  constructor(code: CortexErrorCode, message: string) {
    super(message);
    this.name = "CortexError";
    this.code = code;
  }
}
