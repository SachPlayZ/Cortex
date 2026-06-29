import { calculateFundingTerms, type ParsedInvoice, type RiskPricing, type VerificationReport } from "@cortex/shared";

export function priceRisk(input: {
  invoiceId: string;
  parsed: ParsedInvoice;
  verification: VerificationReport;
  usdAmountCents: string;
  now?: Date;
}): RiskPricing {
  const amount = BigInt(input.usdAmountCents);
  const dueMs = Date.parse(`${input.parsed.due_date}T00:00:00.000Z`);
  const nowMs = (input.now ?? new Date()).getTime();
  const daysToDue = Math.ceil((dueMs - nowMs) / 86_400_000);
  let score = 100;

  if (input.parsed.extraction_confidence < 0.85) score -= 10;
  if (!input.parsed.buyer_domain) score -= 8;
  if (daysToDue > 60) score -= 15;
  else if (daysToDue > 45) score -= 8;
  if (amount > 200_000n) score -= 10;
  score -= Math.max(0, 100 - input.verification.verification_score);
  if (input.verification.hard_reject) score = Math.min(score, 49);
  score = Math.max(0, Math.min(100, score));

  const riskTier = score >= 85 ? "Low" : score >= 70 ? "MediumLow" : score >= 50 ? "Medium" : "Rejected";
  const discountBps = riskTier === "Low" ? 300 : riskTier === "MediumLow" ? 500 : riskTier === "Medium" ? 900 : 0;
  const terms = riskTier === "Rejected" ? undefined : calculateFundingTerms(amount, discountBps);

  return {
    invoice_id: input.invoiceId,
    risk_score: score,
    risk_tier: riskTier,
    discount_bps: discountBps,
    advance_rate_bps: terms?.advanceRateBps ?? 0,
    invoice_amount_usd_cents: amount.toString(),
    advance_amount_usd_cents: terms?.advanceAmountUsdCents.toString() ?? "0",
    repayment_amount_usd_cents: terms?.repaymentAmountUsdCents.toString() ?? amount.toString(),
    explanation: input.verification.hard_reject
      ? `Rejected: ${input.verification.reject_reasons.join(", ")}`
      : `Deterministic score ${score}; due in ${daysToDue} days.`,
    investor_summary: riskTier === "Rejected" ? "Not eligible for funding." : `${riskTier} receivable priced at ${discountBps} bps discount.`,
    seller_summary: riskTier === "Rejected" ? "Invoice rejected by verification." : `Advance rate ${terms?.advanceRateBps ?? 0} bps.`
  };
}
