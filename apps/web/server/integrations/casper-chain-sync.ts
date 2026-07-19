import { createRequire } from "node:module";
import { sha256Hex, type InvoiceStatus } from "@cortex/shared";
import { getPaymentRuntime, hasCasperLifecycleConfig } from "../payment-runtime";
import type {
  BootstrapStatusRecord,
  CasperLifecycleEventRecord,
  CasperSyncCursorRecord,
  InvoicePaymentRecord
} from "./payment-store";

type CasperSdk = typeof import("casper-js-sdk");
const require = createRequire(import.meta.url);
const casperSdk = require("casper-js-sdk") as CasperSdk;

const EVENT_CURSOR_ID = "casper_events";
const BOOTSTRAP_STATUS_ID = "invoice_registry_bootstrap";
const CONTRACT_SOURCES = [
  {
    cursorId: "invoice_registry_events_v5",
    eventIdPrefix: "invoice_registry_events",
    packageHashEnv: "INVOICE_REGISTRY_PACKAGE_HASH",
    contractName: "InvoiceRegistry",
    eventOffset: 0
  },
  {
    cursorId: "funding_vault_events_v5",
    eventIdPrefix: "funding_vault_events",
    packageHashEnv: "FUNDING_VAULT_PACKAGE_HASH",
    contractName: "FundingVault",
    eventOffset: 1_000_000_000
  },
  {
    cursorId: "repayment_escrow_events_v5",
    eventIdPrefix: "repayment_escrow_events",
    packageHashEnv: "REPAYMENT_ESCROW_PACKAGE_HASH",
    contractName: "RepaymentEscrow",
    eventOffset: 2_000_000_000
  }
] as const;

type ParsedLifecycleEvent = {
  eventIndex: number;
  eventName: string;
  invoiceIdHash?: `0x${string}`;
  actorPublicKey?: string | undefined;
  payloadJson: string;
};

export class CasperChainSyncService {
  private readonly rpcClient: InstanceType<CasperSdk["RpcClient"]>;
  private readonly contractHashPromises = new Map<string, Promise<string>>();
  private readonly eventsURefPromises = new Map<string, Promise<string>>();

  constructor() {
    if (!hasCasperLifecycleConfig()) {
      throw new Error("Casper lifecycle environment not configured");
    }
    this.rpcClient = new casperSdk.RpcClient(
      new casperSdk.HttpHandler(process.env.CASPER_NODE_RPC_URL ?? "", "fetch")
    );
  }

  async syncLatestEvents(): Promise<CasperSyncCursorRecord> {
    const { paymentStore } = await getPaymentRuntime();
    const invoices = await paymentStore.listInvoices();
    const invoiceByHash = new Map(invoices.map((invoice) => [contractInvoiceIdHash(invoice.id), invoice]));
    const stateRootHash = (await this.rpcClient.getStateRootHashLatest()).stateRootHash.toHex();
    let totalLastEventIndex = -1;

    for (const source of CONTRACT_SOURCES) {
      const packageHash = process.env[source.packageHashEnv];
      if (!packageHash) continue;
      const contractHash = await this.getContractHash(packageHash, source.contractName);
      const eventsLength = await this.getEventsLength(contractHash);
      const cursor =
        (await paymentStore.getCasperSyncCursor(source.cursorId)) ??
        ({ id: source.cursorId, lastEventIndex: -1, lastSyncedAt: new Date(0).toISOString() } satisfies CasperSyncCursorRecord);
      let processedLastEventIndex = cursor.lastEventIndex;

      if (eventsLength > 0 && cursor.lastEventIndex < eventsLength - 1) {
        const eventsURef = await this.getEventsURef(contractHash, source.contractName);
        for (let index = cursor.lastEventIndex + 1; index < eventsLength; index += 1) {
          const dictionaryItem = await this.rpcClient.getDictionaryItem(stateRootHash, eventsURef, String(index));
          const bytesHex =
            ((dictionaryItem.rawJSON as { stored_value?: { CLValue?: { bytes?: string } } })?.stored_value?.CLValue?.bytes ?? "");
          if (!bytesHex) break;
          const parsed = parseLifecycleEvent(bytesHex, source.eventOffset + index);
          const matchedInvoice = parsed.invoiceIdHash ? invoiceByHash.get(parsed.invoiceIdHash) : undefined;
          await paymentStore.upsertCasperLifecycleEvent({
            id: `${source.eventIdPrefix}:${index}`,
            eventIndex: source.eventOffset + index,
            eventName: parsed.eventName,
            invoiceId: matchedInvoice?.id,
            actorPublicKey: parsed.actorPublicKey,
            payloadJson: parsed.payloadJson,
            observedAt: new Date().toISOString(),
            syncSource: "dictionary"
          });
          processedLastEventIndex = index;
        }
      }

      await paymentStore.upsertCasperSyncCursor({
        id: source.cursorId,
        lastEventIndex: processedLastEventIndex,
        lastSyncedAt: new Date().toISOString()
      });
      totalLastEventIndex = Math.max(totalLastEventIndex, source.eventOffset + processedLastEventIndex);
    }

    return paymentStore.upsertCasperSyncCursor({
      id: EVENT_CURSOR_ID,
      lastEventIndex: totalLastEventIndex,
      lastSyncedAt: new Date().toISOString()
    });
  }

