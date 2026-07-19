# 02 — Contracts Plan

This file is for the contracts subagent.

## Objective

Implement a safe Casper Testnet smart contract system for invoice receivables, funding, Dodo-originated repayment recording, investor claims, and agent reputation.

Use **Odra** unless blocked. Odra is a Rust-based smart contract framework for Casper and supports building, testing, and deploying Casper contracts.

## Contract Modules

```txt
contracts/
  invoice_registry/
  funding_vault/
  repayment_escrow/
  agent_reputation/
  mock_usd/                  # optional but recommended
  tests/
```

## Canonical Amounts

All accounting amounts must be integer USD cents.

```txt
invoice_amount_usd_cents: u128
advance_amount_usd_cents: u128
repayment_amount_usd_cents: u128
discount_bps: u16
advance_rate_bps: u16
```

No floating point anywhere.

## State Machine

```txt
Created
  → Scored
  → Listed
  → Funded
  → RepaymentPending
  → Repaid
  → Settled

Failure branches:
  Created/Scored/Listed → Cancelled
  Created/Scored → Rejected
  Funded/RepaymentPending → Defaulted
  Any active state → Disputed
```

### State Transition Rules

| From | To | Allowed Caller | Condition |
|---|---|---|---|
| None | Created | Seller | Unique invoice hash |
| Created | Scored | Registered Agent | Valid terms |
| Scored | Listed | Seller | Seller accepts terms |
| Listed | Funded | Investor | Full funding provided |
| Funded | RepaymentPending | Contract | Automatic after funding |
| RepaymentPending | Repaid | Settlement Relayer | Verified gateway repayment |
| Repaid | Settled | Investor or Relayer | Repayment recorded |
| RepaymentPending | Defaulted | Anyone/Relayer | due_date passed and unpaid |
| Created/Scored/Listed | Cancelled | Seller | Not funded |

## Contract 1: InvoiceRegistry

> Current Casper Testnet MVP: `InvoiceRegistry` is the single authoritative lifecycle contract. Funding, seller cashout, gateway repayment, default, and investor claim all call this package directly. The standalone `FundingVault` and `RepaymentEscrow` packages remain isolated contract modules and test fixtures; their events must not drive invoice status until authenticated cross-contract orchestration is deployed.

### Purpose

The canonical record for invoice metadata, status, and lifecycle events.

### Structs

```rust
pub struct Invoice {
    pub invoice_id: [u8; 32],
    pub seller: AccountHash,
    pub buyer_hash: [u8; 32],
    pub invoice_hash: [u8; 32],
    pub evidence_hash: [u8; 32],
    pub attestation_hash: Option<[u8; 32]>,
    pub original_currency_hash: [u8; 32],
    pub invoice_amount_usd_cents: u128,
    pub advance_amount_usd_cents: u128,
    pub repayment_amount_usd_cents: u128,
    pub discount_bps: u16,
    pub advance_rate_bps: u16,
    pub risk_score: u8,
    pub risk_tier: RiskTier,
    pub due_timestamp: u64,
    pub investor: Option<AccountHash>,
    pub status: InvoiceStatus,
    pub created_at: u64,
    pub funded_at: Option<u64>,
    pub repaid_at: Option<u64>,
    pub settled_at: Option<u64>,
}
```

### Enums

```rust
pub enum InvoiceStatus {
    Created,
    Scored,
    Listed,
    Funded,
    RepaymentPending,
    Repaid,
    Settled,
    Defaulted,
    Cancelled,
    Rejected,
    Disputed,
}

pub enum RiskTier {
    Low,
    MediumLow,
    Medium,
    High,
    Rejected,
}
```

### Storage

```txt
invoices: Dict<invoice_id, Invoice>
invoice_hash_used: Dict<invoice_hash, bool>
invoice_ids_by_seller: Dict<seller, Vec<invoice_id>>
open_invoice_ids: Vec<invoice_id>
registered_agents: Dict<AccountHash, bool>
settlement_relayers: Dict<AccountHash, bool>
admin: AccountHash
```

