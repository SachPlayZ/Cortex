# Todo

## Plan — Fix production PDF underwriting

- [x] Reproduce the Vercel `DOMMatrix` failure and identify the missing runtime dependency.
- [x] Load and trace the PDF.js Node canvas globals and worker before parsing PDFs.
- [x] Add PDF extraction regression coverage.
- [x] Run tests, typecheck, build, redeploy, and smoke-test production underwriting.

## Verification — Fix production PDF underwriting

- [x] PDF extraction succeeds without browser-provided globals.
- [x] Web tests, typecheck, and production build pass.
- [x] Production PDF underwriting no longer returns `DOMMatrix is not defined`.
- [x] No unrelated diff or secret exposure.

## Review — Fix production PDF underwriting

### Changed

- Promoted `@napi-rs/canvas` to a traced web runtime dependency and installed PDF.js Node globals before loading `pdf-parse`.
- Configured the bundled PDF worker explicitly so Vercel includes it.
- Moved PDF extraction into a server integration and added a no-browser-globals regression test.

### Verified

- Reproduced the original Vercel log: missing `@napi-rs/canvas`, followed by missing `DOMMatrix`, `ImageData`, and `Path2D`.
- All 39 web tests pass; typecheck and production build pass.
- Production deployment is Ready at `https://cortex-casper.vercel.app`.
- Live PDF route reaches PDF validation (`Invalid PDF structure`) without canvas, DOMMatrix, or worker-loader errors.

### Risks

- Scanned PDFs still depend on the existing OCR/vision fallback after text extraction returns empty.

### Follow-ups

- Retry the original invoice PDF through Run underwriting.

## Plan — Production CSPR.click app ID

- [x] Replace the template app ID in local/example configuration.
- [x] Update Vercel Production and Preview.
- [x] Redeploy production and verify app health.

## Verification — Production CSPR.click app ID

- [x] Production build succeeds.
- [x] Production routes, Casper health, and RPC proxy pass.
- [x] Production browser bundle contains the registered app ID.
- [x] No secrets tracked or diff errors.

## Review — Production CSPR.click app ID

### Changed

- Set the registered CSPR.click app ID locally, in `.env.example`, and in Vercel Production/Preview.
- Redeployed the production app.

### Verified

- Deployment is Ready and aliased to `https://cortex-casper.vercel.app`.
- Landing, seller, and investor routes return 200.
- Casper health reports real mode with completed bootstrap; proxied RPC returns the latest state root.
- The production browser bundle contains the registered CSPR.click app ID.

### Risks

- None identified.

### Follow-ups

- None.

## Plan — Complete deployment environment

- [x] Audit local, example, and Vercel environment requirements without exposing secrets.
- [x] Populate inline PEM signer values and generate missing operational tokens locally.
- [x] Validate every required runtime variable and remove path-only hosted configuration.
- [x] Link/update the Vercel project if authenticated access is available.
- [x] Redeploy and verify production health when deployment access is available.

## Verification — Complete deployment environment

- [x] Required env keys are non-empty.
- [x] Inline PEM source files parse and match configured public keys.
- [x] Vercel production build passes.
- [x] No secrets are tracked by Git.

## Review — Complete deployment environment

### Changed

- Filled Production and Preview Vercel environments with final contract, Casper, Dodo, Groq, database, and runtime values.
- Uploaded inline admin, treasury, agent, and settlement relayer PEM values.
- Generated independent admin and retry tokens; removed obsolete path-based and unused hosted variables.
- Linked `cortex-web`, added a minimal Vercel source ignore, and deployed production.

### Verified

- Vercel deployment `dpl_9758hw9TkCfqJkrG86sDEdXYyQcu` is Ready and aliased to `cortex-casper.vercel.app`.
- Production Casper health is real/bootstrap-complete; RPC proxy returns a Testnet state root; homepage returns 200.
- Protected bootstrap and retry endpoints return 401 without their tokens.
- Both PEM source files parse; the admin key matches configured agent and relayer public keys.
- Local `.env` has no blank values; env/key files remain Git-ignored.

### Risks

- `NEXT_PUBLIC_CSPRCLICK_APP_ID` still uses the template ID; a registered production ID is preferable for the hosted domain.
- Dodo webhook destination is configured in Dodo, not through Vercel environment variables.

### Follow-ups

- Confirm Dodo sends signed webhooks to `https://cortex-casper.vercel.app/api/webhooks/dodo`.

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

## Plan — Landing-page visual references

