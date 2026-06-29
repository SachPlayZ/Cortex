# 03 — Agents Plan

This file is for the agents subagent.

## Objective

Build a deterministic, testable multi-agent underwriting pipeline that turns an uploaded invoice into a Casper-ready receivable with USD-normalized amounts, verification results, a risk score, discount terms, and an attestation hash.

The agents must be useful, not decorative. They must perform concrete actions:

- Extract structured data.
- Convert invoice currency to USD.
- Verify document integrity.
- Pay for/check external services through x402-style protected endpoints.
- Score risk.
- Generate repayment reminder links.
- Monitor Dodo repayment state and Casper settlement state.

## Agent Architecture

```txt
Invoice Upload
  → Parser Agent
  → FX Normalization Agent
  → Verification Agent
  → Risk Pricing Agent
  → Attestation Agent
  → Repayment Reminder Agent
  → Settlement Monitor Agent
```

Use a simple orchestrator first. LangGraph is optional but useful.

## Shared Principles

### Determinism

LLM output must be validated by schemas. Never use raw LLM output directly.

### No Floating-Point Money

All money values become integer minor units:

```txt
original_amount_minor
usd_amount_cents
advance_amount_usd_cents
repayment_amount_usd_cents
```

### Agent Output Is Not Truth

Agent output must be:

1. Schema-validated.
2. Cross-checked.
3. Hashed.
4. Stored off-chain.
5. Referenced on-chain through `attestation_hash`.

### No Private Data On-Chain

Do not post buyer name, buyer email, invoice line items, PDF, or raw AI reasoning on-chain.

## Agent 1: Parser Agent

### Input

```txt
invoice_file: PDF | PNG | JPG
seller_wallet: string
```

### Output Schema

```ts
export const ParsedInvoiceSchema = z.object({
  invoice_number: z.string().min(1),
  seller_name: z.string().min(1),
  seller_email: z.string().email().optional(),
  buyer_name: z.string().min(1),
  buyer_email: z.string().email().optional(),
  buyer_domain: z.string().optional(),
  original_currency: z.string().length(3), // ISO 4217
  original_amount_decimal: z.string(),     // string, never number
  issue_date: z.string(),                  // ISO date
  due_date: z.string(),                    // ISO date
  payment_terms: z.string().optional(),
  line_items: z.array(z.string()).default([]),
  extraction_confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()).default([])
});
```

### Required Validations

- Currency must be ISO 4217 uppercase.
- Amount must parse as decimal greater than zero.
- Due date must be after issue date.
- Due date must be in the future for funding.
- Extraction confidence must be above threshold; use `0.75` for MVP.

### Implementation Notes

OCR options:

- Fastest: use LLM vision/OCR over uploaded image/PDF page.
- Safer: use a PDF text extractor first, then OCR fallback.
- x402 demo: wrap OCR behind `/api/x402/ocr`.

## Agent 2: FX Normalization Agent

### Objective

Convert any invoice currency to USD cents using the current/latest available FX rate.

### Recommended APIs

Primary:

- Frankfurter: https://frankfurter.dev/
- Latest rates endpoint example: `https://api.frankfurter.dev/v2/rates?base=EUR&quotes=USD`
- No API key required.

Fallback:

- ExchangeRate-API open access: https://www.exchangerate-api.com/docs/free
- Endpoint example: `https://open.er-api.com/v6/latest/USD`

### Input

```ts
{
  original_currency: string;
  original_amount_decimal: string;
  invoice_date: string;
}
```

### Output Schema

```ts
export const FxQuoteSchema = z.object({
  base_currency: z.string().length(3),
  quote_currency: z.literal("USD"),
  rate_decimal: z.string(),
  source: z.enum(["frankfurter", "exchange-rate-api", "manual-demo"]),
  source_timestamp: z.string(),
  fetched_at: z.string(),
  original_amount_minor: z.string(),
  usd_amount_cents: z.string(),
  fx_response_hash: z.string()
});
```

### Conversion Rules

Use decimal math library, not JS floats.

```txt
minor units:
  USD/EUR/GBP = 2 decimals
  INR = 2 decimals
  JPY = 0 decimals
  KWD/BHD = 3 decimals
```

Algorithm:

```txt
1. Parse original_amount_decimal with Decimal.js.
2. Fetch latest FX rate from original currency to USD.
3. usd_amount = original_amount * rate.
4. usd_amount_cents = round_half_up(usd_amount * 100).
5. Store rate source, timestamp, and response hash.
```

### Edge Cases