  async deriveInvoiceState(invoiceId: string): Promise<InvoicePaymentRecord> {
    const { paymentStore } = await getPaymentRuntime();
    await this.syncLatestEvents();
    const invoice = await paymentStore.requireInvoice(invoiceId);
    const events = (await paymentStore.listCasperLifecycleEventsByInvoice(invoiceId))
      .filter((event) => isCanonicalRegistryEvent(event.eventIndex));
    const next: Partial<InvoicePaymentRecord> = {
      casperInvoiceIdHash: contractInvoiceIdHash(invoice.id),
      casperInvoiceExists: false
    };

    for (const event of events) {
      const payload = parsePayload(event.payloadJson);
      switch (event.eventName) {
        case "InvoiceCreated":
          next.casperInvoiceExists = true;
          next.statusCasper = "Created";
          break;
        case "InvoiceScored":
          next.statusCasper = "Scored";
          break;
        case "InvoiceListed":
          next.statusCasper = "Listed";
          break;
        case "InvoiceFunded":
          next.statusCasper = "RepaymentPending";
          if (event.actorPublicKey) {
            if (event.actorPublicKey.startsWith("account-hash-")) {
              next.investorAccount = event.actorPublicKey;
            } else {
              next.investorPublicKey = event.actorPublicKey;
              next.investorAccount = toAccountHash(event.actorPublicKey);
            }
          }
          break;
        case "SellerAdvanceCashedOut":
          next.statusCasper = "RepaymentPending";
          break;
        case "GatewayRepaymentRecorded":
          next.statusCasper = "Repaid";
          break;
        case "InvestorClaimed":
        case "InvoiceSettled":
          next.statusCasper = "Settled";
          break;
        case "InvoiceDefaulted":
          next.statusCasper = "Defaulted";
          break;
        case "AgentReputationUpdated":
          if (payload && typeof payload === "object" && "reputation_score" in payload) {
            // Event indexed for admin/agent views, not invoice state.
          }
          break;
      }
    }

    next.statusLastSyncedAt = new Date().toISOString();
    return paymentStore.updateInvoice(invoiceId, next);
  }

  async getInvoiceState(invoiceId: string): Promise<InvoicePaymentRecord> {
    return this.deriveInvoiceState(invoiceId);
  }

  async getBootstrapStatus(): Promise<BootstrapStatusRecord> {
    const { paymentStore } = await getPaymentRuntime();
    return (
      (await paymentStore.getBootstrapStatus(BOOTSTRAP_STATUS_ID)) ?? {
        id: BOOTSTRAP_STATUS_ID,
        lifecycleMode: hasCasperLifecycleConfig() ? "real" : "unavailable",
        agentRegistered: false,
        settlementRelayerRegistered: false,
        vaultLiquidityDeposited: false,
        updatedAt: new Date(0).toISOString()
      }
    );
  }

  async updateBootstrapStatus(patch: Partial<BootstrapStatusRecord>): Promise<BootstrapStatusRecord> {
    const { paymentStore } = await getPaymentRuntime();
    const current = await this.getBootstrapStatus();
    return paymentStore.upsertBootstrapStatus({
      ...current,
      ...patch,
      id: BOOTSTRAP_STATUS_ID,
      updatedAt: new Date().toISOString()
    });
  }

  private async getEventsLength(contractHash: string): Promise<number> {
    const result = await this.rpcClient.queryLatestGlobalState(contractHash, ["__events_length"]);
    const raw = result.rawJSON as { stored_value?: { CLValue?: { parsed?: number } } };
    return Number(raw.stored_value?.CLValue?.parsed ?? 0);
  }

  private async getContractHash(packageHash: string, contractName: string): Promise<string> {
    const cacheKey = `${contractName}:${packageHash}`;
    if (!this.contractHashPromises.has(cacheKey)) {
      this.contractHashPromises.set(cacheKey, (async () => {
        const result = await this.rpcClient.queryLatestGlobalState(packageHash, []);
        const raw = result.rawJSON as {
          stored_value?: { ContractPackage?: { versions?: Array<{ contract_hash?: string }> } };
        };
        const contractHash = raw.stored_value?.ContractPackage?.versions?.at(-1)?.contract_hash;
        if (!contractHash) {
          throw new Error(`Unable to resolve latest ${contractName} contract hash`);
        }
        return `hash-${stripContractPrefix(contractHash)}`;
      })());
    }
    return this.contractHashPromises.get(cacheKey) as Promise<string>;
  }