### Entry Points

#### create_invoice

```txt
create_invoice(
  invoice_id,
  invoice_hash,
  evidence_hash,
  buyer_hash,
  original_currency_hash,
  invoice_amount_usd_cents,
  due_timestamp
)
```

Checks:

- caller is seller.
- invoice_hash not used.
- due_timestamp > current_block_time + minimum_due_window.
- invoice_amount_usd_cents > 0.
- invoice_id unused.

Effects:

- stores invoice as `Created`.
- marks invoice_hash used.
- emits `InvoiceCreated`.

#### post_risk_score

```txt
post_risk_score(
  invoice_id,
  risk_score,
  risk_tier,
  discount_bps,
  advance_rate_bps,
  advance_amount_usd_cents,
  repayment_amount_usd_cents,
  attestation_hash
)
```

Checks:

- caller is registered agent.
- invoice status is `Created`.
- risk_score <= 100.
- discount_bps <= 3000.
- advance_rate_bps + discount_bps == 10000.
- repayment_amount_usd_cents == invoice_amount_usd_cents.
- advance_amount_usd_cents == floor(invoice_amount_usd_cents * advance_rate_bps / 10000).
- if risk tier is Rejected, status becomes `Rejected`; cannot list.

Effects:

- stores score and terms.
- status = `Scored` or `Rejected`.
- emits `InvoiceScored`.

#### list_invoice

```txt
list_invoice(invoice_id)
```

Checks:

- caller is seller.
- status is `Scored`.
- risk_tier is not Rejected.
- due date not passed.

Effects:

- status = `Listed`.
- adds to marketplace list.
- emits `InvoiceListed`.

#### set_investor_and_mark_funded

Called only by FundingVault.

```txt
set_investor_and_mark_funded(invoice_id, investor)
```

Checks:

- caller is FundingVault.
- invoice status is `Listed`.
- investor != seller.

Effects:

- sets investor.
- status = `RepaymentPending`.
- funded_at = now.
- emits `InvoiceFunded`.

#### mark_repaid

Called only by RepaymentEscrow.

```txt
mark_repaid(invoice_id)
```

Checks:

- caller is RepaymentEscrow.
- status is `RepaymentPending`.

Effects:

- status = `Repaid`.
- repaid_at = now.
- emits `InvoiceRepaid`.

#### mark_settled

Called only by RepaymentEscrow.

```txt
mark_settled(invoice_id)
```

Checks:

- caller is RepaymentEscrow.
- status is `Repaid`.

Effects:

- status = `Settled`.
- settled_at = now.
- emits `InvoiceSettled`.

#### mark_defaulted

```txt
mark_defaulted(invoice_id)
```

Checks:

- status is `RepaymentPending`.
- current_time > due_timestamp + grace_period.
- repayment not recorded.

Effects:

- status = `Defaulted`.
- emits `InvoiceDefaulted`.
- calls AgentReputation with negative outcome.

## Contract 2: FundingVault

### Purpose

Accept investor funding and record/transfer the seller advance.

### MVP Asset Choice

Implement either:

1. Native CSPR funding with USD-cent accounting; or
2. Mock CEP-18 `MockUSD` token.

For clean DeFi storytelling, use `MockUSD` if time permits. For speed, use native testnet CSPR and display USD cents as accounting units.

### Storage

```txt
registry: ContractHash
repayment_escrow: ContractHash
mock_usd: Optional<ContractHash>
funding_positions: Dict<invoice_id, InvestorPosition>
```

### Struct

```rust
pub struct InvestorPosition {
    pub investor: AccountHash,
    pub invoice_id: [u8; 32],
    pub funded_amount_usd_cents: u128,
    pub expected_repayment_usd_cents: u128,
    pub claimed: bool,
}
```

### Entry Points

#### fund_invoice

```txt
fund_invoice(invoice_id)
```

