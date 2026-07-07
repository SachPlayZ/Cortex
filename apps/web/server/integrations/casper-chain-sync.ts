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
    cursorId: "invoice_registry_events",
    packageHashEnv: "INVOICE_REGISTRY_PACKAGE_HASH",
    contractName: "InvoiceRegistry",
    eventOffset: 0
  },
  {
    cursorId: "funding_vault_events",
    packageHashEnv: "FUNDING_VAULT_PACKAGE_HASH",
    contractName: "FundingVault",
    eventOffset: 1_000_000_000
  },
  {
    cursorId: "repayment_escrow_events",
    packageHashEnv: "REPAYMENT_ESCROW_PACKAGE_HASH",
    contractName: "RepaymentEscrow",
    eventOffset: 2_000_000_000
  }
] as const;

type ParsedLifecycleEvent = {
  eventIndex: number;
  eventName: string;
  invoiceIdHash?: `0x${string}`;
  actorPublicKey?: string;
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
    const invoiceByHash = new Map(invoices.map((invoice) => [invoice.casperInvoiceIdHash ?? sha256Hex(invoice.id), invoice]));
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

      if (eventsLength > 0 && cursor.lastEventIndex < eventsLength - 1) {
        const eventsURef = await this.getEventsURef(contractHash, source.contractName);
        for (let index = cursor.lastEventIndex + 1; index < eventsLength; index += 1) {
          const dictionaryItem = await this.rpcClient.getDictionaryItem(stateRootHash, eventsURef, String(index));
          const bytesHex =
            ((dictionaryItem.rawJSON as { stored_value?: { CLValue?: { bytes?: string } } })?.stored_value?.CLValue?.bytes ?? "");
          if (!bytesHex) continue;
          const parsed = parseLifecycleEvent(bytesHex, source.eventOffset + index);
          const matchedInvoice = parsed.invoiceIdHash ? invoiceByHash.get(parsed.invoiceIdHash) : undefined;
          await paymentStore.upsertCasperLifecycleEvent({
            id: `${source.cursorId}:${index}`,
            eventIndex: source.eventOffset + index,
            eventName: parsed.eventName,
            invoiceId: matchedInvoice?.id,
            actorPublicKey: parsed.actorPublicKey,
            payloadJson: parsed.payloadJson,
            observedAt: new Date().toISOString(),
            syncSource: "dictionary"
          });
        }
      }

      await paymentStore.upsertCasperSyncCursor({
        id: source.cursorId,
        lastEventIndex: Math.max(cursor.lastEventIndex, eventsLength - 1),
        lastSyncedAt: new Date().toISOString()
      });
      totalLastEventIndex = Math.max(totalLastEventIndex, source.eventOffset + Math.max(eventsLength - 1, -1));
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
    const events = await paymentStore.listCasperLifecycleEventsByInvoice(invoiceId);
    const next: Partial<InvoicePaymentRecord> = {
      casperInvoiceIdHash: invoice.casperInvoiceIdHash ?? sha256Hex(invoice.id),
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
        case "InvoiceFundingRegistered":
        case "VaultInvoiceFunded":
          next.statusCasper = "RepaymentPending";
          if (event.actorPublicKey) {
            next.investorPublicKey = event.actorPublicKey;
            next.investorAccount = toAccountHash(event.actorPublicKey);
          }
          break;
        case "SellerAdvanceCashedOut":
          next.statusCasper = "RepaymentPending";
          break;
        case "GatewayRepaymentRecorded":
          next.statusCasper = "Repaid";
          break;
        case "InvestorClaimed":
        case "InvestorRepaymentClaimed":
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

function parseLifecycleEvent(bytesHex: string, eventIndex: number): ParsedLifecycleEvent {
  const bytes = Buffer.from(bytesHex, "hex");
  const nameLength = bytes.readUInt32LE(0);
  const name = sanitizeCasperEventName(bytes.subarray(4, 4 + nameLength).toString("utf8"));
  const eventName = name.replace(/^event_/, "");
  const payloadOffset = 4 + nameLength;
  const payload = bytes.subarray(payloadOffset);
  const payloadJson = JSON.stringify({ bytes: bytesHex });

  switch (eventName) {
    case "InvoiceCreated":
      return {
        eventIndex,
        eventName,
        invoiceIdHash: `0x${payload.subarray(0, 32).toString("hex")}`,
        actorPublicKey: payload.subarray(32, 65).toString("hex"),
        payloadJson
      };
    case "InvoiceScored":
      return {
        eventIndex,
        eventName,
        invoiceIdHash: `0x${payload.subarray(0, 32).toString("hex")}`,
        actorPublicKey: payload.subarray(32, 65).toString("hex"),
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
        actorPublicKey: payload.subarray(65, 98).toString("hex"),
        payloadJson
      };
    case "InvoiceFunded":
      return {
        eventIndex,
        eventName,
        invoiceIdHash: `0x${payload.subarray(0, 32).toString("hex")}`,
        actorPublicKey: payload.subarray(32, 65).toString("hex"),
        payloadJson
      };
    case "SellerAdvanceCashedOut":
    case "InvestorClaimed":
    case "InvestorRepaymentClaimed":
      return {
        eventIndex,
        eventName,
        invoiceIdHash: `0x${payload.subarray(0, 32).toString("hex")}`,
        actorPublicKey: payload.subarray(32, 65).toString("hex"),
        payloadJson
      };
    case "AgentReputationUpdated":
      return {
        eventIndex,
        eventName,
        actorPublicKey: payload.subarray(0, 33).toString("hex"),
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
