# AGENTS.md — Cortex Coding Agent Instructions

This file is the root operating manual for Codex or any coding subagent working on Cortex.

Cortex is an AI-underwritten invoice financing marketplace on Casper. Freelancers upload unpaid web2 invoices, agents verify and price risk, the invoice becomes an on-chain receivable, investors fund it, and repayment is triggered through Dodo Payments Test Mode checkout + verified webhook + Casper settlement transaction.

The goal is not to build a broad app. The goal is to build one flawless demo path with rigorous state, repayment, and safety logic.

---

## 0. Read This First

Before writing code, read these docs in order:

1. `README.md`
2. `00_PROJECT_BRIEF.md`
3. `01_SYSTEM_ARCHITECTURE.md`
4. `02_CONTRACTS.md`
5. `03_AGENTS.md`
6. `04_FRONTEND_APPLICATION.md`
7. `05_INTEGRATIONS.md`
8. `06_TESTING_AND_SECURITY.md`
9. `07_SUBAGENT_TASKS.md`
10. `08_DEMO_AND_SUBMISSION.md`
11. `09_REFERENCE_LINKS.md`
12. `.env.example.md`
13. This file, `AGENTS.md`

If any implementation detail conflicts with this file, follow this file first, then the more specific docs.

---

## 1. Product Contract

Build this exact MVP:

```txt
Seller uploads invoice
→ Parser Agent extracts amount, currency, buyer, due date, terms
→ FX Agent normalizes original currency into USD cents
→ Verification Agent checks duplicate hash, buyer/domain, invoice validity, due date
→ Risk Agent generates risk tier, discount, advance amount, repayment amount
→ Seller accepts terms and mints/lists receivable on Casper Testnet
→ Investor funds the receivable on Casper Testnet
→ Buyer pays through Dodo Payments Test Mode hosted checkout
→ Dodo sends signed webhook to backend
→ Backend verifies webhook, validates amount and metadata, enforces idempotency
→ Settlement Relayer submits repayment transaction to Casper
→ Investor claims repayment/yield
→ Agent reputation updates
```

The repayment must not be a fake frontend button. A fake button may exist only as a dev-only emergency tool behind `NODE_ENV !== "production"`, and it must never be used in the main demo.

---

## 2. Non-Negotiable Architecture Rules

### 2.1 Casper Is the Financial Source of Truth

The Casper contracts are the canonical source of truth for:

- Invoice lifecycle status.
- Seller account.
- Investor account.
- Invoice amount in USD cents.
- Advance amount in USD cents.
- Repayment amount in USD cents.
- Funding status.
- Repayment status.
- Settlement status.
- Gateway payment hash usage.
- Agent reputation.
- Evidence hash and attestation hash.

Backend database state is only a cache/orchestration layer. If backend state disagrees with Casper, Casper wins.

### 2.2 Web2 Repayment Must Be Verified Before On-Chain Recording

A Dodo return URL is not proof of payment.

Only a verified Dodo webhook can trigger repayment recording.

The webhook handler must check:

```txt
1. Signature is valid using Dodo/Standard Webhooks verification.
2. Event is a successful payment event according to current Dodo docs.
3. Payment ID / gateway payment hash has not been used before.
4. Metadata contains invoice_id.
5. Metadata expected amount matches local invoice record.
6. Paid amount >= repayment_amount_usd_cents.
7. Currency is USD or the final settled value is normalized to USD cents.
8. Invoice status is RepaymentPending on Casper before relayer submits tx.
```

If any check fails, do not submit a Casper repayment transaction.

### 2.3 No Floating Point for Money

Never use JavaScript `number` for money calculations.

Use:

- `bigint` for integer cents/minor units.
- `decimal.js` only at parsing/conversion boundaries.
- Integer basis points for percentages.

Canonical units:

```txt
original_amount_minor: bigint
original_currency: ISO-4217 string
usd_amount_cents: bigint
advance_amount_usd_cents: bigint
repayment_amount_usd_cents: bigint
discount_bps: integer
advance_rate_bps: integer
fx_rate_scaled: bigint
fx_rate_scale: bigint, recommended 1_000_000_000n
```

