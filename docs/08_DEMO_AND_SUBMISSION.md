# 08 — Demo and Submission Plan

## Demo Goal

Show that Cortex is not just a concept. It is a working Casper Testnet prototype where:

- AI agents underwrite an invoice.
- The invoice becomes an on-chain receivable.
- Investor funding happens on Casper.
- Buyer repayment happens through Dodo Test Mode checkout.
- A verified webhook triggers a Casper repayment transaction.
- Investor claims repayment/yield.

## Demo Assets

Prepare three sample invoices:

```txt
samples/invoices/low-risk-invoice-inr.pdf
samples/invoices/medium-risk-invoice-usd.pdf
samples/invoices/fake-duplicate-invoice.pdf
```

## Demo Wallets

```txt
Seller Wallet
Investor Wallet
Settlement Relayer Wallet
Agent Wallet
Buyer email identity for Dodo checkout
```

## Demo Script

### 0:00 — Problem

```txt
Freelancers and small agencies wait weeks to get paid. Cortex turns unpaid invoices into AI-underwritten on-chain receivables, letting investors fund short-term real-world cash flows.
```

### 0:15 — Upload Invoice

- Open seller dashboard.
- Upload INR invoice.
- Show evidence hash.

Say:

```txt
The invoice is a web2 document. We do not put the PDF on-chain; we store a hash and let agents verify it.
```

### 0:35 — AI Underwriting

Show agent trace:

```txt
Parser Agent extracted invoice fields.
FX Agent converted INR to USD using current rate.
Verification Agent checked duplicate hash and buyer domain.
Risk Agent priced the discount.
```

Point out:

```txt
All money is normalized into USD cents to avoid rounding bugs.
```

### 1:10 — Mint Receivable on Casper

- Connect seller wallet through CSPR.click.
- Submit mint/list transaction.
- Show Casper deploy hash.
- Show status becomes Listed.

Say:

```txt
The receivable lifecycle is now on Casper Testnet.
```

### 1:40 — Investor Funds

- Switch to investor marketplace.
- Open listed invoice.
- Show risk tier, due date, funding amount, expected repayment.
- Fund invoice.
- Show status becomes RepaymentPending.

Say:

```txt
The seller receives early liquidity; the investor now owns the repayment claim.
```

### 2:20 — Buyer Repays Through Dodo

- Open buyer repayment page.
- Click Pay Invoice.
- Redirect to Dodo Test Mode checkout.
- Use official Dodo test payment method.
- Return to checkout success page.

Say:

```txt
We do not trust the redirect URL. The app waits for a signed Dodo webhook.
```

### 3:00 — Webhook → Casper Settlement

Show payment status timeline:

```txt
Dodo webhook received
Webhook signature verified
Amount and invoice metadata matched
Settlement relayer submitted Casper transaction
Invoice marked Repaid on-chain
```

### 3:35 — Investor Claims

- Investor clicks Claim.
- Casper transaction confirms.
- Status becomes Settled.
- Agent reputation increases.

Say:

```txt
This completes the full web2-to-web3 repayment loop.
```

### 4:00 — Rejected Invoice

- Upload fake duplicate invoice.
- Show rejection.

Say:

```txt
The agent prevents bad invoices from becoming investable assets.
```

### 4:30 — Closing

```txt
Cortex makes Casper the trust layer for agent-managed real-world receivables: AI verifies, DeFi funds, Dodo simulates realistic repayment, and Casper settles the lifecycle.
```

## What To Show In README

- Project overview.
- Architecture diagram.
- Casper components used.
- Contract addresses/package hashes.
- Testnet transaction hashes.
- Dodo Test Mode repayment explanation.
- Agent pipeline explanation.
- How to run locally.
- How to test webhook fixtures.
- Known limitations.
- Future roadmap.

## Submission Checklist

- [ ] Working prototype deployed.
- [ ] Casper Testnet transaction-producing component.
- [ ] Public GitHub repo.
- [ ] README with setup and usage.
- [ ] Demo video public.
- [ ] Contract package hashes included.
- [ ] Testnet tx hashes included.
- [ ] Dodo test webhook explanation included.
- [ ] Agentic AI clearly visible.
- [ ] DeFi/RWA angle clearly explained.

## Final Pitch

```txt
Cortex is an AI-underwritten receivables marketplace on Casper. Freelancers upload invoices, agents verify and price them, investors fund discounted claims, and Dodo Test Mode repayments are bridged through verified webhooks into Casper settlement. It demonstrates the full loop of agentic AI, DeFi, and real-world assets.
```

## Future Roadmap

### V1

- Multi-investor receivable pools.
- CEP-18 stablecoin settlement.
- Real buyer KYC and invoice verification.
- Legal document templates.
- Late payment penalties.

### V2

- Secondary market for receivable claims.
- Agent reputation marketplace.
- Insurance pool for defaults.
- Seller credit history.
- Buyer risk graph.

### V3

- Real fiat/stablecoin settlement.
- Accounting software integrations.
- Cross-border SME receivable financing.
