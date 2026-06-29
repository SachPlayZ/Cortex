import type { DodoCheckoutMetadata, DodoWebhookRecord, InvoiceStatus } from "@cortex/shared";
import pg from "pg";

const { Pool } = pg;

export type InvoicePaymentRecord = {
  id: string;
  invoiceHash: `0x${string}`;
  repaymentAmountUsdCents: string;
  statusCasper: InvoiceStatus;
  dodoCheckoutSessionId?: string;
  dodoCheckoutUrl?: string;
  dodoPaymentId?: string;
  dodoNonce?: string;
  lastRepaymentDeployHash?: string;
};

export type DodoCheckoutRecord = {
  sessionId: string;
  checkoutUrl: string;
  invoiceId: string;
  metadata: DodoCheckoutMetadata;
  createdAt: string;
};

export type RelayerJobStatus = "queued" | "submitted" | "confirmed" | "retryable_failed";

export type RelayerJobRecord = {
  id: string;
  webhookEventId: string;
  invoiceId: string;
  gatewayPaymentHash: `0x${string}`;
  paymentAttestationHash: `0x${string}`;
  paidAmountUsdCents: string;
  status: RelayerJobStatus;
  attempts: number;
  casperDeployHash?: string | undefined;
  lastError?: string | undefined;
};

export interface PaymentStore {
  upsertInvoice(record: InvoicePaymentRecord): Promise<InvoicePaymentRecord>;
  requireInvoice(invoiceId: string): Promise<InvoicePaymentRecord>;
  updateInvoice(invoiceId: string, patch: Partial<InvoicePaymentRecord>): Promise<InvoicePaymentRecord>;
  recordCheckout(record: DodoCheckoutRecord): Promise<DodoCheckoutRecord>;
  requireCheckout(sessionId: string): Promise<DodoCheckoutRecord>;
  getWebhookByEventId(eventId: string): Promise<DodoWebhookRecord | undefined>;
  getWebhookByPaymentId(paymentId: string): Promise<DodoWebhookRecord | undefined>;
  getWebhookByGatewayHash(gatewayPaymentHash: `0x${string}`): Promise<DodoWebhookRecord | undefined>;
  recordWebhook(record: DodoWebhookRecord): Promise<DodoWebhookRecord>;
  updateWebhook(eventId: string, patch: Partial<DodoWebhookRecord>): Promise<DodoWebhookRecord>;
  getRelayerJobByGatewayHash(gatewayPaymentHash: `0x${string}`): Promise<RelayerJobRecord | undefined>;
  listRetryableRelayerJobs(limit?: number): Promise<RelayerJobRecord[]>;
  upsertRelayerJob(record: RelayerJobRecord): Promise<RelayerJobRecord>;
  updateRelayerJob(gatewayPaymentHash: `0x${string}`, patch: Partial<RelayerJobRecord>): Promise<RelayerJobRecord>;
}

export class InMemoryPaymentStore implements PaymentStore {
  private readonly invoices = new Map<string, InvoicePaymentRecord>();
  private readonly checkouts = new Map<string, DodoCheckoutRecord>();
  private readonly webhooksByEventId = new Map<string, DodoWebhookRecord>();
  private readonly webhooksByPaymentId = new Map<string, DodoWebhookRecord>();
  private readonly webhooksByGatewayHash = new Map<string, DodoWebhookRecord>();
  private readonly jobsByGatewayHash = new Map<string, RelayerJobRecord>();

  async upsertInvoice(record: InvoicePaymentRecord): Promise<InvoicePaymentRecord> {
    this.invoices.set(record.id, { ...record });
    return this.requireInvoice(record.id);
  }

