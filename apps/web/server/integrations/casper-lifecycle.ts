import { randomUUID } from "node:crypto";
import type { InvoiceStatus } from "@cortex/shared";
import type { ReceivableView } from "../../lib/finance";
import { getCasperLifecycleClient, getPaymentRuntime, hasAgentSignerConfig, hasCasperLifecycleConfig } from "../payment-runtime";
import { CasperChainSyncService, contractInvoiceIdHash } from "./casper-chain-sync";
import type { BootstrapStatusRecord, InvoicePaymentRecord, LifecycleAction, LifecycleIntentRecord } from "./payment-store";

type PreparedLifecycleAction = {
  intent_id: string;
  entryPoint: string;
  transaction: unknown;
  transaction_hash: string;
  expires_at: string;
};

const INTENT_TTL_MS = 10 * 60 * 1000;
const BOOTSTRAP_STATUS_ID = "invoice_registry_bootstrap";

export class CasperLifecycleService {
  private readonly chainSync = hasCasperLifecycleConfig() ? new CasperChainSyncService() : undefined;

  async prepareMint(invoiceId: string, publicKeyHex: string, accountHash: string): Promise<PreparedLifecycleAction> {
    this.requireLifecycleConfig();
    const invoice = await this.requireInvoice(invoiceId);
    this.requireSellerWallet(invoice, publicKeyHex, accountHash, "Only the seller wallet can mint this receivable");
    if (invoice.statusCasper === "Rejected") {
      throw new Error("Rejected invoices cannot be minted");
    }
    if (invoice.casperInvoiceExists) {
      throw new Error("Invoice is already registered on Casper");
    }
    const prepared = getCasperLifecycleClient().prepareCreateInvoice(invoice, publicKeyHex);
    return this.recordIntent(invoice, "mint", publicKeyHex, accountHash, undefined, prepared);
  }

  async confirmMint(invoiceId: string, intentId: string, deployHash: string): Promise<ReceivableView> {
    this.requireLifecycleConfig();
    this.requireAgentConfig();
    await this.requireBootstrap("agentRegistered");
    const adminSigner = this.requireAdminSigner();
    const invoice = await this.requireInvoice(invoiceId);
    const intent = await this.verifyIntent(invoiceId, intentId, "mint", deployHash);
    return this.runConfirm(intentId, async () => {
      await this.ensureMintPrecondition(invoiceId);
      await this.verifyTransactionAgainstIntent(intent, deployHash);

      const { paymentStore } = await getPaymentRuntime();
      await paymentStore.updateInvoice(invoiceId, {
        sellerPublicKey: intent.publicKeyHex,
        sellerAccount: intent.accountHash ?? invoice.sellerAccount,
        casperInvoiceExists: true,
        createDeployHash: deployHash
      });

      const lifecycle = getCasperLifecycleClient();
      const scoredInvoice = await paymentStore.requireInvoice(invoiceId);
      const agentKeyPath = process.env.AGENT_PRIVATE_KEY_PATH;
      if (!agentKeyPath) {
        throw new Error("AGENT_PRIVATE_KEY_PATH is not configured");
      }
      const scoreDeployHash = await lifecycle.postRiskScore(scoredInvoice, { keyPath: agentKeyPath });
      await lifecycle.waitForTransaction(scoreDeployHash);
      const reputationDeployHash = await lifecycle.noteInvoiceScored(process.env.AGENT_PUBLIC_KEY ?? intent.publicKeyHex, adminSigner);
      await lifecycle.waitForTransaction(reputationDeployHash);
      const synced = await this.syncAndPersist(invoiceId, {
        scoreDeployHash,
        casperInvoiceExists: true,
        createDeployHash: deployHash
      });
      await paymentStore.updateLifecycleIntent(intentId, { status: "confirmed", confirmedDeployHash: deployHash });
      return synced;
    });
  }

