import { randomBytes, randomUUID } from "node:crypto";
import { Webhook, WebhookVerificationError } from "standardwebhooks";
import {
  DodoCheckoutMetadataSchema,
  DodoWebhookEventSchema,
  hashJson,
  sha256Hex,
  type DodoCheckoutMetadata,
  type DodoWebhookRecord
} from "@cortex/shared";
import { type PaymentStore, type RelayerJobRecord } from "./payment-store";
import { type CasperSettlementClient, SettlementRelayer } from "./settlement-relayer";

const SUCCESSFUL_DODO_EVENT_TYPE = "payment.succeeded";

type JsonRecord = Record<string, unknown>;

export type CreateCheckoutInput = {
  invoiceId: string;
  buyerEmail?: string | undefined;
};

export type DodoCheckoutCreateRequest = {
  invoiceId: string;
  amountUsdCents: string;
  buyerEmail?: string | undefined;
  metadata: DodoCheckoutMetadata;
};

export type DodoCheckoutCreateResponse = {
  sessionId: string;
  checkoutUrl: string;
  paymentId?: string | undefined;
};

export interface DodoCheckoutClient {
  createCheckout(input: DodoCheckoutCreateRequest): Promise<DodoCheckoutCreateResponse>;
}

export class HttpDodoCheckoutClient implements DodoCheckoutClient {
  constructor(
    private readonly apiKey: string,
    private readonly productId: string,
    private readonly baseUrl = "https://test.dodopayments.com",
    private readonly returnUrl?: string,
    private readonly cancelUrl?: string
  ) {}

  async createCheckout(input: DodoCheckoutCreateRequest): Promise<DodoCheckoutCreateResponse> {
    const response = await fetch(`${this.baseUrl}/checkouts`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(buildDodoCheckoutPayload(input, this.productId, this.returnUrl, this.cancelUrl))
    });
    if (!response.ok) {
      throw new Error(`Dodo checkout failed: ${response.status}`);
    }
    const body = (await response.json()) as {
      session_id?: string;
      checkout_url?: string;
      payment_id?: string;
    };
    if (!body.session_id || !body.checkout_url) {
      throw new Error("Dodo checkout response missing session_id or checkout_url");
    }
    const checkout: DodoCheckoutCreateResponse = {
      sessionId: body.session_id,
      checkoutUrl: body.checkout_url
    };
    if (body.payment_id) {
      checkout.paymentId = body.payment_id;
    }
    return checkout;
  }
}

export function buildDodoCheckoutPayload(
  input: DodoCheckoutCreateRequest,
  productId: string,
  returnUrl?: string,
  cancelUrl?: string
): JsonRecord {
  const payload: JsonRecord = {
    metadata: input.metadata,
    product_cart: [
      {
        product_id: productId,
        quantity: 1,
        amount: toDodoMinorUnitAmount(input.amountUsdCents)
      }
    ]
  };
  if (input.buyerEmail) {
    payload.customer = { email: input.buyerEmail };
  }
  if (returnUrl) {
    payload.return_url = returnUrl;
  }
  if (cancelUrl) {
    payload.cancel_url = cancelUrl;
  }
  return payload;
}

function toDodoMinorUnitAmount(amountUsdCents: string): number {
  if (!/^(0|[1-9]\d*)$/.test(amountUsdCents)) {
    throw new Error("Dodo dynamic amount must be an integer cents string");
  }
  const amount = BigInt(amountUsdCents);
  if (amount <= 0n) {
    throw new Error("Dodo dynamic amount must be greater than zero");
  }
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Dodo dynamic amount exceeds JavaScript safe integer range");
  }
  return Number(amount);
}

export type CreateCheckoutResult = {
  sessionId: string;
  checkoutUrl: string;
  metadata: DodoCheckoutMetadata;
};