### 2.4 LLM Output Is Untrusted

Never write raw LLM output to contracts.

Every agent output must be:

```txt
LLM/tool output
→ schema validation
→ deterministic normalization
→ cross-checks
→ attestation JSON
→ content hash
→ on-chain hash reference only
```

Use Zod or Pydantic schemas. Reject malformed outputs.

### 2.5 Private Invoice Data Must Not Go On-Chain

Do not put these on-chain:

- Buyer name.
- Buyer email.
- Seller legal name.
- Full invoice PDF.
- Invoice line items.
- Raw OCR text.
- Full AI reasoning.
- Any real personal/business data.

Use hashes:

```txt
evidence_hash
buyer_hash
attestation_hash
payment_terms_hash
fx_attestation_hash
```

### 2.6 One Invoice → One Investor for MVP

Do not build multi-investor fractionalization unless all MVP tests are already passing.

MVP constraint:

```txt
one invoice_id
one seller
one investor
one funding transaction
one Dodo repayment
one investor claim
```

---

## 3. Repository Layout

Expected project structure:

```txt
cortex/
  AGENTS.md
  README.md
  .env.example
  package.json
  pnpm-workspace.yaml

  apps/
    web/
      app/
      components/
      lib/
      server/
      tests/

  contracts/
    invoice_registry/
    funding_vault/
    repayment_escrow/
    agent_reputation/
    mock_usd/
    tests/
    scripts/
    README.md

  agents/
    src/
      orchestrator/
      parser/
      fx/
      verification/
      risk/
      attestation/
      reminder/
      settlement-monitor/
      x402-tools/
    tests/
    README.md

  packages/
    shared/
      src/
        schemas/
        money/
        hashing/
        constants/
        contract-types/
      tests/

  docs/
    00_PROJECT_BRIEF.md
    01_SYSTEM_ARCHITECTURE.md
    02_CONTRACTS.md
    03_AGENTS.md
    04_FRONTEND_APPLICATION.md
    05_INTEGRATIONS.md
    06_TESTING_AND_SECURITY.md
    07_SUBAGENT_TASKS.md
    08_DEMO_AND_SUBMISSION.md
    09_REFERENCE_LINKS.md
```

If the repo starts empty, create this layout.

If the repo already exists, adapt to current structure, but preserve these boundaries.

---

## 4. Implementation Order

Build in this order. Do not skip ahead.

### Phase 1 — Shared Types and Money Safety

Start with `packages/shared`.

Deliver:

- Invoice schemas.
- Agent output schemas.
- Payment webhook schemas.
- Money conversion helpers.
- Hashing helpers.
- Status enums.
- Error codes.

Required tests:

```txt
pnpm --filter @cortex/shared test
```

Required functionality:

- Convert decimal money strings into minor units safely.
- Convert original currency into USD cents using fixed-point rates.
- Calculate advance and repayment amounts with bps math.
- Reject invalid currency codes.
- Reject negative/zero amounts.
- Generate deterministic hashes.

### Phase 2 — Contracts

Build Casper contracts next.

Deliver:

- `InvoiceRegistry`
- `FundingVault`
- `RepaymentEscrow`
- `AgentReputation`
- Optional `MockUSD`

Required behavior:

```txt
Created → Scored → Listed → Funded → RepaymentPending → Repaid → Settled
```

Failure branches:

```txt
Created/Scored/Listed → Cancelled
Created/Scored → Rejected
Funded/RepaymentPending → Defaulted
Any active state → Disputed
```

Required tests:

- All state transitions.
- All authorization boundaries.
- Duplicate invoice hash rejection.
- Duplicate gateway payment hash rejection.
- Underpayment rejection.
- Claim-before-repayment rejection.
- Claim-twice rejection.
- Seller self-funding rejection.
- Past due-date default behavior.
- Agent reputation update behavior.

### Phase 3 — Backend + Agent Pipeline

Build deterministic agent orchestration.

Deliver:

- Parser Agent.
- FX Normalization Agent.
- Verification Agent.
- Risk Pricing Agent.
- Attestation Agent.
- Reminder Agent stub.
- Settlement Monitor Agent stub.
- x402-style protected service wrappers.