Checks:

- invoice status is `Listed`.
- caller != seller.
- invoice due date not passed.
- no existing investor position.
- transferred amount equals advance amount.

Effects:

- records investor position.
- sends/marks seller advance.
- calls InvoiceRegistry.set_investor_and_mark_funded.
- emits `InvoiceFunded`.

### Bugs To Avoid

- Do not allow partial funding in MVP.
- Do not allow seller self-funding.
- Do not allow funding expired invoices.
- Do not allow reentrant double funding.
- Do not calculate yield with floats.

## Contract 3: RepaymentEscrow

### Purpose

Record Dodo-originated repayment, prevent duplicate payment IDs, and let investor claim repayment.

### Critical Design

The Dodo webhook is off-chain. The backend settlement relayer verifies it and then calls:

```txt
record_gateway_repayment(...)
```

This on-chain call must include a hash of the Dodo payment ID and a hash of the verified webhook payload. The contract cannot validate Dodo itself, but it can enforce relayer authorization, payment uniqueness, invoice state, and amount correctness.

### Storage

```txt
registry: ContractHash
funding_vault: ContractHash
agent_reputation: ContractHash
settlement_relayers: Dict<AccountHash, bool>
gateway_payment_used: Dict<gateway_payment_hash, bool>
repayments: Dict<invoice_id, RepaymentRecord>
```

### Struct

```rust
pub struct RepaymentRecord {
    pub invoice_id: [u8; 32],
    pub gateway_payment_hash: [u8; 32],
    pub webhook_event_hash: [u8; 32],
    pub paid_amount_usd_cents: u128,
    pub required_amount_usd_cents: u128,
    pub recorded_by: AccountHash,
    pub recorded_at: u64,
    pub claimed: bool,
}
```

### Entry Points

#### record_gateway_repayment

```txt
record_gateway_repayment(
  invoice_id,
  gateway_payment_hash,
  webhook_event_hash,
  paid_amount_usd_cents
)
```

Checks:

- caller is authorized settlement relayer.
- invoice status is `RepaymentPending`.
- gateway_payment_hash not used.
- paid_amount_usd_cents >= invoice.repayment_amount_usd_cents.
- invoice not defaulted.

Effects:

- marks gateway_payment_hash used.
- stores repayment record.
- calls InvoiceRegistry.mark_repaid.
- emits `GatewayRepaymentRecorded`.
- calls AgentReputation.update_after_repayment(invoice_id, success=true).

#### claim_repayment

```txt
claim_repayment(invoice_id)
```

Checks:

- caller is invoice investor.
- invoice status is `Repaid`.
- repayment exists.
- repayment not claimed.

Effects:

- marks claimed.
- transfers/releases repayment amount to investor.
- calls InvoiceRegistry.mark_settled.
- emits `InvestorClaimedRepayment`.

#### mark_default_after_due

```txt
mark_default_after_due(invoice_id)
```

Checks:

- invoice status is `RepaymentPending`.
- current_time > due_timestamp + grace_period.
- no repayment record.

Effects:

- calls InvoiceRegistry.mark_defaulted.
- calls AgentReputation.update_after_repayment(invoice_id, success=false).
- emits `InvoiceDefaulted`.

### Repayment Funding Model

For MVP, choose one:

#### Option A: MockUSD Treasury

- A backend relayer/treasury account has mock cUSD.
- On verified Dodo webhook, relayer transfers/mints mock cUSD into escrow.
- Investor claim transfers mock cUSD from escrow to investor.

Best for demo.

#### Option B: Accounting-Only Repayment

- Contract records repayment proof.
- Investor claim marks successful but does not transfer a token.

Only use if token integration blocks development. Less convincing.

## Contract 4: AgentReputation

### Purpose

Make the underwriting agent accountable.

### Storage

```txt
agents: Dict<AccountHash, AgentProfile>
invoice_agent: Dict<invoice_id, AccountHash>
```