  async requireInvoice(invoiceId: string): Promise<InvoicePaymentRecord> {
    const record = this.invoices.get(invoiceId);
    if (!record) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }
    return { ...record };
  }

  async updateInvoice(invoiceId: string, patch: Partial<InvoicePaymentRecord>): Promise<InvoicePaymentRecord> {
    const current = await this.requireInvoice(invoiceId);
    const next = { ...current, ...patch, id: invoiceId };
    this.invoices.set(invoiceId, next);
    return { ...next };
  }

  async recordCheckout(record: DodoCheckoutRecord): Promise<DodoCheckoutRecord> {
    this.checkouts.set(record.sessionId, { ...record, metadata: { ...record.metadata } });
    await this.updateInvoice(record.invoiceId, {
      dodoCheckoutSessionId: record.sessionId,
      dodoCheckoutUrl: record.checkoutUrl,
      dodoNonce: record.metadata.nonce
    });
    return this.requireCheckout(record.sessionId);
  }

  async requireCheckout(sessionId: string): Promise<DodoCheckoutRecord> {
    const record = this.checkouts.get(sessionId);
    if (!record) {
      throw new Error(`Checkout not found: ${sessionId}`);
    }
    return { ...record, metadata: { ...record.metadata } };
  }

  async getWebhookByEventId(eventId: string): Promise<DodoWebhookRecord | undefined> {
    return this.cloneWebhook(this.webhooksByEventId.get(eventId));
  }

  async getWebhookByPaymentId(paymentId: string): Promise<DodoWebhookRecord | undefined> {
    return this.cloneWebhook(this.webhooksByPaymentId.get(paymentId));
  }

  async getWebhookByGatewayHash(gatewayPaymentHash: `0x${string}`): Promise<DodoWebhookRecord | undefined> {
    return this.cloneWebhook(this.webhooksByGatewayHash.get(gatewayPaymentHash));
  }

  async recordWebhook(record: DodoWebhookRecord): Promise<DodoWebhookRecord> {
    const copy = { ...record };
    this.webhooksByEventId.set(copy.eventId, copy);
    this.webhooksByPaymentId.set(copy.paymentId, copy);
    this.webhooksByGatewayHash.set(copy.gatewayPaymentHash, copy);
    return copy;
  }

  async updateWebhook(eventId: string, patch: Partial<DodoWebhookRecord>): Promise<DodoWebhookRecord> {
    const current = await this.getWebhookByEventId(eventId);
    if (!current) {
      throw new Error(`Webhook not found: ${eventId}`);
    }
    const next: DodoWebhookRecord = { ...current, ...patch, eventId };
    this.webhooksByEventId.set(next.eventId, next);
    this.webhooksByPaymentId.set(next.paymentId, next);
    this.webhooksByGatewayHash.set(next.gatewayPaymentHash, next);
    return next;
  }

  async getRelayerJobByGatewayHash(gatewayPaymentHash: `0x${string}`): Promise<RelayerJobRecord | undefined> {
    const record = this.jobsByGatewayHash.get(gatewayPaymentHash);
    return record ? { ...record } : undefined;
  }

  async listRetryableRelayerJobs(limit = 25): Promise<RelayerJobRecord[]> {
    return Array.from(this.jobsByGatewayHash.values())
      .filter((job) => job.status === "retryable_failed" || job.status === "queued")
      .slice(0, limit)
      .map((job) => ({ ...job }));
  }

  async upsertRelayerJob(record: RelayerJobRecord): Promise<RelayerJobRecord> {
    this.jobsByGatewayHash.set(record.gatewayPaymentHash, { ...record });
    return { ...record };
  }

  async updateRelayerJob(
    gatewayPaymentHash: `0x${string}`,
    patch: Partial<RelayerJobRecord>
  ): Promise<RelayerJobRecord> {
    const current = await this.getRelayerJobByGatewayHash(gatewayPaymentHash);
    if (!current) {
      throw new Error(`Relayer job not found: ${gatewayPaymentHash}`);
    }
    const next = { ...current, ...patch, gatewayPaymentHash };
    this.jobsByGatewayHash.set(gatewayPaymentHash, next);
    return { ...next };
  }

  private cloneWebhook(record: DodoWebhookRecord | undefined): DodoWebhookRecord | undefined {
    return record ? { ...record } : undefined;
  }
}

type InvoiceRow = {
  id: string;
  invoice_hash: `0x${string}`;
  repayment_amount_usd_cents: string;
  status_casper: InvoiceStatus;
  dodo_checkout_session_id: string | null;
  dodo_checkout_url: string | null;
  dodo_payment_id: string | null;
  dodo_nonce: string | null;
  last_repayment_deploy_hash: string | null;
};

type CheckoutRow = {
  session_id: string;
  checkout_url: string;
  invoice_id: string;
  metadata: DodoCheckoutMetadata;
  created_at: Date;
};

type WebhookRow = {
  id: string;
  event_id: string;
  payment_id: string;
  gateway_payment_hash: `0x${string}`;
  invoice_id: string;
  raw_body_hash: `0x${string}`;
  signature_valid: boolean;
  amount_usd_cents: string;
  currency: "USD";
  processed_at: Date | null;
  casper_deploy_hash: string | null;
  status: DodoWebhookRecord["status"];
};

