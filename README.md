<p align="center">
  <img src="apps/web/public/cortex-logo.png" alt="Cortex logo" width="72" />
</p>

<h1 align="center">Cortex</h1>

<p align="center">
  AI-underwritten invoice financing on Casper.
</p>

<p align="center">
  Freelancers upload unpaid invoices, agents verify and price risk, investors fund receivables on-chain, and buyer repayment is recorded only after a verified Dodo Payments webhook triggers Casper settlement.
</p>

---

## Overview

Cortex is a production-oriented receivables marketplace for one focused workflow:

```txt
Invoice evidence
-> Agent underwriting
-> USD normalization
-> Casper receivable
-> Investor funding
-> Hosted Dodo repayment
-> Verified webhook
-> Casper settlement
-> Investor claim
```

The app starts with a clean slate. There is no preloaded invoice data, no shortcut wallet path, and no frontend-only repayment button. Users only see the workspace that matches their connected Casper wallet role.

> [!IMPORTANT]
> A Dodo return URL is not payment proof. Cortex marks repayment only after a signed Dodo webhook is verified, amount and metadata are checked, idempotency is enforced, and the settlement relayer records repayment on Casper.

## Features

- **Wallet-scoped onboarding** with CSPR.click.
- **Freelancer workspace** for invoice upload, underwriting results, receivable status, withdrawal state, and client payment links.
- **Investor workspace** for marketplace listings, funding math, portfolio tracking, and claim actions.
- **Client payment page** that requires no wallet and redirects only to hosted Dodo checkout.
- **Agent pipeline** for parsing, FX normalization, verification, deterministic risk pricing, and attestation hashing.
- **Casper contracts** for invoice lifecycle, funding, repayment, investor claims, and agent reputation.
- **Dodo webhook integration** with Standard Webhooks signature verification and replay protection.
- **Integer money model** using cents/minor units and basis points.

## Architecture

```txt
apps/web
  Next.js app router, CSPR.click wallet UI, Dodo hosted checkout,
  API routes, webhook handler, payment runtime, Postgres-backed records

agents
  Parser, FX normalizer, verification, risk pricing, attestation

packages/shared
  Zod schemas, money helpers, hashing, constants, status/error types

contracts
  Odra/Casper contracts: InvoiceRegistry, FundingVault,
  RepaymentEscrow, AgentReputation
```

### Core trust model

- Casper is the financial source of truth.
- Backend records are cache/orchestration state.
- Uploaded invoice data and private buyer details stay off-chain.
- Only hashes and canonical financial fields are eligible for on-chain calls.
- Relayer private keys are server-only.
- Webhook and payment IDs are idempotent.

## User Flow

### Freelancer

1. Connect a Casper wallet.
2. Upload or paste a real invoice.
3. Run agent underwriting.
4. Review parser, FX, verification, risk, and attestation output.
5. Mint/list the receivable on Casper.
6. After funding, generate a hosted Dodo payment link for the client.
7. Track repayment and withdrawal state.

### Investor

1. Connect a Casper wallet.
2. Review listed receivables.
3. Inspect face value, advance amount, discount, expected yield, risk score, and due date.
4. Fund a receivable on Casper.
5. Claim repayment after webhook-confirmed settlement.

### Client

1. Receive a hosted Dodo checkout link.
2. Pay in fiat through Dodo.
3. Return to a pending status page.
4. See success only after webhook confirmation and Casper settlement.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Web app | Next.js, React, TypeScript |
| Wallet | CSPR.click Web SDK |
| Casper integration | casper-js-sdk, CSPR.cloud endpoints |
| Payments | Dodo Payments hosted checkout, Standard Webhooks |
| Agents | TypeScript, Zod, Decimal.js, optional Groq parser |
| Database | Postgres in production |
| Contracts | Rust, Odra, Casper |
| Tests | Vitest, Rust/Cargo contract tests |

## Prerequisites

