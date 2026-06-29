import { Webhook } from "standardwebhooks";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "@cortex/shared";
import {
  buildDodoCheckoutPayload,
  createDodoCheckout,
  handleCheckoutReturn,
  handleDodoWebhook,
  type DodoCheckoutClient,
  type DodoCheckoutCreateRequest
} from "../server/integrations/dodo";
import { InMemoryPaymentStore } from "../server/integrations/payment-store";
import { MemoryCasperSettlementClient, type CasperSettlementClient } from "../server/integrations/settlement-relayer";

const secret = "test_webhook_secret";
const now = new Date();

class FakeDodoClient implements DodoCheckoutClient {
  requests: DodoCheckoutCreateRequest[] = [];

  async createCheckout(input: DodoCheckoutCreateRequest) {
    this.requests.push(input);
    return {
      sessionId: "cks_test_123",
      checkoutUrl: "https://test.dodopayments.com/checkout/cks_test_123",
      paymentId: "pay_pending_123"
    };
  }
}

function createStore() {
  const store = new InMemoryPaymentStore();
  void store.upsertInvoice({
    id: "inv_1",
    invoiceHash: sha256Hex("invoice"),
    repaymentAmountUsdCents: "125000",
    statusCasper: "RepaymentPending"
  });
  return store;
}

function signPayload(payload: unknown) {
  const rawBody = JSON.stringify(payload);
  const webhook = new Webhook(secret, { format: "raw" });
  const id = typeof payload === "object" && payload && "id" in payload ? String(payload.id) : "evt_default";
  const timestamp = now;
  return {
    rawBody,
    headers: {
      "webhook-id": id,
      "webhook-timestamp": Math.floor(timestamp.getTime() / 1000).toString(),
      "webhook-signature": webhook.sign(id, timestamp, rawBody)
    }
  };
}

function successfulPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_1",
    type: "payment.succeeded",
    data: {
      payment_id: "pay_1",
      status: "succeeded",
      total_amount: "125000",
      currency: "USD",
      metadata: {
        invoice_id: "inv_1",
        invoice_hash: sha256Hex("invoice"),
        expected_amount_usd_cents: "125000",
        nonce: "nonce_nonce_nonce_1",
        environment: "test_mode",
        purpose: "cortex_invoice_repayment"
      },
      ...overrides
    }
  };
}

