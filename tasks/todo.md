# Todo

## Plan — Impeccable redesign (`apps/web`)

- [x] Load Impeccable init/product guidance and prior lessons.
- [x] Crawl product docs, routes, UI tokens, components, assets, and framework.
- [x] Confirm product strategy and accessibility constraints.
- [x] Write `apps/web/PRODUCT.md`.
- [x] Write `apps/web/DESIGN.md` and design sidecar through the document flow.
- [x] Configure Impeccable live mode for Next.js.
- [x] Audit every route and remove generic visual patterns.
- [x] Rebuild the shell, landing page, product surfaces, and financial states with Shadcn components.
- [x] Verify desktop/mobile layout, navigation, live data, and runtime semantics.

## Verification — Impeccable redesign

- [x] Re-run Impeccable context and detector for `apps/web`.
- [x] Validate generated JSON/config and inspect git diff.
- [x] `pnpm --filter @cortex/web lint`
- [x] `pnpm --filter @cortex/web test`
- [x] `pnpm --filter @cortex/web test:e2e`
- [x] `pnpm --filter @cortex/web build`
- [x] Browser review at desktop and 390px mobile.
- [x] `git diff --check`

## Review — Impeccable redesign

### Changed

- Added the product/design contract and Impeccable live configuration.
- Rebuilt the landing page around verified handoffs, integer-cents terms, and Casper/Dodo proof.
- Standardized navigation, wallet gates, empty states, statuses, dashboards, invoice detail, buyer checkout, agent, and admin surfaces on Shadcn.
- Removed placeholder imagery, gradients, grain, floating effects, decorative glass, and oversized app headings.

### Verified

- Impeccable detector: zero findings.
- 29 web tests and 27 focused lifecycle tests pass.
- Production build passes across all routes.
- Browser review found no horizontal overflow or new Base UI semantic errors.

### Risks

- PostgreSQL emits an existing SSL-mode migration warning in development.
- Wallet-only dashboard content still depends on CSPR.click connection.

### Follow-ups

- Set the production CSPR.click app ID before hosting.

## Plan

- [x] Read required project docs and prior lessons.
- [x] Inventory current code, env readiness, deployed contracts, and baseline failures.
- [x] Audit/fix CSPR.click wallet connection and user-signed lifecycle transactions.
- [x] Audit/fix Casper reads, relayer transactions, confirmation, and reconciliation.
- [x] Audit/fix Dodo checkout, verified webhook, idempotency, and relay retry.
- [x] Audit/fix critical UI routes, interactions, responsive layout, loading/error/empty states.
- [x] Add/repair integration coverage for lifecycle, Dodo, replay, and chain event parsing.
- [x] Run full lint, typecheck, unit/integration, build, browser smoke, contract tests.
- [x] Complete live Dodo Test Mode payment, webhook relay, and investor claim.

## Verification

- [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm test`
- [x] `pnpm build`
- [x] `pnpm test:e2e`
- [x] Browser route/action pass
- [x] Casper RPC transaction proof through funding
- [x] Dodo Test Mode checkout/webhook proof
- [x] `git diff --check`
- [x] Review changed files only; no secret exposure

## Review

### Changed

- Canonical lifecycle now targets InvoiceRegistry for fund, cashout, repayment, and claim.
- Fixed CSPR.click identity, network config, send results, and execution confirmation.
- Fixed Odra event parsing/replay, invoice ID hashing, Dodo schema/nonce/overpayment, and atomic relayer claims.
- Fixed lifecycle confirmation race when Casper reaches the post-transaction state before the callback.
- Fixed lifecycle client refresh, payment polling, upload fallback, responsive nav, live ops dashboards, cached-state warnings, dead landing link, and semantics.

### Verified

- 13 shared, 9 agent, 29 web, and 15 contract tests pass.
- Production Next build passes; required routes return 200.
- Live Testnet lifecycle reached `Settled` through mint, score, list, fund, verified Dodo webhook repayment, and investor claim.
- Repayment tx: `9d32b43e0e008bee3e9a222f1a194a0d09815b823f0fbde73aee59cece1f00e9`.
- Claim tx: `0425924dc8c03d360d3243abe70f271a44d22aa38e70c28e44c7c05f5dc140a4`.
- Webhook signature valid; relayer confirmed once; `AgentReputationUpdated`, `InvestorClaimed`, and `InvoiceSettled` observed.

### Risks

- Hosted CSPR.click needs a registered app ID; localhost modal/provider selection is verified with the template ID.

### Follow-ups

- Register the production CSPR.click app ID before hosting.
