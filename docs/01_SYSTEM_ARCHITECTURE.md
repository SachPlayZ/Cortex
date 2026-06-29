# 01 — System Architecture

## High-Level Architecture

```txt
┌──────────────────────────────────────────────────────────────┐
│                         Next.js App                          │
│  Seller UI | Investor UI | Buyer Repayment UI | Agent Trace   │
│  CSPR.click wallet UX | Dodo checkout redirect | API routes    │
└───────────────┬──────────────────────┬───────────────────────┘
                │                      │
                │ Casper tx signing    │ Dodo checkout/webhooks
                ▼                      ▼
┌──────────────────────────┐   ┌───────────────────────────────┐
│       Casper Testnet     │   │       Dodo Payments Test Mode  │
│ InvoiceRegistry          │   │ Hosted checkout sessions       │
│ FundingVault             │   │ Successful payment webhooks    │
│ RepaymentEscrow          │   └───────────────┬───────────────┘
│ AgentReputation          │                   │ verified webhook
│ MockUSD / native CSPR    │                   ▼
└───────────────┬──────────┘   ┌───────────────────────────────┐
                │              │ Backend Settlement Relayer     │
                │              │ - verifies webhook signature   │
                │              │ - validates amount + metadata  │
                │              │ - submits Casper repayment tx  │
                │              └───────────────┬───────────────┘
                │                              │
                ▼                              ▼
┌──────────────────────────┐   ┌───────────────────────────────┐
│       CSPR.cloud          │   │        Agent Orchestrator      │
│ REST API                  │   │ Parser | FX | Verification     │
│ Streaming API             │   │ Risk | Reminder | Settlement   │
│ Node API                  │   │ x402-paid tools/services       │
└──────────────────────────┘   └───────────────────────────────┘
```

## Trust Boundaries

### Trusted On-Chain State

The Casper contracts are the final source of truth for:

- Invoice status.
- Seller.
- Investor.
- Funding amount.
- Repayment amount.
- Settlement status.
- Agent reputation.
- Evidence/attestation hashes.

### Trusted Backend State

The backend is trusted only for:

- Temporary upload storage.
- Agent output orchestration.
- Dodo webhook verification.
- Relaying verified repayments to Casper.

The backend must not be able to arbitrarily mark any invoice as repaid. It must prove:

```txt
verified_dodo_webhook == true
invoice_id in webhook metadata
payment_id not previously used
amount_paid_usd_cents >= invoice.repayment_amount_usd_cents
payment status is successful according to Dodo event guide
```

### Untrusted Inputs

Treat all of these as untrusted:

- Uploaded invoice PDFs.
- User-edited invoice fields.
- Dodo return URL query params.
- Frontend payment status.
- LLM output.
- OCR output.
- FX API response until validated.

## Services

### 1. Web App

Path: `apps/web`

Responsibilities:

- Wallet connection through CSPR.click.
- Invoice upload.
- Seller dashboard.
- Investor marketplace.
- Buyer repayment checkout creation.
- Agent trace display.
- Contract state display through CSPR.cloud.

### 2. API Server

Can live inside Next.js route handlers for MVP.

Responsibilities:

- File upload intake.
- Agent execution.
- Dodo checkout session creation.
- Dodo webhook verification.
- Settlement relayer queue.
- Off-chain database updates.

### 3. Agent Orchestrator

Path: `agents/`

Responsibilities:

- Parse invoice.
- Normalize currency to USD.
- Verify invoice.
- Score risk.
- Generate attestation.
- Trigger reminder messages.
- Monitor settlement.

### 4. Casper Contracts

Path: `contracts/`

Responsibilities:

- Store invoice lifecycle.
- Hold/record funding.
- Record Dodo-originated repayment.
- Allow investor claims.
- Update agent reputation.

### 5. Dodo Payment Connector

Responsibilities:

- Create hosted checkout sessions in test mode.
- Add invoice metadata to checkout session/payment record.
- Verify Standard Webhooks signatures.
- Enforce payment idempotency.
- Trigger repayment relay.

## Database Schema

Use Postgres or SQLite for MVP. Suggested tables:

### invoices

