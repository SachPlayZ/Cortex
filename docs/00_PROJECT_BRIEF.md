# 00 — Project Brief

## Product Name

**Cortex**

## One-Liner

Freelancers upload unpaid invoices, AI agents verify and price risk, and investors fund short-term receivables on Casper.

## Problem

Freelancers, agencies, and small businesses often wait 15–60 days to get paid. They need faster liquidity, while investors want short-duration yield backed by understandable real-world cash flows.

## Solution

Cortex converts an invoice into a verifiable financing workflow:

```txt
Invoice PDF → AI Verification → USD Normalization → Risk Score → Casper Receivable → Investor Funding → Dodo Repayment → Casper Settlement
```

## Personas

### Seller / Freelancer

Wants early liquidity against an unpaid invoice.

MVP actions:

- Connect Casper wallet.
- Upload invoice PDF/image.
- Review extracted fields.
- Accept AI-priced funding terms.
- Mint/list the receivable.
- Receive testnet funding from investor.

### Investor

Wants to fund short-term receivables and earn yield.

MVP actions:

- Browse open invoices.
- Inspect risk score, discount, due date, AI checks.
- Fund one invoice.
- Claim repayment/yield after Dodo webhook settlement.

### Buyer / Debtor

The party that owes the invoice amount.

MVP actions:

- Opens a Dodo Test Mode checkout link.
- Pays the invoice in test mode.
- Payment success webhook triggers on-chain repayment recording.

### Underwriting Agent

Autonomous system that turns unstructured invoice evidence into a priced receivable.

MVP actions:

- Extract invoice fields.
- Convert currency to USD.
- Check buyer/domain/invoice integrity.
- Price risk.
- Store attestation.
- Initiate repayment reminders.
- Trigger settlement monitoring.

### Settlement Relayer

Backend service account that connects verified Dodo webhooks to Casper transactions.

MVP actions:

- Verify Dodo webhook signature.
- Enforce idempotency.
- Validate paid amount and invoice metadata.
- Submit Casper transaction recording repayment.
- Update off-chain payment state.

## Canonical Money Model

All invoice values are normalized into **USD cents** off-chain by the agent.

Why USD cents:

- Avoid floating-point bugs.
- Dodo checkout is naturally fiat-style.
- Risk/yield math becomes deterministic.
- On-chain contract can store integer cents even if settlement uses mock CSPR/cUSD units.

Example:

```txt
Invoice: ₹83,000
FX rate: 1 INR = 0.012 USD
USD amount: 996.00 USD
Canonical amount: 99,600 cents
```

## Core Financial Terms

```txt
invoice_amount_usd_cents = face value converted to USD cents
advance_rate_bps = percentage paid early to seller
advance_amount_usd_cents = invoice_amount_usd_cents * advance_rate_bps / 10_000
repayment_amount_usd_cents = invoice_amount_usd_cents
discount_bps = 10_000 - advance_rate_bps
investor_yield_cents = repayment_amount_usd_cents - advance_amount_usd_cents
```

Example:

```txt
Face value: $1,000.00
Risk tier: Low
Discount: 3.50%
Advance rate: 96.50%
Seller receives: $965.00
Buyer repays: $1,000.00
Investor receives: $1,000.00
Investor yield: $35.00
```

## Main State Machine

```txt
DRAFT
  → PARSED
  → VERIFIED
  → SCORED
  → LISTED
  → FUNDED
  → REPAYMENT_PENDING
  → REPAID
  → SETTLED

Failure branches:
  PARSED/VERIFIED/SCORED → REJECTED
  FUNDED/REPAYMENT_PENDING → DEFAULTED
  Any pre-funding state → CANCELLED
  Any suspicious state → DISPUTED
```

## Success Criteria

The demo is successful if it proves all of these:

1. Invoice upload creates an evidence hash.
2. Agent extracts structured fields.
3. Agent converts original invoice currency into USD cents using a current FX rate.
4. Agent posts risk score and terms.
5. Casper Testnet records invoice creation/listing/funding.
6. Investor funding changes on-chain invoice state.
7. Dodo Test Mode checkout is created for buyer repayment.
8. Dodo webhook is verified server-side.
9. Verified webhook triggers a Casper repayment transaction.
10. Investor can claim repayment/yield.
11. Agent reputation updates based on settlement outcome.

## MVP Anti-Bug Rules

- Never store private invoice PDFs on-chain.
- Never use floats for money.
- Never mark invoice repaid from frontend.
- Never trust Dodo redirect URL as payment proof.
- Only trust verified Dodo webhook payloads.
- Webhook must be idempotent.
- Every external payment must map to exactly one invoice.
- Repayment cannot be recorded twice.
- Funding cannot happen before scoring/listing.
- Seller cannot fund their own invoice.
- Investor cannot claim before repayment is recorded.