- [x] Read the existing Cortex design system, landing page, frontend brief, and prior lessons.
- [x] Generate six separate horizontal section concepts in one consistent brand world.
- [x] Verify section count, composition variety, component clarity, and palette continuity.

## Verification — Landing-page visual references

- [x] Six images generated: one per section.
- [x] Every image is horizontal and implementation-oriented.
- [x] Landing and reusable app components match Cortex product rules.

## Review — Landing-page visual references

### Changed

- Generated six landing-page section references: hero, underwriting, marketplace, settlement, role views, and onboarding.

### Verified

- One horizontal frame per section with shared palette, typography, component language, and varied composition.

### Risks

- Generated in-image text may need exact typesetting during implementation.

### Follow-ups

- Translate selected concepts into the existing Next.js/Shadcn landing page.

## Plan — Implement generated landing references

- [x] Read required project docs, prior lessons, and current frontend structure.
- [x] Inspect all six generated references and extract layout, type, spacing, color, and component rules.
- [x] Rebuild the landing page to match the references while preserving the Cortex logo.
- [x] Add only the minimal supporting styles/assets needed for responsive fidelity.
- [x] Verify lint, tests, build, desktop/mobile behavior, diff scope, and unchanged logo assets.

## Verification — Implement generated landing references

- [x] `pnpm --filter @cortex/web lint`
- [x] `pnpm --filter @cortex/web test`
- [x] `pnpm --filter @cortex/web build`
- [x] Browser review at desktop and mobile.
- [x] `git diff --check`
- [x] Cortex logo files unchanged.

## Review — Implement generated landing references

### Changed

- Rebuilt the landing page from the six generated references with an invoice dossier hero, typed underwriting trace, marketplace drawer, verified settlement gates, role panels, and conversion close.
- Reworked wallet onboarding into a functional seller/investor diptych.
- Kept the existing Cortex logo asset and pointed nav/footer branding to it.

### Verified

- Web lint/typecheck, 29 tests, 27 focused E2E/integration tests, and production build pass.
- Desktop and 390px mobile browser review: no horizontal overflow or console errors.
- Cortex logo checksums unchanged.

### Risks

- None known.

### Follow-ups

- None.

## Plan — Vercel signer secrets and Groq model

- [x] Inspect signer loading, environment gates, relayer configuration, and Groq defaults.
- [x] Add inline PEM environment support with local path fallback.
- [x] Route admin, agent, and settlement signers through the shared resolver.
- [x] Use Llama 4 Scout for both text and vision defaults.
- [x] Update environment documentation and regression tests.
- [x] Run lint, agent/web tests, production build, and diff review.

## Verification — Vercel signer secrets and Groq model

- [x] Web lint/typecheck.
- [x] Agent and web tests.
- [x] Production build.
- [x] `git diff --check`.

## Review — Vercel signer secrets and Groq model

### Changed

- Added `*_PRIVATE_KEY_PEM` support for admin, agent, and settlement relayer signers with local `*_PRIVATE_KEY_PATH` fallback.
- Unified text and vision invoice extraction on fixed Llama 4 Scout.
- Updated deployment examples and signer/model regression coverage.

### Verified

- Agent typecheck and 10 tests pass.
- Web typecheck, 32 tests, and production build pass.
- Diff check passes; secret values are not committed.

### Risks

- Vercel PEM values must include the full key, including BEGIN/END lines; actual or escaped newlines are supported.

### Follow-ups

- Replace path variables with PEM variables in Vercel before redeploying.

## Plan — Casper RPC proxy

- [x] Add a fixed same-origin JSON-RPC proxy backed by server-only `CASPER_NODE_RPC_URL`.
- [x] Point CSPR.click at the proxy and remove the browser RPC environment variable.
- [x] Add proxy validation, size/time limits, and regression tests.
- [x] Run web lint, tests, production build, and diff review.

## Verification — Casper RPC proxy

- [x] Web lint/typecheck.
- [x] Web tests.
- [x] Production build.
- [x] `git diff --check`.

## Review — Casper RPC proxy

### Changed

- Added `/api/casper/rpc` as a fixed server-side JSON-RPC bridge to the HTTP Casper node.
- Pointed CSPR.click at the deployment's same-origin HTTPS proxy.
- Removed `NEXT_PUBLIC_CASPER_NODE_RPC_URL`; only server-side `CASPER_NODE_RPC_URL` is needed.

### Verified

