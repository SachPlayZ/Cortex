# Todo

## Plan

- [x] Audit current frontend routes/components and preserve payment/Casper safety behavior.
- [x] Add missing shadcn primitives and GSAP runtime needed for richer UI, loading states, and motion.
- [x] Rebuild global shell, theme utilities, navigation, and landing page around a premium AIDA flow.
- [x] Upgrade seller, upload, investor, invoice detail, buyer payment, and checkout status pages using shadcn components.
- [x] Verify typecheck/build, inspect diff, and check for unrelated edits.

## Verification

- [x] `pnpm --filter @cortex/web typecheck`
- [x] `pnpm --filter @cortex/web build`
- [x] `git diff -- apps/web package.json pnpm-lock.yaml tasks/todo.md`

## Review

### Changed

- Frontend shell/theme/nav, landing page, onboarding, seller/upload, investor, invoice detail, buyer payment, checkout status, agent/admin pages.
- Added shadcn UI primitives for richer loading/composition and GSAP for landing motion.

### Verified

- `pnpm --filter @cortex/web typecheck`
- `pnpm --filter @cortex/web build`
- `curl -I http://localhost:3001`
- Browser smoke check: hero and CTAs visible, no 1280px horizontal overflow, no console errors.

### Risks

- Existing dirty backend/API/package files predated this UI pass and were not reverted.
- Visual pass is smoke-checked, not full responsive QA across every route.

### Follow-ups

- Run a deeper manual route pass once sample invoice data is ready.

## Unresolved Questions

- None.