  async prepareList(invoiceId: string, publicKeyHex: string, accountHash: string): Promise<PreparedLifecycleAction> {
    this.requireLifecycleConfig();
    const invoice = await this.chainSyncRequired().getInvoiceState(invoiceId);
    this.requireSellerWallet(invoice, publicKeyHex, accountHash, "Only the seller wallet can list this receivable");
    if (invoice.statusCasper !== "Scored") {
      throw new Error(`List requires verified Casper status Scored, got ${invoice.statusCasper}`);
    }
    const prepared = getCasperLifecycleClient().prepareListInvoice(invoiceId, publicKeyHex);
    return this.recordIntent(invoice, "list", publicKeyHex, accountHash, "Scored", prepared);
  }

  async confirmList(invoiceId: string, intentId: string, deployHash: string): Promise<ReceivableView> {
    const intent = await this.verifyIntent(invoiceId, intentId, "list", deployHash, "Scored");
    return this.runConfirm(intentId, async () => {
      await this.verifyTransactionAgainstIntent(intent, deployHash);
      const synced = await this.syncAndPersist(invoiceId, { listDeployHash: deployHash });
      await this.markIntentConfirmed(intentId, deployHash);
      return synced;
    });
  }

  async prepareFund(invoiceId: string, publicKeyHex: string, accountHash: string): Promise<PreparedLifecycleAction> {
    const invoice = await this.chainSyncRequired().getInvoiceState(invoiceId);
    if (
      (invoice.sellerPublicKey && invoice.sellerPublicKey === publicKeyHex) ||
      (invoice.sellerAccount && invoice.sellerAccount === accountHash)
    ) {
      throw new Error("Seller cannot fund their own invoice");
    }
    if (invoice.statusCasper !== "Listed") {
      throw new Error(`Funding requires verified Casper status Listed, got ${invoice.statusCasper}`);
    }
    const prepared = getCasperLifecycleClient().prepareFundInvoice(invoice, publicKeyHex);
    return this.recordIntent(invoice, "fund", publicKeyHex, accountHash, "Listed", prepared);
  }

  async confirmFund(invoiceId: string, intentId: string, deployHash: string): Promise<ReceivableView> {
    const intent = await this.verifyIntent(invoiceId, intentId, "fund", deployHash, "Listed");
    return this.runConfirm(intentId, async () => {
      await this.verifyTransactionAgainstIntent(intent, deployHash);
      const synced = await this.syncAndPersist(invoiceId, {
        fundDeployHash: deployHash,
        investorPublicKey: intent.publicKeyHex,
        investorAccount: intent.accountHash
      });
      await this.markIntentConfirmed(intentId, deployHash);
      return synced;
    });
  }

  async prepareCashout(invoiceId: string, publicKeyHex: string, accountHash: string): Promise<PreparedLifecycleAction> {
    await this.requireBootstrap("vaultLiquidityDeposited");
    const invoice = await this.chainSyncRequired().getInvoiceState(invoiceId);
    this.requireSellerWallet(invoice, publicKeyHex, accountHash, "Only the seller wallet can withdraw the advance");
    if (invoice.statusCasper !== "RepaymentPending") {
      throw new Error(`Cash out requires verified Casper status RepaymentPending, got ${invoice.statusCasper}`);
    }
    if (invoice.cashoutDeployHash) {
      throw new Error("Advance already withdrawn for this invoice");
    }
    const prepared = getCasperLifecycleClient().prepareCashOutAdvance(invoiceId, publicKeyHex);
    return this.recordIntent(invoice, "cashout", publicKeyHex, accountHash, "RepaymentPending", prepared);
  }

  async confirmCashout(invoiceId: string, intentId: string, deployHash: string): Promise<ReceivableView> {
    const intent = await this.verifyIntent(invoiceId, intentId, "cashout", deployHash, "RepaymentPending");
    return this.runConfirm(intentId, async () => {
      await this.verifyTransactionAgainstIntent(intent, deployHash);
      const synced = await this.syncAndPersist(invoiceId, { cashoutDeployHash: deployHash });
      await this.markIntentConfirmed(intentId, deployHash);
      return synced;
    });
  }