export async function createDodoCheckout(params: {
  input: CreateCheckoutInput;
  store: PaymentStore;
  casper: CasperSettlementClient;
  dodo: DodoCheckoutClient;
  nonceFactory?: () => string;
  now?: () => Date;
}): Promise<CreateCheckoutResult> {
  const invoice = await params.store.requireInvoice(params.input.invoiceId);
  const casperInvoice = await params.casper.getInvoice(params.input.invoiceId);
  if (casperInvoice.status !== "RepaymentPending") {
    throw new Error(`Checkout blocked until Casper status is RepaymentPending, got ${casperInvoice.status}`);
  }
  if (casperInvoice.repaymentAmountUsdCents !== invoice.repaymentAmountUsdCents) {
    throw new Error("Checkout blocked by Casper/local repayment amount mismatch");
  }

  const metadata = DodoCheckoutMetadataSchema.parse({
    invoice_id: invoice.id,
    invoice_hash: invoice.invoiceHash,
    expected_amount_usd_cents: invoice.repaymentAmountUsdCents,
    nonce: params.nonceFactory?.() ?? randomBytes(16).toString("hex"),
    environment: "test_mode",
    purpose: "cortex_invoice_repayment"
  });
  const checkoutRequest: DodoCheckoutCreateRequest = {
    invoiceId: invoice.id,
    amountUsdCents: invoice.repaymentAmountUsdCents,
    metadata
  };
  if (params.input.buyerEmail) {
    checkoutRequest.buyerEmail = params.input.buyerEmail;
  }
  const checkout = await params.dodo.createCheckout(checkoutRequest);

  await params.store.recordCheckout({
    sessionId: checkout.sessionId,
    checkoutUrl: checkout.checkoutUrl,
    invoiceId: invoice.id,
    metadata,
    createdAt: (params.now?.() ?? new Date()).toISOString()
  });
  if (checkout.paymentId) {
    await params.store.updateInvoice(invoice.id, { dodoPaymentId: checkout.paymentId });
  }

  return {
    sessionId: checkout.sessionId,
    checkoutUrl: checkout.checkoutUrl,
    metadata
  };
}

export type DodoWebhookHeaders = {
  "webhook-id": string;
  "webhook-timestamp": string;
  "webhook-signature": string;
};

export type DodoWebhookHandleResult =
  | { outcome: "accepted"; webhook: DodoWebhookRecord; relayerJob: RelayerJobRecord }
  | { outcome: "duplicate"; webhook: DodoWebhookRecord }
  | { outcome: "rejected"; reason: string };

