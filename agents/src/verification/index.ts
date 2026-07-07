import { hashJson, type FxQuote, type ParsedInvoice, type VerificationReport } from "@cortex/shared";

export type VerificationInput = {
  invoiceId: string;
  invoiceHash: `0x${string}`;
  sellerWallet: string;
  parsed: ParsedInvoice;
  fx: FxQuote;
  existingInvoiceHashes?: ReadonlySet<string>;
  existingSellerInvoiceNumbers?: ReadonlySet<string>;
  now?: Date;
};

export function verifyInvoice(input: VerificationInput): VerificationReport {
  const usdAmount = BigInt(input.fx.usd_amount_cents);
  const duplicateInvoiceHash = input.existingInvoiceHashes?.has(input.invoiceHash) ?? false;
  const duplicateInvoiceNumberForSeller =
    input.existingSellerInvoiceNumbers?.has(input.parsed.invoice_number) ?? false;
  const dueDateValid = Date.parse(`${input.parsed.due_date}T00:00:00.000Z`) > (input.now ?? new Date()).getTime();
  const buyerDomainValid = input.parsed.buyer_domain ? /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(input.parsed.buyer_domain) : false;
  const requiredFieldsPresent = Boolean(input.parsed.invoice_number && input.parsed.buyer_name && input.sellerWallet);
  const amountWithinBounds = usdAmount > 0n && usdAmount <= 250_000n;
  const fxRateAvailable = BigInt(input.fx.usd_amount_cents) > 0n;
  const extractionConfidenceOk = input.parsed.extraction_confidence >= 0.75;
  const rejectReasons: string[] = [];

  if (duplicateInvoiceHash) rejectReasons.push("duplicate_invoice_hash");
  if (duplicateInvoiceNumberForSeller) rejectReasons.push("duplicate_invoice_number_for_seller");
  if (!dueDateValid) rejectReasons.push("due_date_not_future");
  if (!requiredFieldsPresent) rejectReasons.push("required_fields_missing");
  if (!amountWithinBounds) rejectReasons.push("amount_outside_demo_bounds");
  if (!fxRateAvailable) rejectReasons.push("fx_rate_missing");
  if (!extractionConfidenceOk) rejectReasons.push("low_extraction_confidence");

  const hardReject = rejectReasons.length > 0;
  const verificationScore = Math.max(
    0,
    100 -
      (duplicateInvoiceHash ? 100 : 0) -
      (duplicateInvoiceNumberForSeller ? 100 : 0) -
      (!dueDateValid ? 30 : 0) -
      (!buyerDomainValid ? 8 : 0) -
      (!requiredFieldsPresent ? 40 : 0) -
      (!amountWithinBounds ? 20 : 0) -
      (!fxRateAvailable ? 30 : 0) -
      (!extractionConfidenceOk ? 30 : 0)
  );

  return {
    invoice_id: input.invoiceId,
    checks: {
      duplicate_invoice_hash: duplicateInvoiceHash,
      duplicate_invoice_number_for_seller: duplicateInvoiceNumberForSeller,
      due_date_valid: dueDateValid,
      buyer_domain_valid: buyerDomainValid,
      required_fields_present: requiredFieldsPresent,
      amount_within_bounds: amountWithinBounds,
      fx_rate_available: fxRateAvailable,
      extraction_confidence_ok: extractionConfidenceOk
    },
    x402_receipts: [
      {
        service: "domain-verify",
        endpoint: "/api/x402/domain-verify",
        payment_proof_hash: hashJson({ invoiceId: input.invoiceId, service: "domain-verify" }),
        response_hash: hashJson({ buyerDomainValid }),
        amount_paid: "0"
      }
    ],
    verification_score: verificationScore,
    hard_reject: hardReject,
    reject_reasons: rejectReasons
  };
}