  async prepareClaim(invoiceId: string, publicKeyHex: string, accountHash: string): Promise<PreparedLifecycleAction> {
    const invoice = await this.chainSyncRequired().getInvoiceState(invoiceId);
    const isInvestor = invoice.investorPublicKey
      ? invoice.investorPublicKey === publicKeyHex
      : Boolean(invoice.investorAccount) && invoice.investorAccount === accountHash;
    if (!isInvestor) {
      throw new Error("Only the investor wallet can claim repayment");
    }
    if (invoice.statusCasper !== "Repaid") {
      throw new Error(`Claim requires verified Casper status Repaid, got ${invoice.statusCasper}`);
    }
    const prepared = getCasperLifecycleClient().prepareClaimRepayment(invoiceId, publicKeyHex);
    return this.recordIntent(invoice, "claim", publicKeyHex, accountHash, "Repaid", prepared);
  }

  async confirmClaim(invoiceId: string, intentId: string, deployHash: string): Promise<ReceivableView> {
    const intent = await this.verifyIntent(invoiceId, intentId, "claim", deployHash, "Repaid");
    return this.runConfirm(intentId, async () => {
      await this.verifyTransactionAgainstIntent(intent, deployHash);
      const synced = await this.syncAndPersist(invoiceId, { claimDeployHash: deployHash });
      await this.markIntentConfirmed(intentId, deployHash);
      return synced;
    });
  }

  async reconcileInvoice(invoiceId: string): Promise<ReceivableView> {
    return this.chainSyncRequired().getInvoiceState(invoiceId);
  }

  async getHealth() {
    const bootstrap = await this.getBootstrapStatus();
    return {
      config_present: hasCasperLifecycleConfig(),
      lifecycle_mode: hasCasperLifecycleConfig() ? "real" : "unavailable",
      bootstrap_completed:
        bootstrap.agentRegistered &&
        bootstrap.settlementRelayerRegistered &&
        bootstrap.vaultLiquidityDeposited,
      bootstrap
    };
  }

  async bootstrap(options?: { depositAmountUsdCents?: string }): Promise<BootstrapStatusRecord> {
    this.requireLifecycleConfig();
    const adminKeyPath = process.env.CASPER_ADMIN_PRIVATE_KEY_PATH;
    if (!adminKeyPath) {
      throw new Error("CASPER_ADMIN_PRIVATE_KEY_PATH is required for bootstrap");
    }
    if (!process.env.AGENT_PUBLIC_KEY || !process.env.SETTLEMENT_RELAYER_PUBLIC_KEY) {
      throw new Error("AGENT_PUBLIC_KEY and SETTLEMENT_RELAYER_PUBLIC_KEY are required for bootstrap");
    }
    const lifecycle = getCasperLifecycleClient();
    const signer = { keyPath: adminKeyPath };
    const current = await this.getBootstrapStatus();
    const next: Partial<BootstrapStatusRecord> = {
      lifecycleMode: "real"
    };

    const registryAgentDeployHash = await lifecycle.registerRegistryAgent(process.env.AGENT_PUBLIC_KEY, signer);
    await lifecycle.waitForTransaction(registryAgentDeployHash);
    const reputationAgentDeployHash = await lifecycle.registerReputationAgent(process.env.AGENT_PUBLIC_KEY, signer);
    await lifecycle.waitForTransaction(reputationAgentDeployHash);
    next.agentRegistered = true;
    next.registerAgentDeployHash = `${registryAgentDeployHash},${reputationAgentDeployHash}`;

    const registryRelayerDeployHash = await lifecycle.registerRegistrySettlementRelayer(process.env.SETTLEMENT_RELAYER_PUBLIC_KEY, signer);
    await lifecycle.waitForTransaction(registryRelayerDeployHash);
    const escrowRelayerDeployHash = await lifecycle.registerEscrowSettlementRelayer(process.env.SETTLEMENT_RELAYER_PUBLIC_KEY, signer);
    await lifecycle.waitForTransaction(escrowRelayerDeployHash);
    next.settlementRelayerRegistered = true;
    next.registerSettlementRelayerDeployHash = `${registryRelayerDeployHash},${escrowRelayerDeployHash}`;
    const depositAmount = options?.depositAmountUsdCents ?? process.env.CASPER_BOOTSTRAP_VAULT_LIQUIDITY_CENTS;
    if (depositAmount && !current.vaultLiquidityDeposited) {
      const deployHash = await lifecycle.depositVaultLiquidity(depositAmount, signer);
      await lifecycle.waitForTransaction(deployHash);
      next.vaultLiquidityDeposited = true;
      next.depositVaultLiquidityDeployHash = deployHash;
    }

    return this.chainSyncRequired().updateBootstrapStatus(next);
  }