  private async getEventsURef(contractHash: string, contractName: string): Promise<string> {
    const cacheKey = `${contractName}:${contractHash}`;
    if (!this.eventsURefPromises.has(cacheKey)) {
      this.eventsURefPromises.set(cacheKey, (async () => {
        const result = await this.rpcClient.queryLatestGlobalState(contractHash, []);
        const contract = result.storedValue.contract;
        const namedKeys = contract?.namedKeys ?? [];
        const eventsNamedKey = namedKeys.find((entry) => entry.name === "__events");
        const uref = eventsNamedKey?.key?.toPrefixedString?.();
        if (!uref) {
          throw new Error(`Unable to resolve ${contractName} __events dictionary URef`);
        }
        return uref;
      })());
    }
    return this.eventsURefPromises.get(cacheKey) as Promise<string>;
  }
}

export function contractInvoiceIdHash(invoiceId: string): `0x${string}` {
  return /^0x[0-9a-f]{64}$/i.test(invoiceId) ? invoiceId.toLowerCase() as `0x${string}` : sha256Hex(invoiceId);
}

export function isCanonicalRegistryEvent(eventIndex: number): boolean {
  return eventIndex >= 0 && eventIndex < 1_000_000_000;
}

export function parseLifecycleEvent(bytesHex: string, eventIndex: number): ParsedLifecycleEvent {
  const bytes = Buffer.from(bytesHex, "hex");
  if (bytes.length < 8) throw new Error("Odra event bytes are truncated");
  const envelopeLength = bytes.readUInt32LE(0);
  if (envelopeLength > bytes.length - 4) throw new Error("Odra event envelope length is invalid");
  const nameLength = bytes.readUInt32LE(4);
  if (nameLength > bytes.length - 8) throw new Error("Odra event name length is invalid");
  const name = sanitizeCasperEventName(bytes.subarray(8, 8 + nameLength).toString("utf8"));
  const eventName = name.replace(/^event_/, "");
  const payloadOffset = 8 + nameLength;
  const payload = bytes.subarray(payloadOffset);
  const payloadJson = JSON.stringify({ bytes: bytesHex });

  switch (eventName) {
    case "InvoiceCreated":
      return {
        eventIndex,
        eventName,
        invoiceIdHash: `0x${payload.subarray(0, 32).toString("hex")}`,
        actorPublicKey: parseOdraAddress(payload, 32),
        payloadJson
      };
    case "InvoiceScored":
      return {
        eventIndex,
        eventName,
        invoiceIdHash: `0x${payload.subarray(0, 32).toString("hex")}`,
        actorPublicKey: parseOdraAddress(payload, 32),
        payloadJson
      };
    case "InvoiceListed":
    case "GatewayRepaymentRecorded":
    case "InvoiceSettled":
    case "InvoiceDefaulted":
      return {
        eventIndex,
        eventName,
        invoiceIdHash: `0x${payload.subarray(0, 32).toString("hex")}`,
        payloadJson
      };
    case "InvoiceFundingRegistered":
    case "VaultInvoiceFunded":
      return {
        eventIndex,
        eventName,
        invoiceIdHash: `0x${payload.subarray(0, 32).toString("hex")}`,
        actorPublicKey: parseOdraAddress(payload, 65),
        payloadJson
      };
    case "InvoiceFunded":
      return {
        eventIndex,
        eventName,
        invoiceIdHash: `0x${payload.subarray(0, 32).toString("hex")}`,
        actorPublicKey: parseOdraAddress(payload, 32),
        payloadJson
      };
    case "SellerAdvanceCashedOut":
    case "InvestorClaimed":
    case "InvestorRepaymentClaimed":
      return {
        eventIndex,
        eventName,
        invoiceIdHash: `0x${payload.subarray(0, 32).toString("hex")}`,
        actorPublicKey: parseOdraAddress(payload, 32),
        payloadJson
      };
    case "AgentReputationUpdated":
      return {
        eventIndex,
        eventName,
        actorPublicKey: parseOdraAddress(payload, 0),
        payloadJson
      };
    default:
      return {
        eventIndex,
        eventName,
        payloadJson
      };
  }
}

function parseOdraAddress(payload: Buffer, offset: number): string | undefined {
  if (payload.length < offset + 33) return undefined;
  const variant = payload[offset];
  const hash = payload.subarray(offset + 1, offset + 33).toString("hex");
  if (variant === 0) return `account-hash-${hash}`;
  if (variant === 1) return `hash-${hash}`;
  return undefined;
}

function sanitizeCasperEventName(value: string): string {
  return value.replace(/\u0000/g, "").trim();
}

function toAccountHash(publicKeyHex: string): string {
  return casperSdk.PublicKey.fromHex(publicKeyHex).accountHash().toPrefixedString();
}

function stripContractPrefix(value: string): string {
  return value.startsWith("contract-") ? value.slice("contract-".length) : value.replace(/^hash-/, "");
}

function parsePayload(payloadJson: string): unknown {
  try {
    return JSON.parse(payloadJson);
  } catch {
    return undefined;
  }
}

export function isTerminalInvoiceStatus(status: InvoiceStatus): boolean {
  return status === "Settled" || status === "Defaulted" || status === "Rejected" || status === "Cancelled";
}