Required tests:

- Valid invoice parsing.
- Missing amount rejection.
- Bad currency rejection.
- INR → USD conversion using current/cached rate.
- Duplicate invoice detection.
- Risk pricing deterministic ranges.
- Attestation hash determinism.

### Phase 4 — Dodo Repayment Integration

Build repayment before UI polish.

Deliver:

- Create checkout endpoint.
- Dodo webhook endpoint.
- Signature verification.
- Idempotency storage.
- Relayer queue or direct relayer call.
- Casper repayment transaction submission.

Required tests:

- Valid webhook records repayment.
- Invalid signature rejected.
- Duplicate webhook ignored safely.
- Underpayment rejected.
- Wrong invoice metadata rejected.
- Return URL does not mark paid.
- Relayer failure is retryable and does not double-spend.

### Phase 5 — Frontend

Build UI after core logic works.

Required routes:

```txt
/
/seller
/seller/upload
/seller/invoices
/investor
/invoice/[invoiceId]
/buyer/pay/[invoiceId]
/agent
/admin
/checkout/success
/checkout/cancel
```

Required UI proof points:

- Agent trace.
- FX conversion display.
- Risk score and discount math.
- Casper transaction hashes.
- Dodo checkout link.
- Webhook-confirmed repayment status.
- Investor claim button.

### Phase 6 — End-to-End Demo Hardening

Deliver:

- Three sample invoices:
  - Low-risk INR invoice.
  - Medium-risk USD invoice.
  - Fake/duplicate invoice.
- Demo seed script.
- End-to-end test script.
- README instructions.
- Demo video script.

---

## 5. Subagent Ownership

Use this section to split Codex work into parallel threads.

### Contracts Subagent

Owns:

```txt
contracts/**
docs/02_CONTRACTS.md
packages/shared/src/contract-types/**
```

Must not modify:

```txt
apps/web/**
agents/**
```

Except to add generated contract metadata/types after deployment.

Primary mission:

> Implement the Casper contract lifecycle so no invalid funding, repayment, or claim state can occur.

Acceptance criteria:

- Full state machine passes tests.
- No duplicate invoice hash.
- No duplicate gateway payment hash.
- Only registered settlement relayer records repayment.
- Only registered agent posts risk score.
- Investor cannot claim before repayment.
- Seller cannot fund own invoice.

### Agents Subagent

Owns:

```txt
agents/**
packages/shared/src/schemas/**
packages/shared/src/money/**
packages/shared/src/hashing/**
docs/03_AGENTS.md
```

Primary mission:

> Turn uploaded invoice evidence into a deterministic, schema-validated, USD-normalized receivable proposal.

Acceptance criteria:

- No raw LLM output escapes validation.
- No floating-point money calculations.
- FX conversion is timestamped and hashable.
- Duplicate invoice detection works.
- Risk score produces stable discount ranges.
- Attestation hash is deterministic.

### Frontend Subagent

Owns:

```txt
apps/web/app/**
apps/web/components/**
apps/web/lib/client/**
docs/04_FRONTEND_APPLICATION.md
```

Primary mission:

> Make the demo feel like a real product while accurately reflecting backend and Casper state.

Acceptance criteria:

- Seller upload flow works.
- Investor marketplace works.
- Buyer Dodo checkout flow works.
- Agent dashboard shows trace.
- Casper tx hashes are visible.
- Frontend never marks repayment as complete from return URL alone.

### Integrations Subagent

Owns:

```txt
apps/web/server/integrations/**
apps/web/app/api/payments/**
apps/web/app/api/webhooks/**
apps/web/app/api/casper/**
docs/05_INTEGRATIONS.md
```

Primary mission:

> Make CSPR.click, CSPR.cloud, Dodo Test Mode, FX APIs, and x402-style services work together safely.

Acceptance criteria:

- Dodo checkout includes immutable metadata.
- Dodo webhook signature verification is correct.
- Payment ID idempotency is enforced.
- Relayer submits Casper repayment transaction only after verified webhook.
- FX rates are cached with TTL and timestamped.

### QA/Security Subagent

Owns:

```txt
tests/**
apps/web/tests/**
contracts/tests/**
agents/tests/**
packages/shared/tests/**
docs/06_TESTING_AND_SECURITY.md
```

Primary mission:

> Break the system before judges do.

Acceptance criteria:

- Contract test matrix from `06_TESTING_AND_SECURITY.md` passes.
- Webhook replay tests pass.
- Underpayment tests pass.
- E2E demo path passes.
- No secrets are committed.
- No private invoice fields go on-chain.

### Docs/Demo Subagent

Owns:

```txt
README.md
docs/**
samples/**
```

Primary mission:

> Make the project easy to run, judge, and demo.

Acceptance criteria:

- Setup instructions work from a fresh clone.
- Demo script matches actual UI.
- Testnet deploy addresses are documented.
- Sample invoice assets are included or generated.
- Architecture diagram is up to date.

---

## 6. Required Commands

Prefer `pnpm`.

If scripts do not exist, create them.

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Suggested package scripts:

```json
{
  "scripts": {
    "dev": "pnpm --filter @cortex/web dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "test:e2e": "pnpm --filter @cortex/web test:e2e",
    "test:contracts": "pnpm --filter @cortex/contracts test",
    "test:agents": "pnpm --filter @cortex/agents test",
    "test:shared": "pnpm --filter @cortex/shared test"
  }
}
```

Contracts may need Rust/Odra-specific commands. Add them under `contracts/README.md` and wire them into root scripts where practical.

---

## 7. External Docs To Check Before Implementing

Always verify current docs before implementing these integrations.

### Casper

- Casper AI Toolkit: https://www.casper.network/ai
- Casper Developer Docs: https://docs.casper.network/
- Odra docs: https://odra.dev/docs/
- Odra Casper backend: https://odra.dev/docs/backends/casper/
- CSPR.click docs: https://docs.cspr.click/
- CSPR.click React: https://docs.cspr.click/cspr.click-sdk/react
- CSPR.click signing transactions: https://docs.cspr.click/cspr.click-sdk/react/signing-transactions
- CSPR.cloud docs: https://docs.cspr.cloud/
- CSPR.cloud overview: https://docs.cspr.cloud/documentation/overview
- Casper x402 examples: https://github.com/casper-ecosystem/x402

### Dodo Payments

- Dodo docs: https://docs.dodopayments.com/
- One-time payments integration: https://docs.dodopayments.com/developer-resources/integration-guide
- Testing process: https://docs.dodopayments.com/miscellaneous/testing-process
- Standard Webhooks: https://standardwebhooks.com/

### FX / Money

- Frankfurter: https://frankfurter.dev/
- Frankfurter latest rates: https://api.frankfurter.dev/v2/rates
- ExchangeRate-API Open Access: https://www.exchangerate-api.com/docs/free
- Decimal.js: https://mikemcl.github.io/decimal.js/

### App Stack

- Next.js: https://nextjs.org/docs
- Tailwind CSS: https://tailwindcss.com/docs
- shadcn/ui: https://ui.shadcn.com/
- Zod: https://zod.dev/
- Playwright: https://playwright.dev/
- Vitest: https://vitest.dev/

---

## 8. Contract Design Requirements

### 8.1 Required Contract Interfaces

Expose these operations, even if exact Casper/Odra syntax differs:

```txt
create_invoice(invoice_hash, buyer_hash, amount_usd_cents, due_timestamp, payment_terms_hash)
post_risk_score(invoice_id, risk_score, risk_tier, discount_bps, advance_amount_usd_cents, repayment_amount_usd_cents, attestation_hash)
list_invoice(invoice_id)
fund_invoice(invoice_id)
record_gateway_repayment(invoice_id, gateway_payment_hash, paid_amount_usd_cents, payment_attestation_hash)
claim_repayment(invoice_id)
mark_default_after_due(invoice_id)
get_invoice(invoice_id)
get_investor_position(invoice_id)
get_agent_profile(agent_account)
```

### 8.2 Authorization

```txt
create_invoice: seller
post_risk_score: registered underwriting agent only
list_invoice: seller only
fund_invoice: investor, not seller
record_gateway_repayment: registered settlement relayer only
claim_repayment: invoice investor only
mark_default_after_due: public or relayer, but only after due date
update_agent_reputation: internal contract flow or authorized settlement contract only
```

