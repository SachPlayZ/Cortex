import type { DodoCheckoutMetadata, DodoWebhookRecord, InvoiceStatus } from "@cortex/shared";
import pg from "pg";

const { Pool } = pg;

export type InvoicePaymentRecord = {
  id: string;
  invoiceHash: `0x${string}`;
  casperInvoiceIdHash?: `0x${string}` | undefined;
  title?: string | undefined;
  sellerAccount?: string | undefined;
  sellerPublicKey?: string | undefined;
  investorAccount?: string | undefined;
  investorPublicKey?: string | undefined;
  originalCurrency?: string | undefined;
  originalAmountMinor?: string | undefined;
  usdAmountCents?: string | undefined;
  advanceAmountUsdCents?: string | undefined;
  repaymentAmountUsdCents: string;
  investorYieldUsdCents?: string | undefined;
  riskTier?: string | undefined;
  riskScore?: number | undefined;
  discountBps?: number | undefined;
  dueDate?: string | undefined;
  statusCasper: InvoiceStatus;
  attestationHash?: `0x${string}` | undefined;
  agentConfidence?: number | undefined;
  casperInvoiceExists?: boolean | undefined;
  createDeployHash?: string | undefined;
  scoreDeployHash?: string | undefined;
  listDeployHash?: string | undefined;
  fundDeployHash?: string | undefined;
  cashoutDeployHash?: string | undefined;
  claimDeployHash?: string | undefined;
  dodoCheckoutSessionId?: string;
  dodoCheckoutUrl?: string;
  dodoPaymentId?: string;
  dodoNonce?: string;
  lastRepaymentDeployHash?: string;
  statusLastSyncedAt?: string | undefined;
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

export type LifecycleAction = "mint" | "list" | "fund" | "cashout" | "claim";
export type LifecycleIntentStatus = "prepared" | "confirming" | "confirmed" | "expired" | "rejected";

export type LifecycleIntentRecord = {
  id: string;
  invoiceId: string;
  action: LifecycleAction;
  publicKeyHex: string;
  accountHash?: string | undefined;
  expectedTransactionHash: string;
  expectedEntryPoint: string;
  expectedInvoiceIdHash: `0x${string}`;
  expectedPreStatus?: InvoiceStatus | undefined;
  preparedTransactionJson: unknown;
  expiresAt: string;
  status: LifecycleIntentStatus;
  confirmedDeployHash?: string | undefined;
  errorMessage?: string | undefined;
};

export type CasperLifecycleEventRecord = {
  id: string;
  eventIndex: number;
  eventName: string;
  invoiceId?: string | undefined;
  actorPublicKey?: string | undefined;
  deployHash?: string | undefined;
  payloadJson: string;
  observedAt: string;
  syncSource: "dictionary" | "confirm" | "relayer" | "bootstrap";
};

export type CasperSyncCursorRecord = {
  id: string;
  lastEventIndex: number;
  lastSyncedAt: string;
};

export type BootstrapStatusRecord = {
  id: string;
  lifecycleMode: "real" | "unavailable";
  agentRegistered: boolean;
  settlementRelayerRegistered: boolean;
  vaultLiquidityDeposited: boolean;
  registerAgentDeployHash?: string | undefined;
  registerSettlementRelayerDeployHash?: string | undefined;
  depositVaultLiquidityDeployHash?: string | undefined;
  updatedAt: string;
};

export interface PaymentStore {
  upsertInvoice(record: InvoicePaymentRecord): Promise<InvoicePaymentRecord>;
  requireInvoice(invoiceId: string): Promise<InvoicePaymentRecord>;
  listInvoices(filter?: { sellerAccount?: string; investorAccount?: string; statusCasper?: InvoiceStatus }): Promise<InvoicePaymentRecord[]>;
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
  upsertLifecycleIntent(record: LifecycleIntentRecord): Promise<LifecycleIntentRecord>;
  getLifecycleIntent(intentId: string): Promise<LifecycleIntentRecord | undefined>;
  updateLifecycleIntent(intentId: string, patch: Partial<LifecycleIntentRecord>): Promise<LifecycleIntentRecord>;
  claimLifecycleIntent(intentId: string): Promise<LifecycleIntentRecord | undefined>;
  upsertCasperLifecycleEvent(record: CasperLifecycleEventRecord): Promise<CasperLifecycleEventRecord>;
  listCasperLifecycleEventsByInvoice(invoiceId: string): Promise<CasperLifecycleEventRecord[]>;
  listCasperLifecycleEvents(limit?: number): Promise<CasperLifecycleEventRecord[]>;
  getCasperSyncCursor(cursorId: string): Promise<CasperSyncCursorRecord | undefined>;
  upsertCasperSyncCursor(record: CasperSyncCursorRecord): Promise<CasperSyncCursorRecord>;
  getBootstrapStatus(statusId: string): Promise<BootstrapStatusRecord | undefined>;
  upsertBootstrapStatus(record: BootstrapStatusRecord): Promise<BootstrapStatusRecord>;
}

export class InMemoryPaymentStore implements PaymentStore {
  private readonly invoices = new Map<string, InvoicePaymentRecord>();
  private readonly checkouts = new Map<string, DodoCheckoutRecord>();
  private readonly webhooksByEventId = new Map<string, DodoWebhookRecord>();
  private readonly webhooksByPaymentId = new Map<string, DodoWebhookRecord>();
  private readonly webhooksByGatewayHash = new Map<string, DodoWebhookRecord>();
  private readonly jobsByGatewayHash = new Map<string, RelayerJobRecord>();
  private readonly lifecycleIntents = new Map<string, LifecycleIntentRecord>();
  private readonly lifecycleEvents = new Map<number, CasperLifecycleEventRecord>();
  private readonly syncCursors = new Map<string, CasperSyncCursorRecord>();
  private readonly bootstrapStatuses = new Map<string, BootstrapStatusRecord>();

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

  async listInvoices(filter: { sellerAccount?: string; investorAccount?: string; statusCasper?: InvoiceStatus } = {}): Promise<InvoicePaymentRecord[]> {
    return Array.from(this.invoices.values())
      .filter((record) => !filter.sellerAccount || record.sellerAccount === filter.sellerAccount)
      .filter((record) => !filter.investorAccount || record.investorAccount === filter.investorAccount)
      .filter((record) => !filter.statusCasper || record.statusCasper === filter.statusCasper)
      .map((record) => ({ ...record }));
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

  async upsertLifecycleIntent(record: LifecycleIntentRecord): Promise<LifecycleIntentRecord> {
    this.lifecycleIntents.set(record.id, { ...record, preparedTransactionJson: cloneJson(record.preparedTransactionJson) });
    return (await this.getLifecycleIntent(record.id)) as LifecycleIntentRecord;
  }

  async getLifecycleIntent(intentId: string): Promise<LifecycleIntentRecord | undefined> {
    const record = this.lifecycleIntents.get(intentId);
    return record ? { ...record, preparedTransactionJson: cloneJson(record.preparedTransactionJson) } : undefined;
  }

  async updateLifecycleIntent(intentId: string, patch: Partial<LifecycleIntentRecord>): Promise<LifecycleIntentRecord> {
    const current = await this.getLifecycleIntent(intentId);
    if (!current) {
      throw new Error(`Lifecycle intent not found: ${intentId}`);
    }
    const next = { ...current, ...patch, id: intentId };
    this.lifecycleIntents.set(intentId, { ...next, preparedTransactionJson: cloneJson(next.preparedTransactionJson) });
    return next;
  }

  async claimLifecycleIntent(intentId: string): Promise<LifecycleIntentRecord | undefined> {
    const current = this.lifecycleIntents.get(intentId);
    if (!current || current.status !== "prepared") return undefined;
    current.status = "confirming";
    return this.getLifecycleIntent(intentId);
  }

  async upsertCasperLifecycleEvent(record: CasperLifecycleEventRecord): Promise<CasperLifecycleEventRecord> {
    this.lifecycleEvents.set(record.eventIndex, { ...record });
    return { ...record };
  }

  async listCasperLifecycleEventsByInvoice(invoiceId: string): Promise<CasperLifecycleEventRecord[]> {
    return Array.from(this.lifecycleEvents.values())
      .filter((record) => record.invoiceId === invoiceId)
      .sort((a, b) => a.eventIndex - b.eventIndex)
      .map((record) => ({ ...record }));
  }

  async listCasperLifecycleEvents(limit?: number): Promise<CasperLifecycleEventRecord[]> {
    const rows = Array.from(this.lifecycleEvents.values()).sort((a, b) => a.eventIndex - b.eventIndex);
    return (typeof limit === "number" ? rows.slice(-limit) : rows).map((record) => ({ ...record }));
  }

  async getCasperSyncCursor(cursorId: string): Promise<CasperSyncCursorRecord | undefined> {
    const record = this.syncCursors.get(cursorId);
    return record ? { ...record } : undefined;
  }

  async upsertCasperSyncCursor(record: CasperSyncCursorRecord): Promise<CasperSyncCursorRecord> {
    this.syncCursors.set(record.id, { ...record });
    return { ...record };
  }

  async getBootstrapStatus(statusId: string): Promise<BootstrapStatusRecord | undefined> {
    const record = this.bootstrapStatuses.get(statusId);
    return record ? { ...record } : undefined;
  }

  async upsertBootstrapStatus(record: BootstrapStatusRecord): Promise<BootstrapStatusRecord> {
    this.bootstrapStatuses.set(record.id, { ...record });
    return { ...record };
  }

  private cloneWebhook(record: DodoWebhookRecord | undefined): DodoWebhookRecord | undefined {
    return record ? { ...record } : undefined;
  }
}

type InvoiceRow = {
  id: string;
  invoice_hash: `0x${string}`;
  casper_invoice_id_hash: `0x${string}` | null;
  title: string | null;
  seller_account: string | null;
  seller_public_key: string | null;
  investor_account: string | null;
  investor_public_key: string | null;
  original_currency: string | null;
  original_amount_minor: string | null;
  usd_amount_cents: string | null;
  advance_amount_usd_cents: string | null;
  repayment_amount_usd_cents: string;
  investor_yield_usd_cents: string | null;
  risk_tier: string | null;
  risk_score: number | null;
  discount_bps: number | null;
  due_date: string | null;
  status_casper: InvoiceStatus;
  attestation_hash: `0x${string}` | null;
  agent_confidence: number | null;
  casper_invoice_exists: boolean | null;
  create_deploy_hash: string | null;
  score_deploy_hash: string | null;
  list_deploy_hash: string | null;
  fund_deploy_hash: string | null;
  cashout_deploy_hash: string | null;
  claim_deploy_hash: string | null;
  dodo_checkout_session_id: string | null;
  dodo_checkout_url: string | null;
  dodo_payment_id: string | null;
  dodo_nonce: string | null;
  last_repayment_deploy_hash: string | null;
  status_last_synced_at: Date | null;
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

type LifecycleIntentRow = {
  id: string;
  invoice_id: string;
  action: LifecycleAction;
  public_key_hex: string;
  account_hash: string | null;
  expected_transaction_hash: string;
  expected_entry_point: string;
  expected_invoice_id_hash: `0x${string}`;
  expected_pre_status: InvoiceStatus | null;
  prepared_transaction_json: unknown;
  expires_at: Date;
  status: LifecycleIntentStatus;
  confirmed_deploy_hash: string | null;
  error_message: string | null;
};

type LifecycleEventRow = {
  id: string;
  event_index: number;
  event_name: string;
  invoice_id: string | null;
  actor_public_key: string | null;
  deploy_hash: string | null;
  payload_json: string;
  observed_at: Date;
  sync_source: CasperLifecycleEventRecord["syncSource"];
};

type SyncCursorRow = {
  id: string;
  last_event_index: number;
  last_synced_at: Date;
};

type BootstrapStatusRow = {
  id: string;
  lifecycle_mode: BootstrapStatusRecord["lifecycleMode"];
  agent_registered: boolean;
  settlement_relayer_registered: boolean;
  vault_liquidity_deposited: boolean;
  register_agent_deploy_hash: string | null;
  register_settlement_relayer_deploy_hash: string | null;
  deposit_vault_liquidity_deploy_hash: string | null;
  updated_at: Date;
};

export class PostgresPaymentStore implements PaymentStore {
  private readonly pool: pg.Pool;
  private schemaReady: Promise<void> | undefined;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: resolvePostgresSsl(connectionString)
    });
  }

  async upsertInvoice(record: InvoicePaymentRecord): Promise<InvoicePaymentRecord> {
    await this.ensureSchema();
    await this.pool.query(
      `insert into invoice_records (
        id, invoice_hash, casper_invoice_id_hash, title, seller_account, seller_public_key, investor_account, investor_public_key,
        original_currency, original_amount_minor, usd_amount_cents,
        advance_amount_usd_cents, repayment_amount_usd_cents, investor_yield_usd_cents,
        risk_tier, risk_score, discount_bps, due_date, status_casper,
        attestation_hash, agent_confidence, casper_invoice_exists,
        create_deploy_hash, score_deploy_hash, list_deploy_hash, fund_deploy_hash,
        cashout_deploy_hash, claim_deploy_hash,
        dodo_checkout_session_id, dodo_checkout_url, dodo_payment_id, dodo_nonce,
        last_repayment_deploy_hash, status_last_synced_at, updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34, now())
      on conflict (id) do update set
        invoice_hash = excluded.invoice_hash,
        casper_invoice_id_hash = coalesce(excluded.casper_invoice_id_hash, invoice_records.casper_invoice_id_hash),
        title = coalesce(excluded.title, invoice_records.title),
        seller_account = coalesce(excluded.seller_account, invoice_records.seller_account),
        seller_public_key = coalesce(excluded.seller_public_key, invoice_records.seller_public_key),
        investor_account = coalesce(excluded.investor_account, invoice_records.investor_account),
        investor_public_key = coalesce(excluded.investor_public_key, invoice_records.investor_public_key),
        original_currency = coalesce(excluded.original_currency, invoice_records.original_currency),
        original_amount_minor = coalesce(excluded.original_amount_minor, invoice_records.original_amount_minor),
        usd_amount_cents = coalesce(excluded.usd_amount_cents, invoice_records.usd_amount_cents),
        advance_amount_usd_cents = coalesce(excluded.advance_amount_usd_cents, invoice_records.advance_amount_usd_cents),
        repayment_amount_usd_cents = excluded.repayment_amount_usd_cents,
        investor_yield_usd_cents = coalesce(excluded.investor_yield_usd_cents, invoice_records.investor_yield_usd_cents),
        risk_tier = coalesce(excluded.risk_tier, invoice_records.risk_tier),
        risk_score = coalesce(excluded.risk_score, invoice_records.risk_score),
        discount_bps = coalesce(excluded.discount_bps, invoice_records.discount_bps),
        due_date = coalesce(excluded.due_date, invoice_records.due_date),
        status_casper = excluded.status_casper,
        attestation_hash = coalesce(excluded.attestation_hash, invoice_records.attestation_hash),
        agent_confidence = coalesce(excluded.agent_confidence, invoice_records.agent_confidence),
        casper_invoice_exists = coalesce(excluded.casper_invoice_exists, invoice_records.casper_invoice_exists),
        create_deploy_hash = coalesce(excluded.create_deploy_hash, invoice_records.create_deploy_hash),
        score_deploy_hash = coalesce(excluded.score_deploy_hash, invoice_records.score_deploy_hash),
        list_deploy_hash = coalesce(excluded.list_deploy_hash, invoice_records.list_deploy_hash),
        fund_deploy_hash = coalesce(excluded.fund_deploy_hash, invoice_records.fund_deploy_hash),
        cashout_deploy_hash = coalesce(excluded.cashout_deploy_hash, invoice_records.cashout_deploy_hash),
        claim_deploy_hash = coalesce(excluded.claim_deploy_hash, invoice_records.claim_deploy_hash),
        dodo_checkout_session_id = coalesce(excluded.dodo_checkout_session_id, invoice_records.dodo_checkout_session_id),
        dodo_checkout_url = coalesce(excluded.dodo_checkout_url, invoice_records.dodo_checkout_url),
        dodo_payment_id = coalesce(excluded.dodo_payment_id, invoice_records.dodo_payment_id),
        dodo_nonce = coalesce(excluded.dodo_nonce, invoice_records.dodo_nonce),
        last_repayment_deploy_hash = coalesce(excluded.last_repayment_deploy_hash, invoice_records.last_repayment_deploy_hash),
        status_last_synced_at = coalesce(excluded.status_last_synced_at, invoice_records.status_last_synced_at),
        updated_at = now()`,
      [
        record.id,
        record.invoiceHash,
        record.casperInvoiceIdHash ?? null,
        record.title ?? null,
        record.sellerAccount ?? null,
        record.sellerPublicKey ?? null,
        record.investorAccount ?? null,
        record.investorPublicKey ?? null,
        record.originalCurrency ?? null,
        record.originalAmountMinor ?? null,
        record.usdAmountCents ?? null,
        record.advanceAmountUsdCents ?? null,
        record.repaymentAmountUsdCents,
        record.investorYieldUsdCents ?? null,
        record.riskTier ?? null,
        record.riskScore ?? null,
        record.discountBps ?? null,
        record.dueDate ?? null,
        record.statusCasper,
        record.attestationHash ?? null,
        record.agentConfidence ?? null,
        record.casperInvoiceExists ?? null,
        record.createDeployHash ?? null,
        record.scoreDeployHash ?? null,
        record.listDeployHash ?? null,
        record.fundDeployHash ?? null,
        record.cashoutDeployHash ?? null,
        record.claimDeployHash ?? null,
        record.dodoCheckoutSessionId ?? null,
        record.dodoCheckoutUrl ?? null,
        record.dodoPaymentId ?? null,
        record.dodoNonce ?? null,
        record.lastRepaymentDeployHash ?? null,
        record.statusLastSyncedAt ?? null
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

  async listInvoices(filter: { sellerAccount?: string; investorAccount?: string; statusCasper?: InvoiceStatus } = {}): Promise<InvoicePaymentRecord[]> {
    await this.ensureSchema();
    const clauses: string[] = [];
    const values: string[] = [];
    if (filter.sellerAccount) {
      values.push(filter.sellerAccount);
      clauses.push(`seller_account = $${values.length}`);
    }
    if (filter.investorAccount) {
      values.push(filter.investorAccount);
      clauses.push(`investor_account = $${values.length}`);
    }
    if (filter.statusCasper) {
      values.push(filter.statusCasper);
      clauses.push(`status_casper = $${values.length}`);
    }
    const where = clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
    const result = await this.pool.query<InvoiceRow>(
      `select * from invoice_records ${where} order by created_at desc`,
      values
    );
    return result.rows.map(invoiceFromRow);
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
        casper_invoice_id_hash text,
        title text,
        seller_account text,
        seller_public_key text,
        investor_account text,
        investor_public_key text,
        original_currency text,
        original_amount_minor text,
        usd_amount_cents text,
        advance_amount_usd_cents text,
        repayment_amount_usd_cents text not null,
        investor_yield_usd_cents text,
        risk_tier text,
        risk_score integer,
        discount_bps integer,
        due_date text,
        status_casper text not null,
        attestation_hash text,
        agent_confidence double precision,
        casper_invoice_exists boolean,
        create_deploy_hash text,
        score_deploy_hash text,
        list_deploy_hash text,
        fund_deploy_hash text,
        cashout_deploy_hash text,
        claim_deploy_hash text,
        dodo_checkout_session_id text,
        dodo_checkout_url text,
        dodo_payment_id text,
        dodo_nonce text,
        last_repayment_deploy_hash text,
        status_last_synced_at timestamptz,
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
    await this.pool.query(`
      alter table invoice_records add column if not exists title text;
      alter table invoice_records add column if not exists casper_invoice_id_hash text;
      alter table invoice_records add column if not exists seller_account text;
      alter table invoice_records add column if not exists seller_public_key text;
      alter table invoice_records add column if not exists investor_account text;
      alter table invoice_records add column if not exists investor_public_key text;
      alter table invoice_records add column if not exists original_currency text;
      alter table invoice_records add column if not exists original_amount_minor text;
      alter table invoice_records add column if not exists usd_amount_cents text;
      alter table invoice_records add column if not exists advance_amount_usd_cents text;
      alter table invoice_records add column if not exists investor_yield_usd_cents text;
      alter table invoice_records add column if not exists risk_tier text;
      alter table invoice_records add column if not exists risk_score integer;
      alter table invoice_records add column if not exists discount_bps integer;
      alter table invoice_records add column if not exists due_date text;
      alter table invoice_records add column if not exists attestation_hash text;
      alter table invoice_records add column if not exists agent_confidence double precision;
      alter table invoice_records add column if not exists casper_invoice_exists boolean;
      alter table invoice_records add column if not exists create_deploy_hash text;
      alter table invoice_records add column if not exists score_deploy_hash text;
      alter table invoice_records add column if not exists list_deploy_hash text;
      alter table invoice_records add column if not exists fund_deploy_hash text;
      alter table invoice_records add column if not exists cashout_deploy_hash text;
      alter table invoice_records add column if not exists claim_deploy_hash text;
      alter table invoice_records add column if not exists status_last_synced_at timestamptz;
    `);
    await this.pool.query(`
      create table if not exists casper_lifecycle_intents (
        id text primary key,
        invoice_id text not null references invoice_records(id),
        action text not null,
        public_key_hex text not null,
        account_hash text,
        expected_transaction_hash text not null,
        expected_entry_point text not null,
        expected_invoice_id_hash text not null,
        expected_pre_status text,
        prepared_transaction_json jsonb not null,
        expires_at timestamptz not null,
        status text not null,
        confirmed_deploy_hash text,
        error_message text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

      create table if not exists casper_lifecycle_events (
        id text primary key,
        event_index integer not null unique,
        event_name text not null,
        invoice_id text,
        actor_public_key text,
        deploy_hash text,
        payload_json text not null,
        observed_at timestamptz not null,
        sync_source text not null
      );

      create table if not exists casper_sync_cursors (
        id text primary key,
        last_event_index integer not null,
        last_synced_at timestamptz not null
      );

      create table if not exists bootstrap_status (
        id text primary key,
        lifecycle_mode text not null,
        agent_registered boolean not null,
        settlement_relayer_registered boolean not null,
        vault_liquidity_deposited boolean not null,
        register_agent_deploy_hash text,
        register_settlement_relayer_deploy_hash text,
        deposit_vault_liquidity_deploy_hash text,
        updated_at timestamptz not null
      );
    `);
  }

  async upsertLifecycleIntent(record: LifecycleIntentRecord): Promise<LifecycleIntentRecord> {
    await this.ensureSchema();
    await this.pool.query(
      `insert into casper_lifecycle_intents (
        id, invoice_id, action, public_key_hex, account_hash, expected_transaction_hash,
        expected_entry_point, expected_invoice_id_hash, expected_pre_status,
        prepared_transaction_json, expires_at, status, confirmed_deploy_hash, error_message, updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, now())
      on conflict (id) do update set
        invoice_id = excluded.invoice_id,
        action = excluded.action,
        public_key_hex = excluded.public_key_hex,
        account_hash = excluded.account_hash,
        expected_transaction_hash = excluded.expected_transaction_hash,
        expected_entry_point = excluded.expected_entry_point,
        expected_invoice_id_hash = excluded.expected_invoice_id_hash,
        expected_pre_status = excluded.expected_pre_status,
        prepared_transaction_json = excluded.prepared_transaction_json,
        expires_at = excluded.expires_at,
        status = excluded.status,
        confirmed_deploy_hash = excluded.confirmed_deploy_hash,
        error_message = excluded.error_message,
        updated_at = now()`,
      [
        record.id,
        record.invoiceId,
        record.action,
        record.publicKeyHex,
        record.accountHash ?? null,
        record.expectedTransactionHash,
        record.expectedEntryPoint,
        record.expectedInvoiceIdHash,
        record.expectedPreStatus ?? null,
        record.preparedTransactionJson,
        record.expiresAt,
        record.status,
        record.confirmedDeployHash ?? null,
        record.errorMessage ?? null
      ]
    );
    return (await this.getLifecycleIntent(record.id)) as LifecycleIntentRecord;
  }

  async getLifecycleIntent(intentId: string): Promise<LifecycleIntentRecord | undefined> {
    await this.ensureSchema();
    const result = await this.pool.query<LifecycleIntentRow>("select * from casper_lifecycle_intents where id = $1", [intentId]);
    const row = result.rows[0];
    return row ? lifecycleIntentFromRow(row) : undefined;
  }

  async updateLifecycleIntent(intentId: string, patch: Partial<LifecycleIntentRecord>): Promise<LifecycleIntentRecord> {
    const current = await this.getLifecycleIntent(intentId);
    if (!current) throw new Error(`Lifecycle intent not found: ${intentId}`);
    return this.upsertLifecycleIntent({ ...current, ...patch, id: intentId });
  }

  async claimLifecycleIntent(intentId: string): Promise<LifecycleIntentRecord | undefined> {
    await this.ensureSchema();
    const result = await this.pool.query<LifecycleIntentRow>(
      "update casper_lifecycle_intents set status = 'confirming', updated_at = now() where id = $1 and status = 'prepared' returning *",
      [intentId]
    );
    const row = result.rows[0];
    return row ? lifecycleIntentFromRow(row) : undefined;
  }

  async upsertCasperLifecycleEvent(record: CasperLifecycleEventRecord): Promise<CasperLifecycleEventRecord> {
    await this.ensureSchema();
    await this.pool.query(
      `insert into casper_lifecycle_events (
        id, event_index, event_name, invoice_id, actor_public_key, deploy_hash, payload_json, observed_at, sync_source
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      on conflict (event_index) do update set
        id = excluded.id,
        event_name = excluded.event_name,
        invoice_id = excluded.invoice_id,
        actor_public_key = excluded.actor_public_key,
        deploy_hash = coalesce(excluded.deploy_hash, casper_lifecycle_events.deploy_hash),
        payload_json = excluded.payload_json,
        observed_at = excluded.observed_at,
        sync_source = excluded.sync_source`,
      [
        record.id,
        record.eventIndex,
        record.eventName,
        record.invoiceId ?? null,
        record.actorPublicKey ?? null,
        record.deployHash ?? null,
        record.payloadJson,
        record.observedAt,
        record.syncSource
      ]
    );
    return { ...record };
  }

  async listCasperLifecycleEventsByInvoice(invoiceId: string): Promise<CasperLifecycleEventRecord[]> {
    await this.ensureSchema();
    const result = await this.pool.query<LifecycleEventRow>(
      "select * from casper_lifecycle_events where invoice_id = $1 order by event_index asc",
      [invoiceId]
    );
    return result.rows.map(lifecycleEventFromRow);
  }

  async listCasperLifecycleEvents(limit?: number): Promise<CasperLifecycleEventRecord[]> {
    await this.ensureSchema();
    const sql =
      typeof limit === "number"
        ? "select * from casper_lifecycle_events order by event_index asc limit $1"
        : "select * from casper_lifecycle_events order by event_index asc";
    const result = await this.pool.query<LifecycleEventRow>(sql, typeof limit === "number" ? [limit] : []);
    return result.rows.map(lifecycleEventFromRow);
  }

  async getCasperSyncCursor(cursorId: string): Promise<CasperSyncCursorRecord | undefined> {
    await this.ensureSchema();
    const result = await this.pool.query<SyncCursorRow>("select * from casper_sync_cursors where id = $1", [cursorId]);
    const row = result.rows[0];
    return row ? syncCursorFromRow(row) : undefined;
  }

  async upsertCasperSyncCursor(record: CasperSyncCursorRecord): Promise<CasperSyncCursorRecord> {
    await this.ensureSchema();
    await this.pool.query(
      `insert into casper_sync_cursors (id, last_event_index, last_synced_at)
       values ($1,$2,$3)
       on conflict (id) do update set
        last_event_index = excluded.last_event_index,
        last_synced_at = excluded.last_synced_at`,
      [record.id, record.lastEventIndex, record.lastSyncedAt]
    );
    return (await this.getCasperSyncCursor(record.id)) as CasperSyncCursorRecord;
  }

  async getBootstrapStatus(statusId: string): Promise<BootstrapStatusRecord | undefined> {
    await this.ensureSchema();
    const result = await this.pool.query<BootstrapStatusRow>("select * from bootstrap_status where id = $1", [statusId]);
    const row = result.rows[0];
    return row ? bootstrapStatusFromRow(row) : undefined;
  }

  async upsertBootstrapStatus(record: BootstrapStatusRecord): Promise<BootstrapStatusRecord> {
    await this.ensureSchema();
    await this.pool.query(
      `insert into bootstrap_status (
        id, lifecycle_mode, agent_registered, settlement_relayer_registered, vault_liquidity_deposited,
        register_agent_deploy_hash, register_settlement_relayer_deploy_hash, deposit_vault_liquidity_deploy_hash, updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      on conflict (id) do update set
        lifecycle_mode = excluded.lifecycle_mode,
        agent_registered = excluded.agent_registered,
        settlement_relayer_registered = excluded.settlement_relayer_registered,
        vault_liquidity_deposited = excluded.vault_liquidity_deposited,
        register_agent_deploy_hash = coalesce(excluded.register_agent_deploy_hash, bootstrap_status.register_agent_deploy_hash),
        register_settlement_relayer_deploy_hash = coalesce(excluded.register_settlement_relayer_deploy_hash, bootstrap_status.register_settlement_relayer_deploy_hash),
        deposit_vault_liquidity_deploy_hash = coalesce(excluded.deposit_vault_liquidity_deploy_hash, bootstrap_status.deposit_vault_liquidity_deploy_hash),
        updated_at = excluded.updated_at`,
      [
        record.id,
        record.lifecycleMode,
        record.agentRegistered,
        record.settlementRelayerRegistered,
        record.vaultLiquidityDeposited,
        record.registerAgentDeployHash ?? null,
        record.registerSettlementRelayerDeployHash ?? null,
        record.depositVaultLiquidityDeployHash ?? null,
        record.updatedAt
      ]
    );
    return (await this.getBootstrapStatus(record.id)) as BootstrapStatusRecord;
  }
}

function resolvePostgresSsl(connectionString: string): pg.PoolConfig["ssl"] | undefined {
  let sslMode: string | null = null;
  try {
    sslMode = new URL(connectionString).searchParams.get("sslmode");
  } catch {
    sslMode = connectionString.includes("sslmode=require") ? "require" : null;
  }
  if (!sslMode || sslMode === "disable") return undefined;
  return {
    rejectUnauthorized: parseBooleanEnv(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED, true)
  };
}

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function invoiceFromRow(row: InvoiceRow): InvoicePaymentRecord {
  const record: InvoicePaymentRecord = {
    id: row.id,
    invoiceHash: row.invoice_hash,
    repaymentAmountUsdCents: row.repayment_amount_usd_cents,
    statusCasper: row.status_casper
  };
  if (row.casper_invoice_id_hash) record.casperInvoiceIdHash = row.casper_invoice_id_hash;
  if (row.title) record.title = row.title;
  if (row.seller_account) record.sellerAccount = row.seller_account;
  if (row.seller_public_key) record.sellerPublicKey = row.seller_public_key;
  if (row.investor_account) record.investorAccount = row.investor_account;
  if (row.investor_public_key) record.investorPublicKey = row.investor_public_key;
  if (row.original_currency) record.originalCurrency = row.original_currency;
  if (row.original_amount_minor) record.originalAmountMinor = row.original_amount_minor;
  if (row.usd_amount_cents) record.usdAmountCents = row.usd_amount_cents;
  if (row.advance_amount_usd_cents) record.advanceAmountUsdCents = row.advance_amount_usd_cents;
  if (row.investor_yield_usd_cents) record.investorYieldUsdCents = row.investor_yield_usd_cents;
  if (row.risk_tier) record.riskTier = row.risk_tier;
  if (row.risk_score !== null) record.riskScore = row.risk_score;
  if (row.discount_bps !== null) record.discountBps = row.discount_bps;
  if (row.due_date) record.dueDate = row.due_date;
  if (row.attestation_hash) record.attestationHash = row.attestation_hash;
  if (row.agent_confidence !== null) record.agentConfidence = row.agent_confidence;
  if (row.casper_invoice_exists !== null) record.casperInvoiceExists = row.casper_invoice_exists;
  if (row.create_deploy_hash) record.createDeployHash = row.create_deploy_hash;
  if (row.score_deploy_hash) record.scoreDeployHash = row.score_deploy_hash;
  if (row.list_deploy_hash) record.listDeployHash = row.list_deploy_hash;
  if (row.fund_deploy_hash) record.fundDeployHash = row.fund_deploy_hash;
  if (row.cashout_deploy_hash) record.cashoutDeployHash = row.cashout_deploy_hash;
  if (row.claim_deploy_hash) record.claimDeployHash = row.claim_deploy_hash;
  if (row.dodo_checkout_session_id) record.dodoCheckoutSessionId = row.dodo_checkout_session_id;
  if (row.dodo_checkout_url) record.dodoCheckoutUrl = row.dodo_checkout_url;
  if (row.dodo_payment_id) record.dodoPaymentId = row.dodo_payment_id;
  if (row.dodo_nonce) record.dodoNonce = row.dodo_nonce;
  if (row.last_repayment_deploy_hash) record.lastRepaymentDeployHash = row.last_repayment_deploy_hash;
  if (row.status_last_synced_at) record.statusLastSyncedAt = row.status_last_synced_at.toISOString();
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

function lifecycleIntentFromRow(row: LifecycleIntentRow): LifecycleIntentRecord {
  const record: LifecycleIntentRecord = {
    id: row.id,
    invoiceId: row.invoice_id,
    action: row.action,
    publicKeyHex: row.public_key_hex,
    expectedTransactionHash: row.expected_transaction_hash,
    expectedEntryPoint: row.expected_entry_point,
    expectedInvoiceIdHash: row.expected_invoice_id_hash,
    preparedTransactionJson: row.prepared_transaction_json,
    expiresAt: row.expires_at.toISOString(),
    status: row.status
  };
  if (row.account_hash) record.accountHash = row.account_hash;
  if (row.expected_pre_status) record.expectedPreStatus = row.expected_pre_status;
  if (row.confirmed_deploy_hash) record.confirmedDeployHash = row.confirmed_deploy_hash;
  if (row.error_message) record.errorMessage = row.error_message;
  return record;
}

function lifecycleEventFromRow(row: LifecycleEventRow): CasperLifecycleEventRecord {
  const record: CasperLifecycleEventRecord = {
    id: row.id,
    eventIndex: row.event_index,
    eventName: row.event_name,
    payloadJson: row.payload_json,
    observedAt: row.observed_at.toISOString(),
    syncSource: row.sync_source
  };
  if (row.invoice_id) record.invoiceId = row.invoice_id;
  if (row.actor_public_key) record.actorPublicKey = row.actor_public_key;
  if (row.deploy_hash) record.deployHash = row.deploy_hash;
  return record;
}

function syncCursorFromRow(row: SyncCursorRow): CasperSyncCursorRecord {
  return {
    id: row.id,
    lastEventIndex: row.last_event_index,
    lastSyncedAt: row.last_synced_at.toISOString()
  };
}

function bootstrapStatusFromRow(row: BootstrapStatusRow): BootstrapStatusRecord {
  const record: BootstrapStatusRecord = {
    id: row.id,
    lifecycleMode: row.lifecycle_mode,
    agentRegistered: row.agent_registered,
    settlementRelayerRegistered: row.settlement_relayer_registered,
    vaultLiquidityDeposited: row.vault_liquidity_deposited,
    updatedAt: row.updated_at.toISOString()
  };
  if (row.register_agent_deploy_hash) record.registerAgentDeployHash = row.register_agent_deploy_hash;
  if (row.register_settlement_relayer_deploy_hash) {
    record.registerSettlementRelayerDeployHash = row.register_settlement_relayer_deploy_hash;
  }
  if (row.deposit_vault_liquidity_deploy_hash) {
    record.depositVaultLiquidityDeployHash = row.deposit_vault_liquidity_deploy_hash;
  }
  return record;
}

function cloneJson<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}
