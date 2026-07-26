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
  RepaymentEscrow, AgentReputation, MockUsd
```

### Core trust model

- Casper is the financial source of truth.
- `InvoiceRegistry` is canonical and atomically orchestrates `FundingVault`, `RepaymentEscrow`, `AgentReputation`, and `MockUsd`.
- Investor funding requires an exact mUSDC allowance to `FundingVault`; Dodo-confirmed repayments reserve real mUSDC in `RepaymentEscrow`.
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
| Casper integration | casper-js-sdk |
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
Background jobs
Dodo Payments
AI
```

See [.env.example](.env.example) for the full list.

Required production values include:

- `DATABASE_URL`
- `DATABASE_SSL_REJECT_UNAUTHORIZED=true` unless your Postgres provider explicitly requires insecure TLS
- `CASPER_NODE_RPC_URL` (server-only HTTP upstream; CSPR.click uses `/api/casper/rpc`)
- all five contract package hashes from `.env.example`
- `CASPER_ADMIN_PRIVATE_KEY_PEM` for Registry bootstrap
- `CASPER_TREASURY_PRIVATE_KEY_PEM` for mUSDC reserve bootstrap
- `SETTLEMENT_RELAYER_PRIVATE_KEY_PEM` on hosted/serverless deployments, or `SETTLEMENT_RELAYER_PRIVATE_KEY_PATH` locally
- `DODO_PAYMENTS_API_KEY`
- `DODO_PAYMENTS_WEBHOOK_SECRET`
- `DODO_PRODUCT_ID`
- `DODO_RETURN_URL`
- `DODO_CANCEL_URL`
- `ADMIN_API_TOKEN`

Operational helpers:

- `POST /api/admin/casper/bootstrap` registers agent/relayer and optionally deposits an mUSDC repayment reserve.
- `POST /api/admin/casper/sync` runs one Casper event sync pass and drains queued/retryable relayer jobs.
- Server also runs the same sync/retry loop automatically every `BACKGROUND_SYNC_INTERVAL_MS` unless `DISABLE_BACKGROUND_JOBS=true`.
- `pnpm sync:casper` calls the same endpoint for external cron/serverless setups.

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

## Casper Testnet Contract Addresses — Submission

**Network:** Casper Testnet (`casper-test`)

Use the package hashes below as the submission contract addresses. Package hashes are the stable identities across contract upgrades. If the form accepts only one address, submit `InvoiceRegistry`; it is Cortex's canonical lifecycle contract and the entry point for minting, funding, repayment recording, and claims.

Verified against the active production configuration and Casper Testnet state on **2026-07-27**.