### 8.3 Gateway Payment Idempotency

`gateway_payment_hash` must be globally unique.

If the same webhook/payment is received again, it must not produce a second repayment.

Contract-level protection is mandatory. Backend-level protection is not enough.

### 8.4 Underpayment Must Revert

If:

```txt
paid_amount_usd_cents < repayment_amount_usd_cents
```

then `record_gateway_repayment` must fail.

### 8.5 Event Requirements

Emit events for:

```txt
InvoiceCreated
InvoiceScored
InvoiceListed
InvoiceFunded
GatewayRepaymentRecorded
InvoiceSettled
InvoiceDefaulted
InvestorClaimed
AgentReputationUpdated
```

Frontend and CSPR.cloud indexing rely on these events.

---

## 9. Agent Design Requirements

### 9.1 Parser Agent

Extract:

```txt
invoice_number
seller_name
seller_email optional
buyer_name
buyer_email optional
buyer_domain optional
original_amount
original_currency
issue_date
due_date
payment_terms
line_items optional
confidence
```

Reject if:

- No amount.
- No currency.
- No due date.
- Due date is in the past.
- Confidence is below threshold.

### 9.2 FX Normalization Agent

Input:

```txt
original_amount
original_currency
invoice_date or current timestamp
```

Output:

```txt
usd_amount_cents
fx_rate_scaled
fx_provider
fx_timestamp
fx_attestation_hash
```

Use current FX rate for MVP. Cache rates for a short TTL.

Reject if FX provider fails and no fresh cached rate exists.

### 9.3 Verification Agent

Check:

```txt
invoice_hash unique
buyer_hash deterministic
buyer domain format valid when present
due date in future
amount within allowed MVP range
invoice shape complete
seller wallet present
not already funded/listed
```

### 9.4 Risk Pricing Agent

Risk tiers:

```txt
85–100: Low
70–84: MediumLow
50–69: Medium
0–49: Rejected
```

Discount ranges:

```txt
Low: 250–400 bps
MediumLow: 400–700 bps
Medium: 700–1200 bps
Rejected: no listing
```

Calculate:

```txt
advance_amount_usd_cents = invoice_amount_usd_cents * (10000 - discount_bps) / 10000
repayment_amount_usd_cents = invoice_amount_usd_cents
investor_yield_usd_cents = repayment_amount_usd_cents - advance_amount_usd_cents
```

### 9.5 Attestation Agent

Build canonical JSON:

```json
{
  "schema_version": "cortex-attestation-v1",
  "invoice_hash": "...",
  "buyer_hash": "...",
  "usd_amount_cents": "...",
  "original_currency": "INR",
  "original_amount_minor": "...",
  "fx_provider": "frankfurter",
  "fx_timestamp": "...",
  "risk_score": 82,
  "risk_tier": "Low",
  "discount_bps": 350,
  "advance_amount_usd_cents": "...",
  "repayment_amount_usd_cents": "...",
  "agent_id": "cortex-underwriter-v1",
  "created_at": "..."
}
```

Hash canonical JSON deterministically. Store full JSON off-chain. Store only hash on-chain.

---

## 10. Dodo Payments Requirements

### 10.1 Checkout Creation

Endpoint:

```txt
POST /api/payments/dodo/create-checkout
```

Input:

```txt
invoice_id
buyer_email optional
```

Server must:

```txt
1. Read invoice from DB and Casper.
2. Require invoice status RepaymentPending.
3. Create Dodo Test Mode checkout for repayment_amount_usd_cents.
4. Include metadata:
   - invoice_id
   - invoice_hash
   - expected_amount_usd_cents
   - nonce
   - environment=test_mode
5. Store checkout session ID and nonce.
6. Return hosted checkout URL.
```

### 10.2 Webhook Handling

Endpoint:

```txt
POST /api/webhooks/dodo
```

Important:

- Use raw request body for signature verification.
- Do not parse JSON before verifying if the webhook library requires raw bytes.
- Use current Dodo + Standard Webhooks docs for exact header names.

