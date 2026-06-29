# 05 — Integrations Plan

This file is for integration subagents.

## Objective

Implement all external/system integrations cleanly:

- Casper Testnet.
- CSPR.click wallet UX.
- CSPR.cloud REST/Streaming APIs.
- Dodo Payments Test Mode checkout + webhook.
- FX conversion API.
- x402 protected agent services.

## 1. Casper Testnet Integration

### Responsibilities

- Deploy contracts.
- Submit transactions.
- Read invoice state.
- Display deploy hashes and statuses.

### Recommended Libraries

- Casper JS/TS SDK.
- CSPR.click for user wallet signing.
- CSPR.cloud Node API for maintained testnet node access.

### Environment Variables

```bash
CASPER_NETWORK=testnet
CASPER_NODE_RPC_URL=https://node.testnet.cspr.cloud
CSPR_CLOUD_REST_URL=https://api.testnet.cspr.cloud
CSPR_CLOUD_STREAM_URL=wss://streaming.testnet.cspr.cloud
CSPR_CLOUD_API_KEY=
INVOICE_REGISTRY_PACKAGE_HASH=
FUNDING_VAULT_PACKAGE_HASH=
REPAYMENT_ESCROW_PACKAGE_HASH=
AGENT_REPUTATION_PACKAGE_HASH=
MOCK_USD_PACKAGE_HASH=
SETTLEMENT_RELAYER_PRIVATE_KEY_PATH=
```

### Transaction Types

Seller/user signed via CSPR.click:

```txt
create_invoice
post_risk_score may be relayer/agent signed
list_invoice
```

Investor signed via CSPR.click:

```txt
fund_invoice
claim_repayment
```

Backend/relayer signed:

```txt
record_gateway_repayment
mark_default_after_due
agent reputation updates if separate
```

## 2. CSPR.click Integration

### Use Cases

- Connect wallet.
- Prompt user to sign transactions.
- Submit deploys.
- Show status updates.

### Implementation Notes

- Put CSPR.click client setup in `apps/web/lib/cspr-click.ts`.
- Wrap wallet state in React context.
- Every tx button must check account state.
- Show deploy processing status.

### User Transactions

```txt
Seller:
  - mint/list receivable

Investor:
  - fund receivable
  - claim repayment
```

## 3. CSPR.cloud Integration

### Use Cases

- Query deploys.
- Query account balances.
- Query contract events.
- Stream status updates.

### Base URLs

```txt
REST: https://api.testnet.cspr.cloud
Streaming: wss://streaming.testnet.cspr.cloud
Node RPC: https://node.testnet.cspr.cloud
Node SSE: https://node-sse.testnet.cspr.cloud
```

### Frontend Functions

```ts
getInvoiceState(invoiceId)
getDeployStatus(deployHash)
getAccountBalance(accountHash)
subscribeToInvoiceEvents(invoiceId, callback)
```

## 4. Dodo Payments Test Mode

### Goal

Use Dodo hosted checkout to simulate realistic buyer repayment.

### Dodo Setup

1. Create Dodo merchant account.
2. Enable Test Mode.
3. Create one-time product or dynamic checkout flow.
4. Generate API key.
5. Configure webhook endpoint:

```txt
https://your-domain.com/api/webhooks/dodo
```

6. Store webhook secret.

### Environment Variables

```bash
DODO_PAYMENTS_API_KEY=
DODO_WEBHOOK_KEY=
DODO_ENVIRONMENT=test_mode
DODO_RETURN_URL=https://your-domain.com/checkout/success
DODO_CANCEL_URL=https://your-domain.com/checkout/cancel
```

### Create Checkout Session

Route:

```txt
POST /api/payments/dodo/create-checkout
```

Request:

```json
{
  "invoiceId": "inv_123"
}
```

Server behavior:

1. Load invoice from DB.
2. Verify invoice status is funded/repayment pending.
3. Verify repayment not already recorded.
4. Create Dodo checkout session in test mode.
5. Attach metadata:

```json
{
  "invoice_id": "inv_123",
  "casper_invoice_id": "0x...",
  "expected_amount_usd_cents": "100000",
  "purpose": "cortex_invoice_repayment"
}
```

6. Store checkout session ID.
7. Return `checkout_url`.

### Webhook Handling

Route:

```txt
POST /api/webhooks/dodo
```

Must use raw body.

Steps:

```txt
1. Read raw request body.
2. Read Standard Webhooks headers:
   - webhook-id
   - webhook-signature
   - webhook-timestamp
3. Verify signature with DODO_WEBHOOK_KEY.
4. Parse payload only after verification.
5. Extract event type, payment id, amount, currency, status, metadata.
6. Verify purpose == cortex_invoice_repayment.
7. Verify invoice_id exists.
8. Verify payment id not already processed.
9. Verify amount paid >= expected repayment amount.
10. Verify currency is USD for MVP.
11. Store webhook event as verified.
12. Enqueue settlement relay.
13. Return 200 quickly.
```