| Contract | Role | Package hash | Explorer |
| --- | --- | --- | --- |
| `InvoiceRegistry` | Canonical lifecycle; primary submission address | `hash-e927cc878c81a521fc5e2bfc8dd163bf40071996703d656e1562fbe448f222b1` | [package](https://testnet.cspr.live/contract-package/e927cc878c81a521fc5e2bfc8dd163bf40071996703d656e1562fbe448f222b1) |
| `FundingVault` | Investor funding and seller advances | `hash-9fabd34fa621fa2e8c8d701e7c144b3dc410437ff302122f0144221b46a73ca3` | [package](https://testnet.cspr.live/contract-package/9fabd34fa621fa2e8c8d701e7c144b3dc410437ff302122f0144221b46a73ca3) |
| `RepaymentEscrow` | Repayment reserve and investor claims | `hash-115792ac89d97550d997761fac98106f27910657a55ea2ff26d0b9d70f4ced7f` | [package](https://testnet.cspr.live/contract-package/115792ac89d97550d997761fac98106f27910657a55ea2ff26d0b9d70f4ced7f) |
| `AgentReputation` | Underwriter reputation and outcomes | `hash-b68085517c629331fbd0291b4ef8b7a92366e9c037eab7895a8766b2c5c7086b` | [package](https://testnet.cspr.live/contract-package/b68085517c629331fbd0291b4ef8b7a92366e9c037eab7895a8766b2c5c7086b) |
| `MockUsd` | Six-decimal Testnet settlement asset | `hash-fe26bc8468bbed43d8b92e9d44d27fc93759a0ba4c65c60143cd8e0865a760bb` | [package](https://testnet.cspr.live/contract-package/fe26bc8468bbed43d8b92e9d44d27fc93759a0ba4c65c60143cd8e0865a760bb) |

Copy-ready package hashes:

```txt
InvoiceRegistry: hash-e927cc878c81a521fc5e2bfc8dd163bf40071996703d656e1562fbe448f222b1
FundingVault: hash-9fabd34fa621fa2e8c8d701e7c144b3dc410437ff302122f0144221b46a73ca3
RepaymentEscrow: hash-115792ac89d97550d997761fac98106f27910657a55ea2ff26d0b9d70f4ced7f
AgentReputation: hash-b68085517c629331fbd0291b4ef8b7a92366e9c037eab7895a8766b2c5c7086b
MockUsd: hash-fe26bc8468bbed43d8b92e9d44d27fc93759a0ba4c65c60143cd8e0865a760bb
```

Current version-specific contract hashes:

```txt
InvoiceRegistry v1: contract-1d4f252c3c70c1e102004ab24d5470b88171636ce505797678df55f3b7518a5e
FundingVault v1: contract-0aa5cd3a226f0963471ca822fe0b96b4586822471f2f09b74f0e40231b3ea0e8
RepaymentEscrow v1: contract-2a8e0c36dff86b513d50f3c1588d84757de6bfb2e4b1172a9c0b407ab7162a03
AgentReputation v1: contract-586c14dbbcd3fa85ed3b31df94512e82ecea26dd1e3762f1e4dec9b8020dcaff
MockUsd v1: contract-17bf10dc49f6e11d638d64e5d79c468486ea8e70c30bf768625abe676fae369e
```

Deploy transactions:

| Contract | Deploy tx | Explorer |
| --- | --- | --- |
| `InvoiceRegistry` | `e3633835e5578d34c3e1cfaa58e84d9210cff876941510175fd25b924f471919` | [tx](https://testnet.cspr.live/transaction/e3633835e5578d34c3e1cfaa58e84d9210cff876941510175fd25b924f471919) |
| `FundingVault` | `499eca7e4409ec649a4ba7e5e7f7a20633e3161ff1f092024b0efbf8304fc082` | [tx](https://testnet.cspr.live/transaction/499eca7e4409ec649a4ba7e5e7f7a20633e3161ff1f092024b0efbf8304fc082) |
| `RepaymentEscrow` | `d254f403fd369779a25473b56364d4304ae6c3d1b7a5d6dcfc6046c30d0e0cd6` | [tx](https://testnet.cspr.live/transaction/d254f403fd369779a25473b56364d4304ae6c3d1b7a5d6dcfc6046c30d0e0cd6) |
| `AgentReputation` | `d945e738ccaf5ab258e190c5b4e4a5dbb33d289d7f6340740e6d512af0eb9c98` | [tx](https://testnet.cspr.live/transaction/d945e738ccaf5ab258e190c5b4e4a5dbb33d289d7f6340740e6d512af0eb9c98) |
| `MockUsd` | `adf868d88765de9ccc4959e911954b9c99beb0a3f8b3e089383bf7f90f4eca5d` | [tx](https://testnet.cspr.live/transaction/adf868d88765de9ccc4959e911954b9c99beb0a3f8b3e089383bf7f90f4eca5d) |

Bootstrap registration transactions:

| Action | Tx |
| --- | --- |
| Link `FundingVault` to Registry | [f428e25b09dda86d0b4e4f07861ae4185a016ba9b1f630859f277062ab02771c](https://testnet.cspr.live/transaction/f428e25b09dda86d0b4e4f07861ae4185a016ba9b1f630859f277062ab02771c) |
| Link `RepaymentEscrow` to Registry | [4cbb3afe583c29637869d9de683cac16eb5fbe04374e78fc09a6bebdaebeec93](https://testnet.cspr.live/transaction/4cbb3afe583c29637869d9de683cac16eb5fbe04374e78fc09a6bebdaebeec93) |
| Link `AgentReputation` to Registry | [5a0bf70cc8f93de5709bc2488ec7ca8944ac967bad7c5607dfd3ac2635a4b436](https://testnet.cspr.live/transaction/5a0bf70cc8f93de5709bc2488ec7ca8944ac967bad7c5607dfd3ac2635a4b436) |
| Register agent | [4f3a16313e51efc6fe57866a6cd95815cf71bbd0c96c6301c2bb2d955eee6b70](https://testnet.cspr.live/transaction/4f3a16313e51efc6fe57866a6cd95815cf71bbd0c96c6301c2bb2d955eee6b70) |
| Register relayer | [0e1ee23b7ac6e59a171f65658ec6e63be562b327ffb68e41d030bdd4a8c5d7df](https://testnet.cspr.live/transaction/0e1ee23b7ac6e59a171f65658ec6e63be562b327ffb68e41d030bdd4a8c5d7df) |
| Mint 1,000,000 mUSDC | [85fdf0c2176f8a7b70e8be0fd6bfb18703d41a45b723fd71225314867e0587e8](https://testnet.cspr.live/transaction/85fdf0c2176f8a7b70e8be0fd6bfb18703d41a45b723fd71225314867e0587e8) |
| Fund 500,000 mUSDC repayment reserve | [5475615716f5426ec377b8c2c3eb5d4789c8856314e25edcb588786fadc7b9d7](https://testnet.cspr.live/transaction/5475615716f5426ec377b8c2c3eb5d4789c8856314e25edcb588786fadc7b9d7) |
| Fund demo investor with 100,000 mUSDC | [f374a6fb97a41ab5a3a93614e630d5beeb2ee53510c7b019f77f3ddec8a8bef8](https://testnet.cspr.live/transaction/f374a6fb97a41ab5a3a93614e630d5beeb2ee53510c7b019f77f3ddec8a8bef8) |

The contracts README also keeps the deployment block:

[contracts/README.md](contracts/README.md)

The web app expects those package hashes in `.env` and uses the configured relayer account only on the server.