- If invoice currency is USD, rate = 1.
- If FX API does not support currency, reject or use manual demo override.
- Cache FX rates for at least 10 minutes in MVP to avoid rate-limit issues.
- Store the exact FX rate used; never recalculate after scoring.

## Agent 3: Verification Agent

### Objective

Detect fake, duplicate, malformed, or high-risk invoices before they reach investors.

### Checks

```txt
1. Duplicate invoice hash check.
2. Invoice number uniqueness for seller.
3. Due date in future.
4. Buyer domain/email shape valid.
5. Seller wallet is not empty.
6. Amount is within demo bounds.
7. Required fields present.
8. Currency conversion completed.
9. Document confidence high enough.
10. Optional buyer domain lookup.
```

### Output Schema

```ts
export const VerificationReportSchema = z.object({
  invoice_id: z.string(),
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
  x402_receipts: z.array(z.object({
    service: z.string(),
    endpoint: z.string(),
    payment_proof_hash: z.string(),
    response_hash: z.string(),
    amount_paid: z.string()
  })),
  verification_score: z.number().min(0).max(100),
  hard_reject: z.boolean(),
  reject_reasons: z.array(z.string())
});
```

### Hard Reject Conditions

```txt
duplicate_invoice_hash == true
invoice_amount_usd_cents <= 0
due_date <= now
missing buyer name
missing invoice number
extraction_confidence < 0.75
unsupported currency
```

## Agent 4: Risk Pricing Agent

### Objective

Set a risk score and discount rate.

### Inputs

- Parsed invoice.
- FX quote.
- Verification report.
- Seller history.
- Buyer history if available.

### Risk Score Formula

MVP deterministic scoring:

```txt
score = 100

- document_penalty
- duplicate_penalty
- due_date_penalty
- amount_penalty
- buyer_domain_penalty
- seller_history_penalty
- verification_penalty
```

Suggested penalties:

```txt
document confidence 0.75–0.85: -10
missing buyer domain: -8
due in >45 days: -8
due in >60 days: -15
invoice > $2,000 demo bound: -10
new seller with no history: -5
duplicate warning: hard reject
```

### Tiers

```txt
90–100: Low
80–89: MediumLow
65–79: Medium
50–64: High
<50: Rejected
```

### Discount Mapping

```txt
Low:       250–400 bps
MediumLow: 400–700 bps
Medium:    700–1200 bps
High:      reject in MVP
Rejected:  reject
```

MVP formula:

```txt
if score >= 90: discount_bps = 300
if score >= 80: discount_bps = 500
if score >= 65: discount_bps = 900
else: reject
advance_rate_bps = 10000 - discount_bps
advance_amount_usd_cents = floor(usd_amount_cents * advance_rate_bps / 10000)
repayment_amount_usd_cents = usd_amount_cents
```

### Output Schema

```ts
export const RiskPricingSchema = z.object({
  invoice_id: z.string(),
  risk_score: z.number().int().min(0).max(100),
  risk_tier: z.enum(["Low", "MediumLow", "Medium", "High", "Rejected"]),
  discount_bps: z.number().int().min(0).max(3000),
  advance_rate_bps: z.number().int().min(0).max(10000),
  invoice_amount_usd_cents: z.string(),
  advance_amount_usd_cents: z.string(),
  repayment_amount_usd_cents: z.string(),
  explanation: z.string(),
  investor_summary: z.string(),
  seller_summary: z.string()
});
```

## Agent 5: Attestation Agent

### Objective

Produce a canonical JSON attestation and hash it for Casper.

### Attestation JSON

```json
{
  "version": "cortex-attestation-v1",
  "invoice_id": "...",
  "invoice_hash": "...",
  "evidence_hash": "...",
  "buyer_hash": "...",
  "seller_wallet": "...",
  "original_currency": "INR",
  "original_amount_minor": "8300000",
  "fx": {
    "quote_currency": "USD",
    "rate_decimal": "0.012000",
    "source": "frankfurter",
    "source_timestamp": "2026-06-28T00:00:00Z",
    "usd_amount_cents": "99600"
  },
  "verification": {
    "duplicate_invoice_hash": false,
    "due_date_valid": true,
    "buyer_domain_valid": true,
    "extraction_confidence_ok": true
  },
  "risk": {
    "risk_score": 92,
    "risk_tier": "Low",
    "discount_bps": 300,
    "advance_rate_bps": 9700,
    "advance_amount_usd_cents": "96612",
    "repayment_amount_usd_cents": "99600"
  },
  "agent": {
    "agent_id": "cortex-underwriter-v1",
    "model": "...",
    "created_at": "..."
  }
}
```

### Hashing Rule

Use stable canonical JSON serialization.

