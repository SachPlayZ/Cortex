# Cortex

Cortex is an AI-underwritten invoice financing marketplace on Casper. Sellers upload unpaid invoices, agents verify and price risk, investors fund receivables, and buyer repayment is recorded only after a verified Dodo Payments webhook triggers Casper settlement.

## Build Order

1. Shared types and money safety.
2. Casper contracts.
3. Backend and agent pipeline.
4. Dodo repayment integration.
5. Frontend.
6. End-to-end production hardening.

## Setup

```bash
pnpm install
pnpm test:shared
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm dev
```

## Current Status

Implemented production spine:

- `packages/shared`: schemas, integer money helpers, fixed-point FX conversion, deterministic hashing, status enums, tests.
- `contracts`: Odra/Casper strict contract set: `InvoiceRegistry`, `FundingVault`, `RepaymentEscrow`, and `AgentReputation`, with lifecycle, seller cash-out, vault liquidity, webhook repayment, investor claim, duplicate payment protection, underpayment rejection, and Casper backend wasm tests.
- `agents`: deterministic parser, FX normalizer, verification, risk pricing, attestation, and orchestration tests.
- `apps/web`: Next App Router onboarding, wallet-scoped seller/investor workspaces, Dodo hosted checkout/webhook integration, raw-body Standard Webhooks verification, and idempotent relayer job flow.

Live Dodo checkout needs `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_SECRET`, and `DODO_PRODUCT_ID`. Configure `DODO_PRODUCT_ID` as a one-time Pay What You Want product; Cortex passes the invoice repayment amount as `product_cart[].amount` in USD cents. The return URL reports pending only; repayment requires the signed webhook path.

## Verification

```bash
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
cargo odra test -b casper
pnpm --filter @cortex/web exec next build
```

## Safety Rules

- Casper is the financial source of truth.
- Dodo return URLs never mark invoices paid.
- Verified Dodo webhooks are required before repayment relay.
- All money uses integer minor units or fixed-point bigint math.
- Private invoice data stays off-chain; contracts store hashes only.