  async requireInvoice(invoiceId: string): Promise<ReceivableView> {
    const { paymentStore } = await getPaymentRuntime();
    return paymentStore.requireInvoice(invoiceId);
  }

  private async recordIntent(
    invoice: ReceivableView,
    action: LifecycleAction,
    publicKeyHex: string,
    accountHash: string,
    expectedPreStatus: InvoiceStatus | undefined,
    prepared: { entryPoint: string; transaction: unknown; transactionHash: string }
  ): Promise<PreparedLifecycleAction> {
    const { paymentStore } = await getPaymentRuntime();
    const intentId = randomUUID();
    const expiresAt = new Date(Date.now() + INTENT_TTL_MS).toISOString();
    const expectedInvoiceIdHash = contractInvoiceIdHash(invoice.id);
    await paymentStore.upsertLifecycleIntent({
      id: intentId,
      invoiceId: invoice.id,
      action,
      publicKeyHex,
      accountHash,
      expectedTransactionHash: prepared.transactionHash,
      expectedEntryPoint: prepared.entryPoint,
      expectedInvoiceIdHash,
      expectedPreStatus,
      preparedTransactionJson: prepared.transaction,
      expiresAt,
      status: "prepared"
    });
    return {
      intent_id: intentId,
      entryPoint: prepared.entryPoint,
      transaction: prepared.transaction,
      transaction_hash: prepared.transactionHash,
      expires_at: expiresAt
    };
  }

  private async verifyIntent(
    invoiceId: string,
    intentId: string,
    action: LifecycleAction,
    deployHash: string,
    expectedPreStatus?: InvoiceStatus
  ): Promise<LifecycleIntentRecord> {
    const intent = await this.getIntent(intentId);
    if (intent.invoiceId !== invoiceId) throw new Error("Lifecycle intent does not match invoice");
    if (intent.action !== action) throw new Error("Lifecycle intent does not match requested action");
    if (intent.status !== "prepared") throw new Error("Lifecycle intent is no longer active");
    if (new Date(intent.expiresAt).getTime() < Date.now()) {
      const { paymentStore } = await getPaymentRuntime();
      await paymentStore.updateLifecycleIntent(intentId, { status: "expired" });
      throw new Error("Lifecycle intent expired before confirmation");
    }
    if (stripHash(deployHash) !== stripHash(intent.expectedTransactionHash)) {
      throw new Error("Submitted deploy hash does not match the prepared transaction hash");
    }
    const { paymentStore } = await getPaymentRuntime();
    const claimed = await paymentStore.claimLifecycleIntent(intentId);
    if (!claimed) throw new Error("Lifecycle intent is already being confirmed");
    try {
      if (expectedPreStatus) {
        const chainInvoice = await this.chainSyncRequired().getInvoiceState(invoiceId);
        const expectedPostStatus = postStatusForAction(action);
        if (chainInvoice.statusCasper !== expectedPreStatus && chainInvoice.statusCasper !== expectedPostStatus) {
          throw new Error(
            `Lifecycle action requires verified Casper status ${expectedPreStatus} or ${expectedPostStatus}, got ${chainInvoice.statusCasper}`
          );
        }
      }
    } catch (error) {
      await this.releaseIntent(intentId);
      throw error;
    }
    return claimed;
  }