export async function handleDodoWebhook(params: {
  rawBody: string | Buffer;
  headers: DodoWebhookHeaders | Record<string, string>;
  webhookSecret: string;
  store: PaymentStore;
  casper: CasperSettlementClient;
  secretFormat?: "standard" | "raw";
  now?: () => Date;
}): Promise<DodoWebhookHandleResult> {
  let payload: unknown;
  try {
    const webhook = new Webhook(
      params.webhookSecret,
      params.secretFormat === "raw" ? { format: "raw" } : undefined
    );
    payload = webhook.verify(params.rawBody, params.headers);
  } catch (error) {
    if (error instanceof WebhookVerificationError || error instanceof Error) {
      return { outcome: "rejected", reason: "invalid_signature" };
    }
    return { outcome: "rejected", reason: "invalid_signature" };
  }

  const normalized = normalizeDodoPaymentEvent(payload, params.now?.() ?? new Date());
  const parsed = DodoWebhookEventSchema.safeParse(normalized);
  if (!parsed.success) {
    return { outcome: "rejected", reason: "invalid_payload" };
  }
  const event = parsed.data;
  if (event.event_type !== SUCCESSFUL_DODO_EVENT_TYPE || event.status.toLowerCase() !== "succeeded") {
    return { outcome: "rejected", reason: "not_successful_payment" };
  }

  const gatewayPaymentHash = sha256Hex(event.payment_id);
  const duplicate =
    (await params.store.getWebhookByEventId(event.event_id)) ??
    (await params.store.getWebhookByPaymentId(event.payment_id)) ??
    (await params.store.getWebhookByGatewayHash(gatewayPaymentHash));
  if (duplicate) {
    return { outcome: "duplicate", webhook: duplicate };
  }

  let invoice;
  try {
    invoice = await params.store.requireInvoice(event.metadata.invoice_id);
  } catch {
    return { outcome: "rejected", reason: "unknown_invoice" };
  }
  if (event.metadata.invoice_hash !== invoice.invoiceHash) {
    return { outcome: "rejected", reason: "invoice_hash_mismatch" };
  }
  if (event.metadata.expected_amount_usd_cents !== invoice.repaymentAmountUsdCents) {
    return { outcome: "rejected", reason: "metadata_amount_mismatch" };
  }
  if (event.amount_usd_cents !== event.metadata.expected_amount_usd_cents) {
    return { outcome: "rejected", reason: "paid_amount_metadata_mismatch" };
  }
  if (BigInt(event.amount_usd_cents) < BigInt(invoice.repaymentAmountUsdCents)) {
    return { outcome: "rejected", reason: "underpayment" };
  }

  const casperInvoice = await params.casper.getInvoice(invoice.id);
  if (casperInvoice.status !== "RepaymentPending") {
    return { outcome: "rejected", reason: "casper_status_not_repayment_pending" };
  }

  const paymentAttestationHash = hashJson({
    schema_version: "cortex-payment-attestation-v1",
    event_id: event.event_id,
    payment_id: event.payment_id,
    invoice_id: invoice.id,
    amount_usd_cents: event.amount_usd_cents,
    currency: event.currency,
    gateway_payment_hash: gatewayPaymentHash
  });
  const webhookRecord = await params.store.recordWebhook({
    id: randomUUID(),
    eventId: event.event_id,
    paymentId: event.payment_id,
    gatewayPaymentHash,
    invoiceId: invoice.id,
    rawBodyHash: sha256Hex(params.rawBody),
    signatureValid: true,
    amountUsdCents: event.amount_usd_cents,
    currency: "USD",
    status: "relay_queued"
  });
  const relayerJob: RelayerJobRecord = {
    id: randomUUID(),
    webhookEventId: event.event_id,
    invoiceId: invoice.id,
    gatewayPaymentHash,
    paymentAttestationHash,
    paidAmountUsdCents: event.amount_usd_cents,
    status: "queued",
    attempts: 0
  };
  const submittedJob = await new SettlementRelayer(params.store, params.casper).submit(relayerJob);
  return {
    outcome: "accepted",
    webhook: (await params.store.getWebhookByEventId(webhookRecord.eventId)) ?? webhookRecord,
    relayerJob: submittedJob
  };
}

export function handleCheckoutReturn(): { repaymentStatus: "pending_webhook"; message: string } {
  return {
    repaymentStatus: "pending_webhook",
    message: "Return URL is not payment proof. Waiting for verified Dodo webhook."
  };
}

function normalizeDodoPaymentEvent(payload: unknown, receivedAt: Date): JsonRecord {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const object = asRecord(data.object);
  const payment = Object.keys(object).length > 0 ? object : data;
  const eventId = readString(root.id) ?? readString(root.event_id) ?? readString(root.eventId);
  const eventType = readString(root.type) ?? readString(root.event_type) ?? readString(root.eventType);
  const paymentId = readString(payment.payment_id) ?? readString(payment.paymentId) ?? readString(payment.id);
  const status = readString(payment.status) ?? (eventType === SUCCESSFUL_DODO_EVENT_TYPE ? "succeeded" : undefined);
  const currency = (readString(payment.settlement_currency) ?? readString(payment.currency) ?? "").toUpperCase();
  const amountUsdCents =
    readMinorUnitString(payment.settlement_amount) ??
    readMinorUnitString(payment.total_amount) ??
    readMinorUnitString(payment.amount_usd_cents) ??
    readMinorUnitString(payment.amount);
  const metadata = asRecord(payment.metadata);

  return {
    event_id: eventId,
    event_type: eventType,
    payment_id: paymentId,
    status,
    amount_usd_cents: amountUsdCents,
    currency,
    metadata,
    received_at: receivedAt.toISOString()
  };
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readMinorUnitString(value: unknown): string | undefined {
  if (typeof value === "string" && /^(0|[1-9]\d*)$/.test(value) && BigInt(value) > 0n) {
    return value;
  }
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return value.toString();
  }
  return undefined;
}