- Node.js 22+
- pnpm 9+
- Rust toolchain for contracts
- `nightly-2026-01-01` for Odra/Casper tests
- Postgres database
- Casper testnet contract package hashes
- Dodo Payments API key, webhook secret, and product ID

## Setup

```bash
pnpm install
cp .env.example .env
```

Fill in `.env` with real values for Postgres, Casper, Dodo, and relayer keys.

```bash
pnpm dev
```

The web app runs at:

```txt
http://localhost:3000
```

> [!NOTE]
> Development may use the in-memory payment store only when `DATABASE_URL` is not configured. Production fails closed unless `DATABASE_URL` is a Postgres connection string and Casper relayer settings are present.

## Environment

The important environment groups are:

```txt
App
Database
Casper network
Contract package hashes
Relayer keys
Dodo Payments
FX provider
AI/OCR
x402 services
```

See [.env.example](.env.example) for the full list.

Required production values include:

- `DATABASE_URL`
- `CASPER_NODE_RPC_URL`
- `INVOICE_REGISTRY_PACKAGE_HASH`
- `SETTLEMENT_RELAYER_PRIVATE_KEY_PATH`
- `DODO_PAYMENTS_API_KEY`
- `DODO_PAYMENTS_WEBHOOK_SECRET`
- `DODO_PRODUCT_ID`
- `DODO_RETURN_URL`
- `DODO_CANCEL_URL`

## Commands

```bash
# Web app
pnpm dev

# Build all TypeScript packages and check contracts
pnpm build

# Typecheck
pnpm typecheck

# Tests
pnpm test
pnpm test:shared
pnpm test:agents
pnpm test:contracts

# Web integration tests
pnpm test:e2e
```

Contract-specific commands:

```bash
cargo +nightly-2026-01-01 test --manifest-path contracts/Cargo.toml
cargo +nightly-2026-01-01 check --manifest-path contracts/Cargo.toml
cargo odra test -b casper -s
```

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Public onboarding |
| `/seller` | Freelancer dashboard |
| `/seller/upload` | Invoice upload and underwriting |
| `/seller/invoices` | Freelancer invoice list |
| `/investor` | Investor marketplace and portfolio |
| `/invoice/[invoiceId]` | Receivable detail |
| `/buyer/pay/[invoiceId]` | Client payment page |
| `/checkout/success` | Pending/success payment return |
| `/checkout/cancel` | Failed/cancelled payment return |

API routes:

| Route | Purpose |
| --- | --- |
| `GET /api/invoices` | List persisted receivables |
| `POST /api/underwrite` | Run agent underwriting |
| `POST /api/payments/dodo/create-checkout` | Create hosted Dodo checkout |
| `GET /api/payments/status/[invoiceId]` | Poll payment/settlement status |
| `POST /api/webhooks/dodo` | Verify Dodo webhook and enqueue settlement |
| `POST /api/relayer/retry` | Retry relayer jobs |

## Repository Structure

```txt
cortex/
  apps/
    web/                 # Next.js app and API routes
  agents/                # Underwriting pipeline
  contracts/             # Casper/Odra contracts
  packages/
    shared/              # Schemas, money, hashing, constants
  docs/                  # Architecture and implementation plans
```

## Security Notes

> [!WARNING]
> Never commit `.env`, private keys, webhook secrets, or buyer invoice data.

Before shipping, verify:

- `.env` is ignored.
- Dodo webhook verification uses the raw request body.
- Return URLs never mark invoices paid.
- Gateway payment hashes are unique.
- Underpayment is rejected.
- Seller cannot fund their own invoice.
- Investor cannot claim before repayment is recorded.
- No private invoice data is written on-chain.
- All money calculations use integer cents/minor units or fixed-point rates.

## Current Deployment Notes

The contracts README includes the latest Casper testnet package hashes and deployment receipts:

[contracts/README.md](contracts/README.md)

The web app expects those package hashes in `.env` and uses the configured relayer account only on the server.