  private async releaseIntent(intentId: string) {
    const { paymentStore } = await getPaymentRuntime();
    await paymentStore.updateLifecycleIntent(intentId, { status: "prepared" }).catch(() => undefined);
  }

  private async runConfirm<T>(intentId: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      await this.releaseIntent(intentId);
      throw error;
    }
  }

  private async ensureMintPrecondition(invoiceId: string) {
    const invoice = await this.chainSyncRequired().getInvoiceState(invoiceId);
    if (invoice.casperInvoiceExists) {
      throw new Error("Invoice is already registered on Casper");
    }
  }

  private async verifyTransactionAgainstIntent(intent: LifecycleIntentRecord, deployHash: string): Promise<void> {
    await getCasperLifecycleClient().waitForTransaction(deployHash);
    const receipt = await getCasperLifecycleClient().getTransactionReceipt(deployHash);
    const tx = receipt.rawJSON as {
      transaction?: {
        Version1?: {
          hash?: string;
          payload?: {
            initiator_addr?: { PublicKey?: string };
            fields?: {
              entry_point?: string | { Custom?: string };
              target?: { Stored?: { id?: { ByPackageHash?: { addr?: string } } } };
              args?: { Named?: Array<[string, { bytes?: string; parsed?: unknown; cl_type?: unknown }]> };
            };
          };
        };
      };
      execution_info?: {
        execution_result?: { error_message?: string | null; Version2?: { error_message?: string | null } };
      };
    };
    const version1 = tx.transaction?.Version1;
    if (!version1) {
      throw new Error("Unable to inspect Casper transaction payload");
    }
    const errorMessage =
      tx.execution_info?.execution_result?.error_message ??
      tx.execution_info?.execution_result?.Version2?.error_message;
    if (errorMessage) {
      throw new Error(errorMessage);
    }
    const signer = version1.payload?.initiator_addr?.PublicKey;
    if (!signer || signer.toLowerCase() !== intent.publicKeyHex.toLowerCase()) {
      throw new Error("Confirmed deploy signer does not match the prepared wallet public key");
    }
    const packageHash = version1.payload?.fields?.target?.Stored?.id?.ByPackageHash?.addr;
    const expectedPackageHash = expectedPackageHashForAction(intent.action);
    if (!packageHash || stripHash(packageHash) !== stripHash(expectedPackageHash)) {
      throw new Error("Confirmed deploy does not target the configured package for this lifecycle action");
    }
    const entryPoint = normalizeEntryPoint(version1.payload?.fields?.entry_point);
    if (entryPoint !== intent.expectedEntryPoint) {
      throw new Error("Confirmed deploy entry point does not match the prepared lifecycle action");
    }
    const actualHash = version1.hash;
    if (!actualHash || stripHash(actualHash) !== stripHash(intent.expectedTransactionHash)) {
      throw new Error("Confirmed deploy hash does not match the prepared transaction");
    }
    const actualArgs = JSON.stringify(normalizeNamedArgs(version1.payload?.fields?.args?.Named ?? []));
    const expectedArgs = JSON.stringify(normalizeNamedArgs(readPreparedNamedArgs(intent.preparedTransactionJson)));
    if (actualArgs !== expectedArgs) {
      throw new Error("Confirmed deploy runtime args do not match the prepared lifecycle action");
    }
  }

  private async syncAndPersist(invoiceId: string, patch: Partial<ReceivableView>): Promise<ReceivableView> {
    const { paymentStore } = await getPaymentRuntime();
    const synced = await this.chainSyncRequired().getInvoiceState(invoiceId);
    const next: Partial<InvoicePaymentRecord> = {
      ...synced,
      ...(patch as Partial<InvoicePaymentRecord>),
      statusLastSyncedAt: new Date().toISOString()
    };
    return paymentStore.updateInvoice(invoiceId, next);
  }

  private async getIntent(intentId: string): Promise<LifecycleIntentRecord> {
    const { paymentStore } = await getPaymentRuntime();
    const intent = await paymentStore.getLifecycleIntent(intentId);
    if (!intent) throw new Error("Lifecycle intent not found");
    return intent;
  }

  private async markIntentConfirmed(intentId: string, deployHash: string) {
    const { paymentStore } = await getPaymentRuntime();
    await paymentStore.updateLifecycleIntent(intentId, { status: "confirmed", confirmedDeployHash: deployHash });
  }

  private async getBootstrapStatus(): Promise<BootstrapStatusRecord> {
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

  private async requireBootstrap(field: keyof Pick<BootstrapStatusRecord, "agentRegistered" | "settlementRelayerRegistered" | "vaultLiquidityDeposited">) {
    const status = await this.getBootstrapStatus();
    if (!status[field]) {
      throw new Error(`Casper bootstrap is incomplete: ${field} is not yet confirmed`);
    }
  }

  private requireSellerWallet(invoice: ReceivableView, publicKeyHex: string, accountHash: string, message: string) {
    const isSeller = invoice.sellerPublicKey
      ? invoice.sellerPublicKey === publicKeyHex
      : Boolean(invoice.sellerAccount) && invoice.sellerAccount === accountHash;
    if (!isSeller) {
      throw new Error(message);
    }
  }

  private requireLifecycleConfig() {
    if (!hasCasperLifecycleConfig()) {
      throw new Error("Casper lifecycle routes require real Casper configuration");
    }
  }

  private requireAgentConfig() {
    if (!hasAgentSignerConfig()) {
      throw new Error("Agent signer configuration is required to post the on-chain risk score");
    }
  }

  private requireAdminSigner(): { keyPath: string } {
    const keyPath = process.env.CASPER_ADMIN_PRIVATE_KEY_PATH;
    if (!keyPath) {
      throw new Error("CASPER_ADMIN_PRIVATE_KEY_PATH is required for multi-contract lifecycle sync");
    }
    return { keyPath };
  }

  private chainSyncRequired(): CasperChainSyncService {
    if (!this.chainSync) {
      throw new Error("Casper chain sync is unavailable");
    }
    return this.chainSync;
  }
}