### Struct

```rust
pub struct AgentProfile {
    pub agent: AccountHash,
    pub reputation_score: u32,
    pub invoices_scored: u64,
    pub successful_repayments: u64,
    pub defaults: u64,
    pub low_risk_defaults: u64,
    pub last_updated: u64,
}
```

### Entry Points

#### register_agent

Admin-only.

#### bind_invoice_to_agent

Called during scoring.

#### update_after_repayment

Called only by RepaymentEscrow.

Simple formula:

```txt
success: +20
medium/high risk default: -15
low risk default: -60
minimum reputation: 0
maximum reputation: 1000
initial reputation: 500
```

## Optional Contract: MockUSD

Implement a minimal CEP-18-like token only if time allows.

Needed operations:

```txt
mint(to, amount)
transfer(to, amount)
balance_of(account)
approve(spender, amount)
transfer_from(owner, to, amount)
```

For hackathon demo, admin/treasury-only mint is acceptable.

## Required Tests

### InvoiceRegistry Tests

- create invoice with valid data.
- reject duplicate invoice hash.
- reject zero amount.
- reject past due date.
- only registered agent can score.
- reject invalid bps math.
- rejected invoice cannot be listed.
- only seller can list.
- cannot list expired invoice.

### FundingVault Tests

- investor can fund listed invoice.
- seller cannot fund own invoice.
- cannot fund unlisted invoice.
- cannot fund twice.
- cannot fund expired invoice.
- status becomes RepaymentPending.
- investor position records expected repayment.

### RepaymentEscrow Tests

- only settlement relayer can record gateway repayment.
- cannot record repayment for unfunded invoice.
- cannot record underpayment.
- cannot reuse Dodo payment hash.
- cannot claim before repayment.
- only investor can claim.
- cannot claim twice.
- settlement changes invoice state to Settled.
- default only after due date + grace.
- cannot default after repayment.

### AgentReputation Tests

- registered agent starts at 500.
- successful repayment increases reputation.
- default decreases reputation.
- low-risk default slashes more.
- reputation cannot underflow.
- reputation cannot exceed max.

### Invariant Tests

- An invoice cannot be both Settled and Defaulted.
- An invoice cannot have two investors in MVP.
- A gateway payment hash can settle at most one invoice.
- Total claims cannot exceed recorded repayment.
- Seller advance must equal advance amount.
- Investor repayment must equal repayment amount.
- State transitions must only move forward except cancellation/rejection/dispute.

## Deployment Checklist

- Deploy MockUSD if using token path.
- Deploy InvoiceRegistry.
- Deploy AgentReputation.
- Deploy FundingVault with registry address.
- Deploy RepaymentEscrow with registry, funding vault, reputation addresses.
- Set cross-contract permissions.
- Register underwriting agent.
- Register settlement relayer.
- Save contract package hashes in `.env` and `apps/web/lib/contracts.ts`.

## Error Codes

Use explicit error variants:

```txt
DuplicateInvoiceHash
InvalidAmount
InvalidDueDate
UnauthorizedAgent
UnauthorizedRelayer
InvalidStatus
InvalidRiskScore
InvalidBpsMath
SellerCannotFundOwnInvoice
InvoiceAlreadyFunded
InvoiceExpired
PaymentAlreadyUsed
Underpayment
ClaimNotAllowed
AlreadyClaimed
NotInvestor
DefaultNotAllowed
```

## Docs To Reference

- Casper AI Toolkit: https://www.casper.network/ai
- Casper Developer Docs: https://docs.casper.network/
- Odra intro: https://developer.casper.network/odra-intro
- Odra docs: https://odra.dev/docs/
- Odra Casper backend: https://odra.dev/docs/backends/casper/
- Casper JS/TS SDK: https://docs.casper.network/developers/dapps/sdk/script-sdk
- CSPR.cloud: https://docs.cspr.cloud/
- CSPR.click: https://docs.cspr.click/