```txt
attestation_hash = sha256(canonical_json(attestation))
```

The contract stores only `attestation_hash`.

## Agent 6: Repayment Reminder Agent

### Objective

Create Dodo checkout session links and send buyer reminders.

### Required Input

```ts
{
  invoice_id: string;
  buyer_email: string;
  repayment_amount_usd_cents: string;
  due_date: string;
}
```

### Dodo Checkout Metadata

When creating checkout session, include metadata:

```json
{
  "invoice_id": "...",
  "seller_wallet": "...",
  "casper_invoice_id": "...",
  "expected_amount_usd_cents": "100000",
  "purpose": "cortex_invoice_repayment"
}
```

### Reminder Schedule

For MVP, use manual buttons and logs. For a production-like demo:

```txt
T-7 days: polite reminder
T-3 days: reminder with checkout link
T-1 day: final reminder
T+1 day: overdue notice
```

### Output

```ts
export const ReminderResultSchema = z.object({
  invoice_id: z.string(),
  checkout_session_id: z.string(),
  checkout_url: z.string().url(),
  reminder_status: z.enum(["created", "sent", "failed"]),
  reminder_hash: z.string()
});
```

## Agent 7: Settlement Monitor Agent

### Objective

Monitor Dodo payment state, backend relay state, and Casper state.

### Responsibilities

- Confirm Dodo webhook arrived.
- Confirm webhook was verified.
- Confirm relay transaction was submitted.
- Confirm Casper invoice status became `Repaid`.
- If investor claim completed, confirm `Settled`.

### State Sync

Use CSPR.cloud REST/Streaming API for dashboard state.

## x402 Tooling Design

Build internal x402-protected endpoints for demo:

```txt
POST /api/x402/ocr
POST /api/x402/company-lookup
POST /api/x402/domain-verify
POST /api/x402/fx-quote
POST /api/x402/reminder-send
```

Expected behavior:

1. Agent requests service.
2. Service responds `402 Payment Required` with payment challenge.
3. Agent signs/retries with payment proof.
4. Service validates proof and returns data.
5. Agent stores x402 receipt.

If full x402 integration blocks progress, mock the exact challenge/proof flow but keep the interface identical.

## Agent API Routes

```txt
POST /api/agent/run-underwriting
POST /api/agent/extract
POST /api/agent/fx
POST /api/agent/verify
POST /api/agent/score
POST /api/agent/attest
POST /api/agent/create-reminder
GET  /api/agent/runs/:invoice_id
```

## Required Tests

### Parser Agent

- extracts USD invoice.
- extracts INR invoice and preserves currency.
- rejects missing amount.
- rejects missing due date.
- rejects due date before issue date.
- confidence below threshold creates hard reject.

### FX Agent

- USD to USD returns rate 1.
- INR to USD returns integer cents.
- unsupported currency rejects.
- invalid decimal rejects.
- API failure uses fallback or returns controlled error.
- repeated calls use cached rate.

### Verification Agent

- duplicate invoice hash rejects.
- duplicate invoice number for same seller warns or rejects.
- future due date passes.
- past due date rejects.
- missing buyer rejects.
- missing domain reduces score but does not always reject.

### Risk Agent

- low-risk invoice gets low discount.
- medium invoice gets higher discount.
- hard rejected invoice cannot get funding terms.
- all bps math matches contract expectations.
- advance + discount = 10_000 bps invariant.

### Attestation Agent

- canonical hash is stable.
- changing any material field changes hash.
- private fields are not included in on-chain calldata.

### Reminder/Settlement Agent

- creates Dodo checkout with invoice metadata.
- does not trust return URL status.
- webhook must be verified before settlement.
- duplicate webhook is idempotent.
- underpayment does not trigger Casper repayment.

## Docs To Reference

- Casper AI Toolkit: https://www.casper.network/ai
- Casper x402 examples: https://github.com/casper-ecosystem/x402
- CSPR.cloud docs: https://docs.cspr.cloud/
- CSPR.click docs: https://docs.cspr.click/
- Dodo Payments docs: https://docs.dodopayments.com/
- Dodo one-time integration: https://docs.dodopayments.com/developer-resources/integration-guide
- Dodo testing: https://docs.dodopayments.com/miscellaneous/testing-process
- Dodo CLI: https://docs.dodopayments.com/developer-resources/sdks/cli
- Frankfurter FX API: https://frankfurter.dev/
- ExchangeRate-API fallback: https://www.exchangerate-api.com/docs/free
- Zod: https://zod.dev/
- Decimal.js: https://mikemcl.github.io/decimal.js/
