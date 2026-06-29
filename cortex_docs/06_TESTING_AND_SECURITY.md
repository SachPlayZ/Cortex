# 06 — Testing and Security Plan

This file is for QA, security, and test subagents.

## Objective

Prevent the critical gaps that would make the demo logically weak:

- Fake repayment.
- Duplicate repayment.
- Underpayment accepted.
- Invoice funded before scoring.
- Investor claim before repayment.
- LLM hallucinated values reaching contracts.
- Currency conversion mistakes.
- Webhook replay.
- On-chain/off-chain state mismatch.

## Testing Layers

```txt
1. Unit tests: contracts, agents, utilities
2. Integration tests: Dodo webhook → relayer → Casper
3. E2E tests: seller/investor/buyer flows
4. Invariant tests: financial safety and state machine
5. Manual demo tests: exact DoraHacks video path
```

## Contract Test Matrix

### InvoiceRegistry

| Test | Expected |
|---|---|
| Create valid invoice | status Created |
| Duplicate invoice hash | revert |
| Zero amount | revert |
| Past due date | revert |
| Unregistered agent scores | revert |
| Registered agent scores | status Scored |
| Invalid bps math | revert |
| Rejected risk tier | status Rejected |
| Seller lists scored invoice | status Listed |
| Non-seller lists invoice | revert |
| Listed invoice cannot be rescored | revert |

### FundingVault

| Test | Expected |
|---|---|
| Fund listed invoice | status RepaymentPending |
| Fund unlisted invoice | revert |
| Seller self-funds | revert |
| Fund twice | revert |
| Fund expired invoice | revert |
| Wrong funding amount | revert |
| Investor position created | true |

### RepaymentEscrow

| Test | Expected |
|---|---|
| Relayer records valid repayment | status Repaid |
| Non-relayer records repayment | revert |
| Underpayment | revert |
| Duplicate gateway payment hash | revert |
| Record repayment before funding | revert |
| Investor claims after repayment | status Settled |
| Non-investor claims | revert |
| Claim twice | revert |
| Default before due date | revert |
| Default after due date unpaid | status Defaulted |
| Default after repayment | revert |

### AgentReputation

| Test | Expected |
|---|---|
| Register agent | profile exists |
| Successful repayment | reputation increases |
| Medium-risk default | small slash |
| Low-risk default | large slash |
| Reputation underflow | impossible |
| Reputation overflow | capped |

## Agent Test Matrix

### Parser Agent

- PDF with text extracts correctly.
- Image invoice extracts with OCR path.
- Missing amount rejects.
- Missing buyer rejects.
- Past due date rejects.
- Low confidence rejects.
- Edited fields are logged.

### FX Agent

- USD invoice returns exact amount.
- INR invoice converts to USD cents.
- JPY invoice handles zero decimals.
- KWD invoice handles three decimals.
- API failure hits fallback.
- Unsupported currency rejects.
- Cached rate is reused.
- Decimal rounding uses ROUND_HALF_UP.

### Verification Agent

- Duplicate invoice hash hard rejects.
- Duplicate invoice number warns/rejects depending on policy.
- Valid due date passes.
- Missing domain creates penalty.
- Invalid email creates warning.
- FX missing rejects.

### Risk Agent

- Low-risk invoice gets low discount.
- Medium-risk invoice gets higher discount.
- Rejected invoice receives no terms.
- Advance amount matches integer formula.
- Discount and advance bps sum to 10,000.

### Attestation Agent

- Stable hash for same JSON.
- Different amount changes hash.
- Different FX rate changes hash.
- Private buyer email is not in on-chain calldata.

## Dodo Webhook Tests

### Required Fixtures

Create webhook fixtures:

```txt
fixtures/dodo/success.json
fixtures/dodo/underpayment.json
fixtures/dodo/failed.json
fixtures/dodo/wrong_invoice_metadata.json
fixtures/dodo/duplicate_event.json
fixtures/dodo/invalid_signature.json
```

### Tests

