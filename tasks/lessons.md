# Lessons

## Pattern

- Mistake: Interpreted "local OCR" as OS-native tooling instead of package-based OCR.
- Rule: When user contrasts "local" with hosted model OCR, prefer in-repo/package runtime first; avoid OS-specific tooling unless user asks.

## Deployment configuration

- Mistake: Documented Vercel's private-key path incompatibility without first making the runtime accept deployable secret values.
- Rule: For serverless deployment work, support inline secret material with local file-path fallback; align requested model defaults in every call path.
- Mistake: Assumed the browser could use a hosted HTTPS Casper RPC endpoint when the deployment RPC is HTTP-only.
- Rule: Keep HTTP RPC URLs server-only and expose a fixed, validated same-origin HTTPS proxy for browser wallets.
- Mistake: Persisted Casper bootstrap state and event cursors under global IDs that survived contract redeployments.
- Rule: Scope all chain-derived cursors and bootstrap records to the active package hashes.