function postStatusForAction(action: LifecycleAction): InvoiceStatus | undefined {
  switch (action) {
    case "list":
      return "Listed";
    case "fund":
      return "RepaymentPending";
    case "cashout":
      return "RepaymentPending";
    case "claim":
      return "Settled";
    case "mint":
      return undefined;
  }
}

function stripHash(value: string): string {
  return value.replace(/^hash-/, "").replace(/^0x/, "").toLowerCase();
}

function normalizeEntryPoint(value: string | { Custom?: string } | undefined): string | undefined {
  return typeof value === "string" ? value : value?.Custom;
}

function expectedPackageHashForAction(action: LifecycleAction): string {
  void action;
  return process.env.INVOICE_REGISTRY_PACKAGE_HASH ?? "";
}

function readPreparedNamedArgs(transactionJson: unknown) {
  const tx = transactionJson as {
    payload?: {
      fields?: {
        args?: { Named?: unknown };
      };
    };
  };
  return tx.payload?.fields?.args?.Named ?? [];
}

function normalizeNamedArgs(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    if (!Array.isArray(entry) || entry.length !== 2) return entry;
    const [name, arg] = entry as [unknown, unknown];
    if (!arg || typeof arg !== "object") return [name, arg];
    const typedArg = arg as { bytes?: unknown; cl_type?: unknown };
    return [
      name,
      {
        ...(typedArg.bytes !== undefined ? { bytes: typedArg.bytes } : {}),
        ...(typedArg.cl_type !== undefined ? { cl_type: typedArg.cl_type } : {})
      }
    ];
  });
}