```sql
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  invoice_hash TEXT NOT NULL UNIQUE,
  seller_wallet TEXT NOT NULL,
  buyer_name TEXT,
  buyer_email TEXT,
  buyer_domain TEXT,
  original_currency TEXT NOT NULL,
  original_amount_minor BIGINT NOT NULL,
  usd_amount_cents BIGINT NOT NULL,
  fx_rate_decimal TEXT NOT NULL,
  fx_rate_source TEXT NOT NULL,
  fx_rate_timestamp TEXT NOT NULL,
  due_date TEXT NOT NULL,
  payment_terms TEXT,
  risk_score INTEGER,
  risk_tier TEXT,
  discount_bps INTEGER,
  advance_rate_bps INTEGER,
  advance_amount_usd_cents BIGINT,
  repayment_amount_usd_cents BIGINT,
  evidence_hash TEXT NOT NULL,
  attestation_hash TEXT,
  casper_invoice_id TEXT,
  casper_deploy_hash TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### invoice_events

```sql
CREATE TABLE invoice_events (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  tx_hash TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(invoice_id) REFERENCES invoices(id)
);
```

### dodo_payments

```sql
CREATE TABLE dodo_payments (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  dodo_checkout_session_id TEXT,
  dodo_payment_id TEXT UNIQUE,
  expected_amount_usd_cents BIGINT NOT NULL,
  paid_amount_usd_cents BIGINT,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL,
  webhook_event_id TEXT UNIQUE,
  webhook_received_at TEXT,
  casper_repayment_tx_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(invoice_id) REFERENCES invoices(id)
);
```

### agent_runs

```sql
CREATE TABLE agent_runs (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  output_hash TEXT NOT NULL,
  output_json TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  FOREIGN KEY(invoice_id) REFERENCES invoices(id)
);
```

### x402_receipts

```sql
CREATE TABLE x402_receipts (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  amount_paid TEXT NOT NULL,
  payment_proof_hash TEXT NOT NULL,
  response_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(invoice_id) REFERENCES invoices(id)
);
```

## Canonical Identifiers

### invoice_id

Use deterministic ID:

```txt
invoice_id = sha256(seller_wallet + invoice_hash + created_at_nonce)
```

### evidence_hash

```txt
evidence_hash = sha256(normalized_invoice_pdf_bytes)
```

### attestation_hash

```txt
attestation_hash = sha256(canonical_json(agent_attestation))
```

### dodo_payment_hash

```txt
dodo_payment_hash = sha256(dodo_payment_id)
```

Never store private buyer data on-chain.

## Event Flow

### Invoice Creation

```txt
POST /api/invoices/upload
→ store file
→ calculate invoice_hash
→ run parser agent
→ run FX agent
→ run verification agent
→ run risk agent
→ create off-chain invoice row
→ seller approves Casper tx through CSPR.click
→ create_invoice + post_risk_score + list_invoice
```

### Funding

```txt
Investor clicks Fund
→ CSPR.click signs Casper transaction
→ FundingVault.fund_invoice(invoice_id)
→ InvoiceRegistry status = FUNDED
→ CSPR.cloud stream updates UI
```

### Repayment

```txt
Buyer opens repayment page
→ POST /api/payments/dodo/create-checkout
→ Dodo Test Mode checkout session created
→ Buyer completes test payment
→ Dodo sends webhook
→ POST /api/webhooks/dodo
→ verify Standard Webhook signature
→ validate invoice metadata and amount
→ idempotency check
→ enqueue settlement relay
→ relayer calls RepaymentEscrow.record_gateway_repayment(...)
→ contract marks invoice REPAID
→ investor claims
```

## Critical Design Decision: Webhook → Relayer → Casper

A Dodo webhook is web2; Casper is web3. The bridge must be explicit.

Do **not** do this:

```txt
Dodo webhook → update database status only → frontend says repaid
```

Do this:

```txt
Dodo webhook → verify → settlement relayer signs Casper transaction → on-chain state changes → frontend reads on-chain state
```

## Recommended Chain Asset Model

### MVP

Use a mock `cUSD` ledger or native testnet CSPR with USD-cents accounting.

Preferred MVP:

- On-chain accounting stores USD cents.
- Funding uses testnet CSPR or mock cUSD.
- Dodo repayment uses test-mode USD checkout.
- Settlement relayer records proof of off-chain USD repayment.
- Investor claim releases escrowed repayment equivalent from a test treasury or mock token.

### V2

- CEP-18 stablecoin equivalent.
- Multiple investors per invoice.
- Legal claim documents.
- Real fiat/stable settlement.
