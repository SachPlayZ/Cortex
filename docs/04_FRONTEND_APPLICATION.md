# 04 — Frontend Application Plan

This file is for the frontend subagent.

## Objective

Build a polished Next.js application that makes Cortex feel like a real product:

```txt
Upload invoice → AI verifies → Get funding terms → Mint receivable → Investor funds → Buyer repays via Dodo → Investor claims
```

The UI must clearly prove Casper + Agentic AI + DeFi + RWA.

## Stack

```txt
Next.js App Router
TypeScript
TailwindCSS
shadcn/ui
CSPR.click
CSPR.cloud REST/Streaming API
Dodo Payments checkout redirect
```

## Routes

```txt
/                         Landing page
/seller                   Seller dashboard
/seller/upload            Invoice upload flow
/seller/invoices          Seller invoice list
/investor                 Investor marketplace
/invoice/[invoiceId]      Public invoice detail page
/buyer/pay/[invoiceId]    Dodo checkout creation/repayment page
/agent                    Agent operations dashboard
/admin                    Dev-only relayer/debug dashboard
/checkout/success         Dodo return URL success view
/checkout/cancel          Dodo return URL cancelled view
```

## API Routes

```txt
/api/invoices/upload
/api/invoices/[id]
/api/invoices/[id]/mint
/api/invoices/[id]/list
/api/invoices/[id]/fund
/api/payments/dodo/create-checkout
/api/webhooks/dodo
/api/agent/run-underwriting
/api/agent/runs/[invoiceId]
/api/casper/state/[invoiceId]
```

## UX Principles

### Make Web3 Invisible Until Needed

The seller should first upload and understand the financing offer. Then ask them to connect wallet and mint/list.

### Make AI Visible But Auditable

Show the agent trace with concrete checks, not generic “AI is thinking.”

### Make Repayment Feel Real

Use a Dodo hosted checkout link for the buyer. Do not use a fake “simulate payment” button as the main path.

### Make Casper Visible To Judges

Every important transition should show a Casper deploy hash / status.

## Page Details

## 1. Landing Page `/`

### Hero Copy

```txt
Cortex
AI-underwritten invoice financing on Casper.

Upload an unpaid invoice. Get an instant funding offer. Let investors finance your receivable on-chain.
```

### CTA Buttons

```txt
Upload Invoice
Explore Receivables
```

### Sections

- For freelancers: get paid early.
- For investors: fund short-duration receivables.
- For agents: verify, price, and settle invoices autonomously.
- Powered by Casper: x402, CSPR.click, CSPR.cloud, Odra.

## 2. Seller Upload `/seller/upload`

### Stepper

```txt
1. Upload Invoice
2. AI Extraction
3. Currency Conversion
4. Verification
5. Risk Pricing
6. Mint Receivable
7. Listed for Funding
```

### Upload Component

Accepted:

```txt
PDF, PNG, JPG
Max size: 10MB
```

### After Upload

Show:

```txt
Evidence hash
Invoice number
Buyer
Original amount/currency
USD converted amount
Due date
Payment terms
Extraction confidence
```

### Review Fields

Allow user to correct non-critical fields before minting, but record corrections in the attestation.

Fields editable before minting:

- Buyer email.
- Buyer domain.
- Payment terms.

Fields not editable without re-running agent:

- Amount.
- Currency.
- Due date.
- Invoice number.

## 3. Seller Dashboard `/seller`

Cards:

```txt
Total Invoice Face Value
Total Advanced
Open Receivables
Settled Receivables
Defaulted Receivables
```

Invoice table:

```txt
Invoice ID | Buyer | USD Face Value | Risk | Status | Funding | Due Date | Action
```

## 4. Investor Marketplace `/investor`

This is the core DeFi screen.

Columns:

```txt
Invoice
Risk Tier
AI Confidence
Due In
Face Value
Funding Required
Expected Return
APR-equivalent
Status
```

APR-equivalent for display only:

```txt
simple_return = (repayment - advance) / advance
apr_equivalent = simple_return * (365 / days_to_due)
```

Do not use APR in contract logic.

### Investor Card Example

```txt
INV-2026-018
Low Risk · 94% AI confidence
Due in 27 days
Fund $965.00 → Receive $1,000.00
Expected return: 3.63%
```

CTA:

```txt
Fund Receivable
```

## 5. Invoice Detail `/invoice/[invoiceId]`

Sections:

### Summary

```txt
Status
Seller wallet
Buyer hash
Invoice hash
Face value
Advance amount
Repayment amount
Due date
Risk tier
```

### AI Underwriting

Show:

```txt
Risk score
Discount bps
Explanation
Verification checks
FX conversion source
Attestation hash
```

### Casper Lifecycle

Timeline:

```txt
Created → Scored → Listed → Funded → Repaid → Settled
```

Each state should show:

```txt
Timestamp
Deploy hash
Explorer link if available
```

### Payment Lifecycle

```txt
Dodo checkout created
Webhook received
Webhook verified
Settlement relay submitted
Casper repayment recorded
Investor claimed
```

## 6. Buyer Repayment `/buyer/pay/[invoiceId]`

This is the web2 repayment screen.

Show:

```txt
Invoice due to: Seller display name
Amount due: $1,000.00
Due date
Pay securely with Dodo Test Mode
```

CTA:

```txt
Pay Invoice
```

On click:

```txt
POST /api/payments/dodo/create-checkout
redirect to Dodo checkout_url
```

Do not show “Paid” after return URL alone. Show:

```txt
Payment submitted. Waiting for verified webhook settlement.
```

Then poll/stream status.

## 7. Checkout Success `/checkout/success`

Display:

```txt
Payment completed in checkout.
Waiting for verified webhook and Casper settlement.
```

States:

```txt
Webhook pending
Webhook verified
Casper repayment submitted
Casper repayment confirmed
```

## 8. Agent Dashboard `/agent`

Show live agent runs.

### Trace Example

```txt
[Parser Agent] Extracted invoice #INV-018 with 94% confidence.
[FX Agent] Converted INR 83,000.00 → USD 996.00 using Frankfurter.
[Verification Agent] Duplicate hash check passed.
[x402] Paid 0.001 CSPR for OCR verification.
[x402] Paid 0.001 CSPR for buyer domain lookup.
[Risk Agent] Assigned Low risk, 3.0% discount.
[Attestation Agent] Generated attestation hash.
[Settlement Agent] Waiting for Dodo webhook.
```

### Agent Metrics

```txt
Registered agent wallet
On-chain reputation
Invoices scored
Successful repayments
Defaults
Low-risk defaults
```

## Components

```txt
components/
  InvoiceUploader.tsx
  InvoiceExtractionCard.tsx
  FxConversionCard.tsx
  RiskScoreCard.tsx
  FundingTermsCard.tsx
  CasperTimeline.tsx
  DodoPaymentStatus.tsx
  AgentTrace.tsx
  InvestorInvoiceCard.tsx
  WalletConnectButton.tsx
  DeployHashLink.tsx
```

## Frontend State Model

Use a typed status union:

```ts
type InvoiceUiStatus =
  | "uploading"
  | "parsing"
  | "fx_converting"
  | "verifying"
  | "scoring"
  | "ready_to_mint"
  | "minting"
  | "listed"
  | "funding"
  | "funded"
  | "checkout_created"
  | "webhook_pending"
  | "webhook_verified"
  | "repayment_relaying"
  | "repaid_on_chain"
  | "claimable"
  | "settled"
  | "defaulted"
  | "rejected";
```

## API Response Contracts

### Upload Response

```ts
{
  invoiceId: string;
  evidenceHash: string;
  parsed: ParsedInvoice;
  fx: FxQuote;
  verification: VerificationReport;
  pricing: RiskPricing;
  attestationHash: string;
  status: "ready_to_mint" | "rejected";
}
```

### Create Checkout Response

```ts
{
  invoiceId: string;
  checkoutSessionId: string;
  checkoutUrl: string;
  expectedAmountUsdCents: string;
}
```

### Payment Status Response

```ts
{
  invoiceId: string;
  dodoPaymentStatus: "created" | "paid" | "failed" | "webhook_verified";
  relayStatus: "not_started" | "queued" | "submitted" | "confirmed" | "failed";
  casperTxHash?: string;
  onChainStatus: string;
}
```

## CSPR.click Requirements

Use CSPR.click for:

- Wallet connect.
- Mint/list transaction signing.
- Investor funding transaction signing.
- Investor claim transaction signing.

UX requirement:

- Disable tx buttons if wallet disconnected.
- Show connected account.
- Show transaction processing status.
- Use CSPR.cloud/CSPR.click status updates where available.

## CSPR.cloud Requirements

Use CSPR.cloud for:

- Reading invoice contract events.
- Polling deploy status.
- Showing transaction timeline.
- Optional streaming updates for live dashboard.

## Dodo UI Requirements

- Buyer repayment goes through hosted checkout.
- Return URL must not be trusted as final payment proof.
- UI must wait for server-side webhook verification.
- Display a nice “Webhook verified → Casper repayment submitted” flow.

## Error States

Display clear errors for:

```txt
Unsupported invoice currency
FX conversion failed
Duplicate invoice
Due date has passed
Agent rejected invoice
Wallet not connected
Casper transaction failed
Dodo checkout creation failed
Webhook verification pending
Webhook amount mismatch
Settlement relay failed
```

## Design Direction

Visual style:

```txt
Dark premium fintech
Clean cards
Timeline-driven
Minimal charts
Strong status badges
No AI slop
```

Suggested colors:

```txt
Background: #0B0D10
Surface: #12161B
Surface High: #1A2027
Border: rgba(255,255,255,0.08)
Text: #F4F7FA
Muted: rgba(244,247,250,0.62)
Accent: #B7FF5A or #9B86FF
Success: #86D6A8
Warning: #E6C25A
Error: #E08A8A
```

## Required Frontend Tests

Use Playwright or Cypress.

### Seller Flow

- upload sample invoice.
- see parsed fields.
- see USD conversion.
- see risk score.
- click mint/list.
- verify Casper tx state shown.

### Investor Flow

- open marketplace.
- inspect listed invoice.
- fund invoice.
- status becomes funded/repayment pending.

### Buyer Repayment Flow

- open buyer payment page.
- create Dodo checkout.
- after webhook fixture, status progresses to repayment relaying.
- after mock Casper confirmation, status becomes repaid/claimable.

### Error Flow

- fake invoice shows rejected.
- underpayment webhook does not mark repaid.
- duplicate webhook does not duplicate settlement.

## Docs To Reference

- Next.js: https://nextjs.org/docs
- shadcn/ui: https://ui.shadcn.com/
- CSPR.click overview: https://docs.cspr.click/documentation/overview
- CSPR.click React: https://docs.cspr.click/cspr.click-sdk/react
- CSPR.click signing transactions: https://docs.cspr.click/cspr.click-sdk/react/signing-transactions
- CSPR.cloud docs: https://docs.cspr.cloud/
- Dodo one-time payments: https://docs.dodopayments.com/developer-resources/integration-guide
- Dodo testing: https://docs.dodopayments.com/miscellaneous/testing-process