type RelayerJobRow = {
  id: string;
  webhook_event_id: string;
  invoice_id: string;
  gateway_payment_hash: `0x${string}`;
  payment_attestation_hash: `0x${string}`;
  paid_amount_usd_cents: string;
  status: RelayerJobStatus;
  attempts: number;
  casper_deploy_hash: string | null;
  last_error: string | null;
};

export class PostgresPaymentStore implements PaymentStore {
  private readonly pool: pg.Pool;
  private schemaReady: Promise<void> | undefined;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined
    });
  }

  async upsertInvoice(record: InvoicePaymentRecord): Promise<InvoicePaymentRecord> {
    await this.ensureSchema();
    await this.pool.query(
      `insert into invoice_records (
        id, invoice_hash, repayment_amount_usd_cents, status_casper,
        dodo_checkout_session_id, dodo_checkout_url, dodo_payment_id, dodo_nonce,
        last_repayment_deploy_hash, updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
      on conflict (id) do update set
        invoice_hash = excluded.invoice_hash,
        repayment_amount_usd_cents = excluded.repayment_amount_usd_cents,
        status_casper = excluded.status_casper,
        dodo_checkout_session_id = coalesce(excluded.dodo_checkout_session_id, invoice_records.dodo_checkout_session_id),
        dodo_checkout_url = coalesce(excluded.dodo_checkout_url, invoice_records.dodo_checkout_url),
        dodo_payment_id = coalesce(excluded.dodo_payment_id, invoice_records.dodo_payment_id),
        dodo_nonce = coalesce(excluded.dodo_nonce, invoice_records.dodo_nonce),
        last_repayment_deploy_hash = coalesce(excluded.last_repayment_deploy_hash, invoice_records.last_repayment_deploy_hash),
        updated_at = now()`,
      [
        record.id,
        record.invoiceHash,
        record.repaymentAmountUsdCents,
        record.statusCasper,
        record.dodoCheckoutSessionId ?? null,
        record.dodoCheckoutUrl ?? null,
        record.dodoPaymentId ?? null,
        record.dodoNonce ?? null,
        record.lastRepaymentDeployHash ?? null
      ]
    );
    return this.requireInvoice(record.id);
  }

  async requireInvoice(invoiceId: string): Promise<InvoicePaymentRecord> {
    await this.ensureSchema();
    const result = await this.pool.query<InvoiceRow>("select * from invoice_records where id = $1", [invoiceId]);
    const row = result.rows[0];
    if (!row) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }
    return invoiceFromRow(row);
  }

  async updateInvoice(invoiceId: string, patch: Partial<InvoicePaymentRecord>): Promise<InvoicePaymentRecord> {
    const current = await this.requireInvoice(invoiceId);
    return this.upsertInvoice({ ...current, ...patch, id: invoiceId });
  }

  async recordCheckout(record: DodoCheckoutRecord): Promise<DodoCheckoutRecord> {
    await this.ensureSchema();
    await this.pool.query(
      `insert into dodo_checkouts (session_id, checkout_url, invoice_id, metadata, created_at)
       values ($1,$2,$3,$4,$5)
       on conflict (session_id) do update set
        checkout_url = excluded.checkout_url,
        invoice_id = excluded.invoice_id,
        metadata = excluded.metadata`,
      [record.sessionId, record.checkoutUrl, record.invoiceId, record.metadata, record.createdAt]
    );
    await this.updateInvoice(record.invoiceId, {
      dodoCheckoutSessionId: record.sessionId,
      dodoCheckoutUrl: record.checkoutUrl,
      dodoNonce: record.metadata.nonce
    });
    return this.requireCheckout(record.sessionId);
  }

  async requireCheckout(sessionId: string): Promise<DodoCheckoutRecord> {
    await this.ensureSchema();
    const result = await this.pool.query<CheckoutRow>("select * from dodo_checkouts where session_id = $1", [sessionId]);
    const row = result.rows[0];
    if (!row) {
      throw new Error(`Checkout not found: ${sessionId}`);
    }
    return checkoutFromRow(row);
  }

  async getWebhookByEventId(eventId: string): Promise<DodoWebhookRecord | undefined> {
    return this.getWebhook("event_id", eventId);
  }

  async getWebhookByPaymentId(paymentId: string): Promise<DodoWebhookRecord | undefined> {
    return this.getWebhook("payment_id", paymentId);
  }

  async getWebhookByGatewayHash(gatewayPaymentHash: `0x${string}`): Promise<DodoWebhookRecord | undefined> {
    return this.getWebhook("gateway_payment_hash", gatewayPaymentHash);
  }

  async recordWebhook(record: DodoWebhookRecord): Promise<DodoWebhookRecord> {
    await this.ensureSchema();
    await this.pool.query(
      `insert into dodo_webhook_events (
        id, event_id, payment_id, gateway_payment_hash, invoice_id, raw_body_hash,
        signature_valid, amount_usd_cents, currency, processed_at, casper_deploy_hash, status
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        record.id,
        record.eventId,
        record.paymentId,
        record.gatewayPaymentHash,
        record.invoiceId,
        record.rawBodyHash,
        record.signatureValid,
        record.amountUsdCents,
        record.currency,
        record.processedAt ?? null,
        record.casperDeployHash ?? null,
        record.status
      ]
    );
    return record;
  }

  async updateWebhook(eventId: string, patch: Partial<DodoWebhookRecord>): Promise<DodoWebhookRecord> {
    const current = await this.getWebhookByEventId(eventId);
    if (!current) {
      throw new Error(`Webhook not found: ${eventId}`);
    }
    const next: DodoWebhookRecord = { ...current, ...patch, eventId };
    await this.ensureSchema();
    await this.pool.query(
      `update dodo_webhook_events set
        payment_id = $2,
        gateway_payment_hash = $3,
        invoice_id = $4,
        raw_body_hash = $5,
        signature_valid = $6,
        amount_usd_cents = $7,
        currency = $8,
        processed_at = $9,
        casper_deploy_hash = $10,
        status = $11
       where event_id = $1`,
      [
        next.eventId,
        next.paymentId,
        next.gatewayPaymentHash,
        next.invoiceId,
        next.rawBodyHash,
        next.signatureValid,
        next.amountUsdCents,
        next.currency,
        next.processedAt ?? null,
        next.casperDeployHash ?? null,
        next.status
      ]
    );
    return next;
  }

  async getRelayerJobByGatewayHash(gatewayPaymentHash: `0x${string}`): Promise<RelayerJobRecord | undefined> {
    await this.ensureSchema();
    const result = await this.pool.query<RelayerJobRow>("select * from relayer_jobs where gateway_payment_hash = $1", [
      gatewayPaymentHash
    ]);
    const row = result.rows[0];
    return row ? relayerJobFromRow(row) : undefined;
  }

  async listRetryableRelayerJobs(limit = 25): Promise<RelayerJobRecord[]> {
    await this.ensureSchema();
    const result = await this.pool.query<RelayerJobRow>(
      `select * from relayer_jobs
       where status in ('queued', 'retryable_failed')
       order by updated_at asc
       limit $1`,
      [limit]
    );
    return result.rows.map(relayerJobFromRow);
  }

  async upsertRelayerJob(record: RelayerJobRecord): Promise<RelayerJobRecord> {
    await this.ensureSchema();
    await this.pool.query(
      `insert into relayer_jobs (
        id, webhook_event_id, invoice_id, gateway_payment_hash, payment_attestation_hash,
        paid_amount_usd_cents, status, attempts, casper_deploy_hash, last_error, updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
      on conflict (gateway_payment_hash) do update set
        webhook_event_id = excluded.webhook_event_id,
        invoice_id = excluded.invoice_id,
        payment_attestation_hash = excluded.payment_attestation_hash,
        paid_amount_usd_cents = excluded.paid_amount_usd_cents,
        status = excluded.status,
        attempts = excluded.attempts,
        casper_deploy_hash = excluded.casper_deploy_hash,
        last_error = excluded.last_error,
        updated_at = now()`,
      [
        record.id,
        record.webhookEventId,
        record.invoiceId,
        record.gatewayPaymentHash,
        record.paymentAttestationHash,
        record.paidAmountUsdCents,
        record.status,
        record.attempts,
        record.casperDeployHash ?? null,
        record.lastError ?? null
      ]
    );
    const saved = await this.getRelayerJobByGatewayHash(record.gatewayPaymentHash);
    if (!saved) {
      throw new Error(`Relayer job not found after upsert: ${record.gatewayPaymentHash}`);
    }
    return saved;
  }

  async updateRelayerJob(
    gatewayPaymentHash: `0x${string}`,
    patch: Partial<RelayerJobRecord>
  ): Promise<RelayerJobRecord> {
    const current = await this.getRelayerJobByGatewayHash(gatewayPaymentHash);
    if (!current) {
      throw new Error(`Relayer job not found: ${gatewayPaymentHash}`);
    }
    return this.upsertRelayerJob({ ...current, ...patch, gatewayPaymentHash });
  }

  private async getWebhook(column: "event_id" | "payment_id" | "gateway_payment_hash", value: string) {
    await this.ensureSchema();
    const result = await this.pool.query<WebhookRow>(`select * from dodo_webhook_events where ${column} = $1`, [value]);
    const row = result.rows[0];
    return row ? webhookFromRow(row) : undefined;
  }

  private ensureSchema(): Promise<void> {
    this.schemaReady ??= this.createSchema();
    return this.schemaReady;
  }

  private async createSchema(): Promise<void> {
    await this.pool.query(`
      create table if not exists invoice_records (
        id text primary key,
        invoice_hash text not null,
        repayment_amount_usd_cents text not null,
        status_casper text not null,
        dodo_checkout_session_id text,
        dodo_checkout_url text,
        dodo_payment_id text,
        dodo_nonce text,
        last_repayment_deploy_hash text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create table if not exists dodo_checkouts (
        session_id text primary key,
        checkout_url text not null,
        invoice_id text not null references invoice_records(id),
        metadata jsonb not null,
        created_at timestamptz not null default now()
      );

      create table if not exists dodo_webhook_events (
        id text primary key,
        event_id text not null unique,
        payment_id text not null unique,
        gateway_payment_hash text not null unique,
        invoice_id text not null references invoice_records(id),
        raw_body_hash text not null,
        signature_valid boolean not null,
        amount_usd_cents text not null,
        currency text not null check (currency = 'USD'),
        processed_at timestamptz,
        casper_deploy_hash text,
        status text not null,
        created_at timestamptz not null default now()
      );

      create table if not exists relayer_jobs (
        id text primary key,
        webhook_event_id text not null,
        invoice_id text not null references invoice_records(id),
        gateway_payment_hash text not null unique,
        payment_attestation_hash text not null,
        paid_amount_usd_cents text not null,
        status text not null,
        attempts integer not null,
        casper_deploy_hash text,
        last_error text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    `);
  }
}

function invoiceFromRow(row: InvoiceRow): InvoicePaymentRecord {
  const record: InvoicePaymentRecord = {
    id: row.id,
    invoiceHash: row.invoice_hash,
    repaymentAmountUsdCents: row.repayment_amount_usd_cents,
    statusCasper: row.status_casper
  };
  if (row.dodo_checkout_session_id) record.dodoCheckoutSessionId = row.dodo_checkout_session_id;
  if (row.dodo_checkout_url) record.dodoCheckoutUrl = row.dodo_checkout_url;
  if (row.dodo_payment_id) record.dodoPaymentId = row.dodo_payment_id;
  if (row.dodo_nonce) record.dodoNonce = row.dodo_nonce;
  if (row.last_repayment_deploy_hash) record.lastRepaymentDeployHash = row.last_repayment_deploy_hash;
  return record;
}

function checkoutFromRow(row: CheckoutRow): DodoCheckoutRecord {
  return {
    sessionId: row.session_id,
    checkoutUrl: row.checkout_url,
    invoiceId: row.invoice_id,
    metadata: row.metadata,
    createdAt: row.created_at.toISOString()
  };
}

function webhookFromRow(row: WebhookRow): DodoWebhookRecord {
  const record: DodoWebhookRecord = {
    id: row.id,
    eventId: row.event_id,
    paymentId: row.payment_id,
    gatewayPaymentHash: row.gateway_payment_hash,
    invoiceId: row.invoice_id,
    rawBodyHash: row.raw_body_hash,
    signatureValid: row.signature_valid,
    amountUsdCents: row.amount_usd_cents,
    currency: row.currency,
    status: row.status
  };
  if (row.processed_at) record.processedAt = row.processed_at.toISOString();
  if (row.casper_deploy_hash) record.casperDeployHash = row.casper_deploy_hash;
  return record;
}

function relayerJobFromRow(row: RelayerJobRow): RelayerJobRecord {
  const record: RelayerJobRecord = {
    id: row.id,
    webhookEventId: row.webhook_event_id,
    invoiceId: row.invoice_id,
    gatewayPaymentHash: row.gateway_payment_hash,
    paymentAttestationHash: row.payment_attestation_hash,
    paidAmountUsdCents: row.paid_amount_usd_cents,
    status: row.status,
    attempts: row.attempts
  };
  if (row.casper_deploy_hash) record.casperDeployHash = row.casper_deploy_hash;
  if (row.last_error) record.lastError = row.last_error;
  return record;
}