| Test | Expected |
|---|---|
| Valid success webhook | enqueue relay |
| Invalid signature | 400/401, no relay |
| Duplicate webhook-id | 200, no duplicate relay |
| Duplicate payment_id | 200, no duplicate relay |
| Underpayment | mark payment mismatch, no relay |
| Wrong currency | no relay |
| Missing invoice_id metadata | no relay |
| Unknown invoice | no relay |
| Checkout return URL only | no repayment |

## E2E Tests

### Happy Path

```txt
Seller uploads low-risk invoice
→ AI extracts and converts to USD
→ Seller mints/list receivable
→ Investor funds receivable
→ Buyer pays through Dodo test checkout fixture
→ webhook verifies
→ relayer submits Casper repayment tx
→ Investor claims repayment
→ Invoice shows Settled
```

### Rejected Invoice Path

```txt
Seller uploads fake invoice
→ duplicate/missing fields detected
→ invoice rejected
→ cannot mint/list/fund
```

### Default Path

```txt
Invoice funded
→ due date passes in test clock/mock
→ no webhook received
→ relayer marks default
→ agent reputation slashed
```

## Critical Invariants

```txt
1. An invoice can have at most one investor in MVP.
2. An invoice can be settled at most once.
3. A Dodo payment ID can be used at most once.
4. A webhook event ID can be processed at most once.
5. Paid amount must be >= repayment amount.
6. Investor cannot claim before repayment is recorded on-chain.
7. Seller cannot fund own invoice.
8. Funding cannot happen before listing.
9. Rejected invoice cannot become listed.
10. Settled invoice cannot become defaulted.
11. Defaulted invoice cannot become settled unless explicit dispute-resolution path exists.
12. On-chain status is final for UI display.
```

## Security Checks

### Smart Contracts

- Authorization on every sensitive entrypoint.
- State transition checks.
- Unique invoice hash.
- Unique gateway payment hash.
- No unchecked arithmetic.
- No float math.
- No partial funding unless explicitly implemented.
- No implicit cross-contract trust without caller checks.

### Backend

- Verify Dodo webhook signatures using raw body.
- Do not trust frontend status.
- Store idempotency keys.
- Queue settlement relay to avoid webhook timeout.
- Do not expose relayer private key to frontend.
- Validate all LLM outputs with Zod/Pydantic.
- Store uploaded files safely.
- Limit upload size.
- Hash files before storage.

### Frontend

- Never show “Paid” based only on redirect URL.
- Always show pending until backend verifies webhook.
- Always read final financing status from Casper/CSPR.cloud.
- Disable invalid actions based on status.

## Demo Readiness Checklist

- [ ] Fresh low-risk sample invoice works.
- [ ] INR invoice converts to USD.
- [ ] Duplicate invoice rejected.
- [ ] Seller mint/list tx succeeds.
- [ ] Investor fund tx succeeds.
- [ ] Dodo checkout session opens.
- [ ] Test payment webhook fixture works.
- [ ] Webhook relay submits Casper tx.
- [ ] Invoice status becomes Repaid.
- [ ] Investor claim tx succeeds.
- [ ] Invoice status becomes Settled.
- [ ] Agent reputation increases.
- [ ] Default path works with due date mock.
- [ ] README contains deploy hashes and test instructions.

## Bug Triage Priority

### P0

- Contract cannot deploy.
- Funding does not change state.
- Repayment cannot be recorded.
- Investor cannot claim.
- Dodo webhook cannot verify.

### P1

- FX conversion wrong.
- UI state mismatch.
- Agent output unreliable.
- CSPR.cloud sync broken.

### P2

- Styling polish.
- Reminder emails.
- Advanced agent traces.

## Test Commands

Suggested:

```bash
pnpm test
pnpm test:agents
pnpm test:contracts
pnpm test:e2e
pnpm lint
pnpm typecheck
```

## Acceptance Criteria

Do not submit unless:

- The exact happy path can be completed twice from a clean state.
- Duplicate webhook test passes.
- Underpayment webhook test passes.
- Contract tests pass.
- Agent schema tests pass.
- README has clear setup instructions.