Handler flow:

```txt
receive webhook
→ verify signature
→ parse event
→ confirm successful payment event type
→ read invoice_id from metadata
→ validate amount/currency/metadata
→ check local idempotency table
→ query Casper invoice state
→ submit record_gateway_repayment to Casper
→ store Casper deploy hash
→ mark local repayment as submitted/confirmed
```

### 10.3 Relayer Idempotency

Use both:

```txt
backend idempotency table
contract gateway_payment_hash registry
```

Relayer retry must be safe.

If Casper tx submission fails after local webhook receipt, store a retryable job.

Do not lose the repayment event.

---

## 11. Frontend Requirements

### 11.1 Seller Upload Flow

Must show:

```txt
1. File uploaded
2. Invoice hash generated
3. Parser result
4. FX conversion
5. Verification checks
6. Risk score
7. Funding terms
8. Mint/list transaction
```

### 11.2 Investor Marketplace

Must show:

```txt
invoice_id
risk_tier
risk_score
due_date
invoice_amount_usd
advance_amount_usd
expected_yield_usd
expected_return_percent
agent_confidence
status
```

### 11.3 Buyer Payment Page

Must show:

```txt
invoice amount
amount due
seller/invoice reference
Dodo checkout button
payment status from backend/Casper only
```

Never mark payment complete from `checkout/success` alone.

### 11.4 Agent Dashboard

Show trace logs:

```txt
Parser Agent extracted invoice fields
FX Agent converted INR → USD
Verification Agent checked duplicate hash
Risk Agent assigned Low risk
Dodo webhook verified
Settlement Relayer submitted Casper transaction
Investor claimed repayment
```

---

## 12. Database Model Guidance

Use Prisma or Drizzle with SQLite/Postgres for MVP.

Suggested tables:

```txt
InvoiceRecord
AgentRun
VerificationCheck
FxQuote
DodoCheckout
DodoWebhookEvent
RelayerJob
CasperDeploy
```

### InvoiceRecord

Fields:

```txt
id
invoiceHash
sellerAccount
buyerHash
originalCurrency
originalAmountMinor
usdAmountCents
advanceAmountUsdCents
repaymentAmountUsdCents
discountBps
riskScore
riskTier
dueDate
statusLocal
statusCasper
attestationHash
casperInvoiceId
createdAt
updatedAt
```

### DodoWebhookEvent

Fields:

```txt
id
eventId
paymentId
gatewayPaymentHash
invoiceId
rawBodyHash
signatureValid
amountUsdCents
currency
processedAt
casperDeployHash
status
```

Unique constraints:

```txt
eventId unique
paymentId unique
gatewayPaymentHash unique
```

---

## 13. Testing Requirements

Do not call the project complete unless these pass.

### Shared Tests

```txt
money parsing
bps calculation
FX fixed-point conversion
hash determinism
schema validation
```

### Agent Tests

```txt
valid invoice accepted
missing due date rejected
past due date rejected
unsupported currency rejected
INR invoice normalized to USD cents
duplicate invoice rejected
risk tier deterministic
attestation hash stable
```

### Contract Tests

```txt
create valid invoice
reject duplicate invoice hash
reject zero amount
reject past due date
agent scores invoice
reject unregistered agent score
seller lists invoice
reject non-seller listing
investor funds invoice
reject seller self-funding
reject double funding
record valid gateway repayment
reject non-relayer repayment
reject underpayment
reject duplicate gateway payment hash
investor claims after repayment
reject claim before repayment
reject claim twice
mark default after due date
reject default before due date
update agent reputation on settlement/default
```

### Dodo Integration Tests

```txt
create checkout with correct metadata
valid webhook accepted
invalid signature rejected
return URL ignored for repayment
replayed webhook ignored
wrong invoice metadata rejected
underpayment webhook rejected
relayer retry safe
```

### E2E Tests

```txt
seller uploads INR invoice
agent normalizes to USD
seller lists receivable
investor funds
buyer pays Dodo checkout in test mode
webhook triggers Casper repayment
investor claims repayment
agent reputation updates
```

---

## 14. Security Checklist

Before final demo:

- [ ] `.env` is ignored.
- [ ] No private keys in repo.
- [ ] Dodo webhook uses raw body signature verification.
- [ ] Webhook replay blocked.
- [ ] Gateway payment hash uniqueness enforced on-chain.
- [ ] Underpayment rejected on-chain.
- [ ] Return URL cannot mark invoice repaid.
- [ ] LLM outputs schema-validated.
- [ ] No private invoice data on-chain.
- [ ] All money is integer cents/minor units.
- [ ] FX conversion is timestamped and cached.
- [ ] Seller cannot fund own invoice.
- [ ] Investor cannot claim before repayment.
- [ ] Contract status and backend status reconciliation exists.
- [ ] Testnet deploy/package hashes documented.

---

## 15. Code Style

### TypeScript

- Use strict TypeScript.
- Prefer named exports.
- Use Zod for runtime validation.
- Do not use `any` unless there is a documented reason.
- Use `bigint` for money internals.
- Convert `bigint` to string in JSON responses.

### React / Next.js

- Use App Router.
- Keep server-only logic out of client components.
- Put secrets only in server routes/actions.
- Use clear loading/error states.
- Use optimistic UI only for non-financial states.
- Financial state must come from backend/Casper confirmation.

### Contracts

- Keep state transitions explicit.
- Fail closed.
- Prefer small functions with clear preconditions.
- Emit events on every lifecycle transition.
- Add tests before adding extra features.

### Agents

- Keep each agent independently testable.
- Every tool call should return typed output.
- Every agent run should produce trace logs.
- Do not let the model invent missing invoice fields.
- Ask for correction/reject if required fields are missing.

---

## 16. Environment Variables

Create `.env.example` from `.env.example.md`.

Required groups:

```txt
App
Database
Casper network
Contract package hashes
Relayer keys
Dodo Payments
FX provider
AI/OCR
x402 demo mode
```

Never commit actual secrets.

---

## 17. Demo Definition of Done

The project is demo-ready only if this exact path works:

```txt
1. Start app locally.
2. Connect seller wallet.
3. Upload sample INR invoice.
4. Agent extracts original INR amount.
5. Agent converts INR to USD cents using current FX rate.
6. Agent verifies invoice and creates risk terms.
7. Seller mints/lists receivable on Casper Testnet.
8. Connect investor wallet.
9. Investor funds receivable on Casper Testnet.
10. Buyer opens Dodo Test Mode checkout.
11. Buyer completes test payment.
12. Verified webhook is received.
13. Relayer records gateway repayment on Casper.
14. Investor claims repayment.
15. Agent reputation updates.
16. UI shows Casper deploy hashes for all critical lifecycle steps.
```

If any step is mocked, label it clearly. The Dodo repayment path should not be mocked.

---

## 18. Common Mistakes To Avoid

Do not:

- Use a button that directly marks invoice as repaid.
- Trust Dodo success redirect query params.
- Store invoice PDFs on-chain.
- Put buyer email/name on-chain.
- Use floats for currency.
- Allow invoice funding before risk score.
- Allow seller to self-fund.
- Allow multiple investors in MVP.
- Allow repayment recording from arbitrary backend calls.
- Allow duplicate webhook/payment IDs.
- Let raw LLM output write to contracts.
- Build dashboards before core lifecycle works.
- Add extra features before tests pass.

---

## 19. First Task For Codex

If starting from an empty repo, do this first:

```txt
1. Create monorepo structure.
2. Add root package.json + pnpm workspace.
3. Add packages/shared with schemas, money helpers, hashing helpers, and tests.
4. Add .env.example from docs.
5. Add README setup commands.
6. Run pnpm install, lint, typecheck, test.
```

Then continue with contracts.

If starting from a partially built repo, inspect existing structure and produce a short implementation plan before editing files.

---

## 20. Success Standard

Cortex should feel like:

> A serious agentic RWA financing product, not a hackathon toy.

The narrow lifecycle must be airtight:

```txt
invoice evidence
→ USD normalization
→ AI risk terms
→ Casper receivable
→ investor funding
→ Dodo verified repayment
→ Casper settlement
→ investor claim
```

Prioritize correctness and demo reliability over breadth.