describe("Dodo repayment integration", () => {
  it("creates checkout only for RepaymentPending Casper invoices with immutable metadata", async () => {
    const store = createStore();
    const dodo = new FakeDodoClient();
    const result = await createDodoCheckout({
      input: { invoiceId: "inv_1", buyerEmail: "buyer@example.com" },
      store,
      casper: new MemoryCasperSettlementClient(store),
      dodo,
      nonceFactory: () => "nonce_nonce_nonce_1",
      now: () => now
    });

    expect(result.checkoutUrl).toContain("dodopayments.com");
    expect(result.metadata).toEqual({
      invoice_id: "inv_1",
      invoice_hash: sha256Hex("invoice"),
      expected_amount_usd_cents: "125000",
      nonce: "nonce_nonce_nonce_1",
      environment: "test_mode",
      purpose: "cortex_invoice_repayment"
    });
    expect(dodo.requests[0]?.amountUsdCents).toBe("125000");
  });

  it("builds Dodo Pay What You Want dynamic pricing payload from invoice repayment cents", () => {
    const request = {
      invoiceId: "inv_1",
      amountUsdCents: "125000",
      buyerEmail: "buyer@example.com",
      metadata: {
        invoice_id: "inv_1",
        invoice_hash: sha256Hex("invoice"),
        expected_amount_usd_cents: "125000",
        nonce: "nonce_nonce_nonce_1",
        environment: "test_mode" as const,
        purpose: "cortex_invoice_repayment" as const
      }
    };

    expect(
      buildDodoCheckoutPayload(
        request,
        "pdt_pay_what_you_want",
        "http://localhost:3000/checkout/success",
        "http://localhost:3000/checkout/cancel"
      )
    ).toEqual({
      customer: { email: "buyer@example.com" },
      metadata: request.metadata,
      product_cart: [{ product_id: "pdt_pay_what_you_want", quantity: 1, amount: 125000 }],
      return_url: "http://localhost:3000/checkout/success",
      cancel_url: "http://localhost:3000/checkout/cancel"
    });
  });

  it("accepts a valid signed payment.succeeded webhook and records Casper repayment", async () => {
    const store = createStore();
    const casper = new MemoryCasperSettlementClient(store);
    const signed = signPayload(successfulPayload());

    const result = await handleDodoWebhook({
      rawBody: signed.rawBody,
      headers: signed.headers,
      webhookSecret: secret,
      secretFormat: "raw",
      store,
      casper,
      now: () => now
    });

    expect(result.outcome).toBe("accepted");
    if (result.outcome !== "accepted") throw new Error("Expected accepted");
    expect(result.relayerJob.status).toBe("confirmed");
    expect((await store.requireInvoice("inv_1")).statusCasper).toBe("Repaid");
    expect(result.webhook.casperDeployHash).toBe("casper-deploy-0001");
  });

  it("rejects invalid signatures before parsing", async () => {
    const store = createStore();
    const signed = signPayload(successfulPayload());
    const result = await handleDodoWebhook({
      rawBody: signed.rawBody.replace("125000", "100"),
      headers: signed.headers,
      webhookSecret: secret,
      secretFormat: "raw",
      store,
      casper: new MemoryCasperSettlementClient(store),
      now: () => now
    });

    expect(result).toEqual({ outcome: "rejected", reason: "invalid_signature" });
  });

  it("ignores replayed webhook safely", async () => {
    const store = createStore();
    const casper = new MemoryCasperSettlementClient(store);
    const signed = signPayload(successfulPayload());
    const first = await handleDodoWebhook({
      rawBody: signed.rawBody,
      headers: signed.headers,
      webhookSecret: secret,
      secretFormat: "raw",
      store,
      casper,
      now: () => now
    });
    const second = await handleDodoWebhook({
      rawBody: signed.rawBody,
      headers: signed.headers,
      webhookSecret: secret,
      secretFormat: "raw",
      store,
      casper,
      now: () => now
    });

    expect(first.outcome).toBe("accepted");
    expect(second.outcome).toBe("duplicate");
    expect((await store.getRelayerJobByGatewayHash(sha256Hex("pay_1")))?.attempts).toBe(1);
  });

  it("rejects underpayment webhook", async () => {
    const store = createStore();
    const signed = signPayload(
      successfulPayload({
        total_amount: "100000",
        metadata: {
          invoice_id: "inv_1",
          invoice_hash: sha256Hex("invoice"),
          expected_amount_usd_cents: "100000",
          nonce: "nonce_nonce_nonce_1",
          environment: "test_mode",
          purpose: "cortex_invoice_repayment"
        }
      })
    );
    const result = await handleDodoWebhook({
      rawBody: signed.rawBody,
      headers: signed.headers,
      webhookSecret: secret,
      secretFormat: "raw",
      store,
      casper: new MemoryCasperSettlementClient(store),
      now: () => now
    });

    expect(result).toEqual({ outcome: "rejected", reason: "metadata_amount_mismatch" });
  });

  it("rejects wrong invoice metadata", async () => {
    const store = createStore();
    const signed = signPayload(
      successfulPayload({
        metadata: {
          invoice_id: "inv_1",
          invoice_hash: sha256Hex("wrong"),
          expected_amount_usd_cents: "125000",
          nonce: "nonce_nonce_nonce_1",
          environment: "test_mode",
          purpose: "cortex_invoice_repayment"
        }
      })
    );
    const result = await handleDodoWebhook({
      rawBody: signed.rawBody,
      headers: signed.headers,
      webhookSecret: secret,
      secretFormat: "raw",
      store,
      casper: new MemoryCasperSettlementClient(store),
      now: () => now
    });

    expect(result).toEqual({ outcome: "rejected", reason: "invoice_hash_mismatch" });
  });

  it("return URL never marks repayment complete", () => {
    expect(handleCheckoutReturn()).toEqual({
      repaymentStatus: "pending_webhook",
      message: "Return URL is not payment proof. Waiting for verified Dodo webhook."
    });
  });

  it("keeps relayer failure retryable without double-spend", async () => {
    const store = createStore();
    const failingCasper: CasperSettlementClient = {
      async getInvoice(invoiceId) {
        return new MemoryCasperSettlementClient(store).getInvoice(invoiceId);
      },
      async recordGatewayRepayment() {
        throw new Error("network down");
      }
    };
    const signed = signPayload(successfulPayload());
    const result = await handleDodoWebhook({
      rawBody: signed.rawBody,
      headers: signed.headers,
      webhookSecret: secret,
      secretFormat: "raw",
      store,
      casper: failingCasper,
      now: () => now
    });

    expect(result.outcome).toBe("accepted");
    if (result.outcome !== "accepted") throw new Error("Expected accepted");
    expect(result.relayerJob.status).toBe("retryable_failed");
    expect((await store.requireInvoice("inv_1")).statusCasper).toBe("RepaymentPending");
    expect((await store.getRelayerJobByGatewayHash(sha256Hex("pay_1")))?.attempts).toBe(1);
  });
});
