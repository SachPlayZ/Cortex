# 07 — Subagent Task Board

This file is designed so several coding subagents can work in parallel without stepping on each other.

## Subagent 1 — Contracts Agent

### Ownership

```txt
contracts/
docs/02_CONTRACTS.md
```

### Deliverables

- InvoiceRegistry contract.
- FundingVault contract.
- RepaymentEscrow contract.
- AgentReputation contract.
- Optional MockUSD contract.
- Contract tests.
- Deployment script.
- `contracts/README.md` with usage.

### Hard Requirements

- One invoice → one investor in MVP.
- Only settlement relayer records Dodo repayment.
- Gateway payment hash cannot be reused.
- Investor cannot claim before repayment.
- Seller cannot fund own invoice.
- Full state machine tests.

### Interfaces To Export

```txt
create_invoice
post_risk_score
list_invoice
fund_invoice
record_gateway_repayment
claim_repayment
mark_default_after_due
get_invoice
get_investor_position
get_agent_profile
```

### Blocks Other Agents?

Frontend needs contract ABIs/schemas/package hashes, but can mock initially.

---

## Subagent 2 — Agents Agent

### Ownership

```txt
agents/
packages/shared/schemas/
docs/03_AGENTS.md
```

### Deliverables

- Parser agent.
- FX normalization agent.
- Verification agent.
- Risk pricing agent.
- Attestation agent.
- Reminder agent stub.
- Settlement monitor stub.
- Zod/Pydantic schemas.
- Agent tests.

### Hard Requirements

- No floats for money.
- Validate all LLM outputs.
- USD cents canonical output.
- Stable attestation hash.
- Duplicate invoice detection hook.
- x402 receipt interface.

### API Contract

```txt
POST /api/agent/run-underwriting
```

Response:

```json
{
  "invoiceId": "...",
  "parsed": {},
  "fx": {},
  "verification": {},
  "pricing": {},
  "attestationHash": "...",
  "status": "ready_to_mint"
}
```

---

## Subagent 3 — Frontend Agent

### Ownership

```txt
apps/web/app/
apps/web/components/
apps/web/lib/
docs/04_FRONTEND_APPLICATION.md
```

### Deliverables

- Landing page.
- Seller upload/dashboard.
- Investor marketplace.
- Invoice detail.
- Buyer repayment page.
- Agent dashboard.
- Checkout success/pending page.
- Responsive UI.

### Hard Requirements

- No fake paid status from redirect URL.
- Show Dodo webhook pending/verified states.
- Show Casper deploy hashes.
- Show on-chain invoice timeline.
- Show FX conversion and AI attestation.

### Mock Dependencies Allowed

Use mock contract state until contracts are ready.
Use fixture agent responses until agent API is ready.

---

## Subagent 4 — Dodo + Settlement Integration Agent

### Ownership

```txt
apps/web/app/api/payments/dodo/
apps/web/app/api/webhooks/dodo/
apps/web/lib/dodo.ts
apps/web/lib/settlement-relayer.ts
docs/05_INTEGRATIONS.md
```

### Deliverables

- Create Dodo checkout endpoint.
- Dodo webhook endpoint with raw body signature verification.
- Idempotency table logic.
- Payment amount/currency validation.
- Settlement relay job.
- Webhook fixtures and tests.

### Hard Requirements

- Verify Standard Webhook signature.
- Never trust return URL.
- Duplicate webhook safe.
- Duplicate payment ID safe.
- Underpayment does not relay.
- Relay submits Casper repayment transaction.

### API Contract

```txt
POST /api/payments/dodo/create-checkout
POST /api/webhooks/dodo
GET  /api/payments/status/:invoiceId
```

---

## Subagent 5 — Casper Integration Agent

### Ownership

```txt
apps/web/lib/casper.ts
apps/web/lib/cspr-click.ts
apps/web/lib/cspr-cloud.ts
apps/web/lib/contracts.ts
```

### Deliverables

- CSPR.click wallet integration.
- Contract call wrappers.
- Deploy status tracking.
- CSPR.cloud state/event readers.
- Testnet config.

### Hard Requirements

- User txs signed by user wallet.
- Relayer txs signed only server-side.
- Frontend never sees private keys.
- Explorer/deploy links visible where possible.

---

## Subagent 6 — QA Agent

### Ownership

```txt
tests/
apps/web/e2e/
docs/06_TESTING_AND_SECURITY.md
```

### Deliverables

- Contract test runner.
- Agent unit tests.
- Dodo webhook tests.
- E2E happy path.
- E2E rejected invoice path.
- E2E underpayment/duplicate webhook path.
- Demo readiness checklist.

### Hard Requirements

- Duplicate payment cannot settle twice.
- Underpayment cannot settle.
- On-chain state is final.
- Invoice cannot jump invalid states.

---

## Parallel Development Plan

### Phase 1 — Interfaces First

Everyone agrees on:

```txt
packages/shared/schemas/invoice.ts
packages/shared/schemas/payment.ts
packages/shared/schemas/agent.ts
packages/shared/constants/status.ts
```

### Phase 2 — Independent Build

- Contracts agent builds contracts with tests.
- Agents agent builds pipeline with fixtures.
- Frontend agent builds UI with mock data.
- Dodo agent builds checkout/webhook with fixtures.
- Casper integration agent builds wrappers with stub package hashes.

### Phase 3 — Integration

```txt
Agent API → Seller UI
Contract wrappers → Seller/Investor UI
Dodo webhook → Settlement relayer → RepaymentEscrow
CSPR.cloud → Invoice timeline
```

### Phase 4 — Demo Freeze

No new features. Fix bugs only.

## Shared Schema Files

Create these first:

```txt
packages/shared/src/schemas/invoice.ts
packages/shared/src/schemas/agent.ts
packages/shared/src/schemas/payment.ts
packages/shared/src/schemas/casper.ts
packages/shared/src/money.ts
packages/shared/src/hash.ts
```

## Definition of Done

A subagent task is done only if:

- Types compile.
- Tests pass.
- README/docs updated.
- No TODOs in critical paths.
- Error cases are handled.
- Interfaces match shared schemas.