- Web lint/typecheck and 36 tests pass.
- Production build exposes the dynamic proxy route.
- Live proxy request returned a real Casper Testnet state root through the HTTP upstream.

### Risks

- The proxy is intentionally public for wallet access; the upstream target is fixed and requests are size, batch, protocol, and timeout constrained.

## Plan — Token-backed mUSDC lifecycle

- [x] Audit current Registry, FundingVault, RepaymentEscrow, MockUsd, Dodo webhook, wallet, and deployment paths.
- [x] Define one canonical 6-decimal custody flow with integer-cent conversion and reserve accounting.
- [x] Integrate MockUsd transfers and allowances into funding, seller cash-out, repayment reserve, and investor claim.
- [x] Wire investor approval, balances, funding state, and Dodo-confirmed claim into the web app.
- [x] Redeploy affected Casper contracts and update local/example environment values.
- [x] Mint and transfer demo mUSDC to the investor account; ensure enough Testnet CSPR for gas.
- [x] Document the exact end-to-end demo sequence.

## Verification — Token-backed mUSDC lifecycle

- [x] Contract unit/integration tests cover approval, custody, reserve, underpayment, replay, and claim.
- [x] Web tests cover approval/funding and verified Dodo settlement.
- [x] Contract build and schema generation pass.
- [x] Web lint, typecheck, tests, and production build pass.
- [x] Live Testnet balances and transaction hashes prove investor funding and settlement reserve.
- [x] `git diff --check`; no secrets exposed.

## Review — Token-backed mUSDC lifecycle

### Changed

- Made mUSDC the actual settlement asset across Registry, FundingVault, and RepaymentEscrow.
- Added investor allowance/funding transactions, seller advance cash-out, pre-backed repayment positions, default release, and Dodo-gated investor claims.
- Split Registry and treasury bootstrap signers for serverless deployment.
- Deployed and linked the final five-contract set; updated env and deployment docs.

### Verified

- 13 shared, 10 agent, 38 web, and 19 contract tests pass.
- 29 focused E2E tests, production build, Odra schema generation, lint, and typecheck pass.
- Demo investor owns 100,000 mUSDC and 59.18 CSPR; escrow owns 500,000 mUSDC.
- All supporting contracts resolve to Registry `hash-e927cc878c81a521fc5e2bfc8dd163bf40071996703d656e1562fbe448f222b1`.
- App bootstrap health is complete for the final Registry scope.

### Risks

- MockUsd is Testnet-only and must never be represented as real USDC.
- Vercel must use inline PEM variables; local private-key paths are not available there.

### Follow-ups

- Set the five final package hashes plus Registry, treasury, agent, and relayer PEM values in Vercel, then redeploy.

## Plan — Full Casper redeployment with MockUSD

- [x] Audit deploy tooling, signer balance, Testnet connectivity, and active env usage.
- [x] Implement and test the MockUSD contract, then include it in build/deploy tooling.
- [x] Build and redeploy all five contracts to Casper Testnet.
- [x] Capture package hashes and deploy receipts; bootstrap required agent/relayer permissions.
- [x] Update `.env`, `.env.example`, contract resources, and deployment docs; remove unused variables.
- [x] Run contract, agent, web, build, live RPC, and diff/secret checks.

## Verification — Full Casper redeployment with MockUSD

- [x] Contract tests/build.
- [x] Five successful Testnet deploys and package-hash lookups.
- [x] Agent/relayer bootstrap transactions confirmed.
- [x] Web/agent lint, tests, and production build.
- [x] `.env` contains only required deployment/runtime variables.
- [x] `git diff --check` and no committed secrets.

## Review — Full Casper redeployment with MockUSD

### Changed

- Added a tested admin-mintable 6-decimal `MockUsd` contract and deployed all five contracts from the funded Testnet key.
- Updated local/example env, Odra resources, and deployment documentation with the new hashes.
- Removed obsolete env variables and scoped bootstrap/event persistence to package hashes.
- Registered the underwriting agent and relayer, deposited vault liquidity, and minted 1,000,000 mUSDC.

### Verified

- 17 contract tests, 10 agent tests, and 37 web tests pass; five Wasm files build.
- All five package hashes resolve to one live contract version on Casper Testnet.
- Bootstrap health reports complete for the new registry.
- Production web build and diff/secret checks pass.

### Risks

- MockUSD is deployed as a standalone demo token; the canonical invoice lifecycle still uses integer USD accounting and does not transfer MockUSD.

### Follow-ups

- Update the same package hashes and new admin PEM in Vercel before redeploying the web app.