### Important: Do Not Trust Redirects

The checkout success page is only UX. It is not payment proof.

Only this is payment proof:

```txt
Dodo webhook signature verified + expected event type/status + amount check + metadata match
```

### Idempotency

Store:

```txt
webhook-id UNIQUE
payment_id UNIQUE
gateway_payment_hash UNIQUE on-chain
```

If the same webhook arrives twice:

```txt
return 200
perform no second settlement
```

### Settlement Relay

After verified webhook:

```txt
record_gateway_repayment(
  invoice_id,
  sha256(dodo_payment_id),
  sha256(canonical_webhook_payload),
  paid_amount_usd_cents
)
```

Then poll Casper tx until confirmed.

### Dodo Test Cards

Use official Dodo testing docs for current test cards and payment methods.

## 5. FX Conversion Integration

### Goal

Convert uploaded invoice currency to USD automatically.

### Primary Provider

Frankfurter:

```txt
https://api.frankfurter.dev/v2/rates?base={CURRENCY}&quotes=USD
```

### Fallback Provider

ExchangeRate-API open access:

```txt
https://open.er-api.com/v6/latest/{CURRENCY}
```

### Caching

Cache by:

```txt
currency + date
```

TTL:

```txt
10 minutes during demo
24 hours acceptable for daily-rate APIs
```

### Precision

Use Decimal.js.

```ts
const usd = new Decimal(originalAmount).mul(rate);
const cents = usd.mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toString();
```

### Store FX Snapshot

```json
{
  "source": "frankfurter",
  "base_currency": "INR",
  "quote_currency": "USD",
  "rate_decimal": "0.012",
  "source_timestamp": "2026-06-28",
  "fetched_at": "2026-06-28T10:00:00Z",
  "response_hash": "..."
}
```

## 6. x402 Integration

### Goal

Show autonomous agent payments for verification services.

### Services

```txt
/api/x402/ocr
/api/x402/company-lookup
/api/x402/domain-verify
/api/x402/fx-quote
/api/x402/reminder-send
```

### Challenge Flow

```txt
Agent calls endpoint without proof
→ Endpoint returns 402 Payment Required
→ Agent signs payment proof
→ Agent retries with X-Payment header
→ Endpoint validates proof
→ Endpoint returns service result
```

### MVP Mocking Rule

If the official Casper x402 implementation takes too long to wire:

- Keep the same HTTP 402 semantics.
- Generate mock payment challenge.
- Generate signed proof hash.
- Store receipt.
- Show receipt in agent dashboard.

Do not fake it silently; label it “x402-compatible demo mode” in README if mocked.

## 7. Object Storage

For MVP:

- Store uploaded invoice locally or in S3-compatible storage.
- Store only hash on-chain.

Suggested storage path:

```txt
/invoices/{invoice_id}/original.pdf
/invoices/{invoice_id}/parsed.json
/invoices/{invoice_id}/attestation.json
```

## 8. Email/Reminder Integration

MVP options:

- Log reminders only.
- Use Resend test email.
- Use Dodo checkout link shown in buyer page.

Reminder payload:

```json
{
  "invoice_id": "...",
  "buyer_email": "ap@example.com",
  "amount_due_usd_cents": "100000",
  "checkout_url": "https://...",
  "due_date": "2026-07-15"
}
```

## Integration Tests

### Dodo

- create checkout for funded invoice.
- reject checkout for unfunded invoice.
- webhook verifies with valid signature.
- webhook rejects invalid signature.
- webhook rejects underpayment.
- duplicate webhook is idempotent.
- successful webhook enqueues relay.

### FX

- supported currency converts.
- USD path rate = 1.
- provider failure uses fallback.
- unsupported currency rejects.

### Casper

- relayer can record repayment.
- non-relayer cannot record repayment.
- frontend reads updated state.

## Docs To Reference

- Casper AI Toolkit: https://www.casper.network/ai
- Casper Developer Docs: https://docs.casper.network/
- CSPR.cloud overview: https://docs.cspr.cloud/documentation/overview
- CSPR.click docs: https://docs.cspr.click/
- Dodo integration guide: https://docs.dodopayments.com/developer-resources/integration-guide
- Dodo testing guide: https://docs.dodopayments.com/miscellaneous/testing-process
- Dodo CLI: https://docs.dodopayments.com/developer-resources/sdks/cli
- Standard Webhooks: https://standardwebhooks.com/
- Frankfurter: https://frankfurter.dev/
- ExchangeRate-API free endpoint: https://www.exchangerate-api.com/docs/free
