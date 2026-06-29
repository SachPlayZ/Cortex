# Cortex — AI Invoice Financing Agent

Cortex is an AI-underwritten invoice financing marketplace built for the Casper Agentic Buildathon. Freelancers and small businesses upload unpaid invoices, an underwriting agent verifies and prices risk, the invoice becomes an on-chain receivable, investors fund the receivable, and repayment is triggered through a Dodo Payments Test Mode checkout + verified webhook + Casper settlement transaction.

## Buildathon Fit

Cortex is intentionally designed around the Casper buildathon criteria:

- **Agentic AI:** AI agents extract invoice data, verify invoice integrity, convert currencies, price risk, trigger reminders, and monitor settlement.
- **DeFi:** Investors fund discounted receivables and claim repayment/yield.
- **RWA:** The invoice is the real-world asset; the on-chain record represents its financing lifecycle.
- **Casper:** Casper Testnet contracts record invoice state, funding, repayment, settlement, and agent reputation.
- **x402:** Agents pay per verification request for OCR, FX lookup, company/domain verification, and reminder dispatch.
- **DodoPayments Test Mode:** Buyer repayment is simulated through a realistic hosted checkout and webhook, not a fake “mark paid” button.

## Repository Layout

```txt
cortex/
  apps/
    web/                       # Next.js frontend + API routes
  contracts/                   # Casper/Odra smart contracts
  agents/                      # Agent orchestrator + tools
  docs/                        # These planning docs
  packages/
    shared/                    # shared schemas, constants, hashing helpers
```

## Documentation Files

Read in this order:

1. [`00_PROJECT_BRIEF.md`](./00_PROJECT_BRIEF.md)
2. [`01_SYSTEM_ARCHITECTURE.md`](./01_SYSTEM_ARCHITECTURE.md)
3. [`02_CONTRACTS.md`](./02_CONTRACTS.md)
4. [`03_AGENTS.md`](./03_AGENTS.md)
5. [`04_FRONTEND_APPLICATION.md`](./04_FRONTEND_APPLICATION.md)
6. [`05_INTEGRATIONS.md`](./05_INTEGRATIONS.md)
7. [`06_TESTING_AND_SECURITY.md`](./06_TESTING_AND_SECURITY.md)
8. [`07_SUBAGENT_TASKS.md`](./07_SUBAGENT_TASKS.md)
9. [`08_DEMO_AND_SUBMISSION.md`](./08_DEMO_AND_SUBMISSION.md)
10. [`09_REFERENCE_LINKS.md`](./09_REFERENCE_LINKS.md)

## The One Flow That Must Work

```txt
Seller uploads invoice
→ Agent extracts invoice amount/currency/due date/buyer
→ FX Agent converts invoice to canonical USD cents
→ Verification Agent checks duplicate hash, domain, due date, invoice shape
→ Risk Agent assigns risk tier + discount
→ Seller mints/list receivable on Casper Testnet
→ Investor funds receivable on Casper Testnet
→ Buyer receives Dodo Test Mode checkout link for repayment
→ Dodo webhook verifies successful payment
→ Backend settlement relayer submits repayment transaction to Casper
→ Investor claims repayment/yield
→ Agent reputation updates
```

## MVP Rule

Build the narrow version well:

- One seller per invoice.
- One investor per invoice.
- One invoice funded at a time.
- Repayment happens through Dodo Test Mode + webhook + relayer.
- Amounts normalized to USD cents.
- Casper contract state is the final source of truth for financing state.

## Non-Goals for MVP

- No legal claims that the receivable is enforceable debt.
- No production factoring compliance.
- No multi-investor fractionalization.
- No real fiat settlement.
- No production stablecoin custody.

Use language like:

> Cortex is a testnet prototype for AI-underwritten receivable financing workflows.
