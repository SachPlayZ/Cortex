import { CasperChainSyncService } from "./integrations/casper-chain-sync";
import { SettlementRelayer } from "./integrations/settlement-relayer";
import type { PaymentRuntime } from "./payment-runtime";

type BackgroundJobSummary = {
  synced: boolean;
  attempted: number;
  confirmed: number;
  retryableFailed: number;
};

let started = false;
let running = false;

export async function runBackgroundJobsOnce(
  runtime: PaymentRuntime,
  options: { syncCasper?: boolean; retryLimit?: number } = {}
): Promise<BackgroundJobSummary> {
  const retryLimit = parsePositiveInt(process.env.BACKGROUND_RETRY_BATCH_SIZE, 25);
  const shouldSyncCasper = options.syncCasper ?? hasCasperSyncConfig();
  const limit = options.retryLimit ?? retryLimit;
  const summary: BackgroundJobSummary = {
    synced: false,
    attempted: 0,
    confirmed: 0,
    retryableFailed: 0
  };

  if (shouldSyncCasper) {
    await new CasperChainSyncService().syncLatestEvents();
    summary.synced = true;
  }

  const jobs = await runtime.paymentStore.listRetryableRelayerJobs(limit);
  if (jobs.length === 0) return summary;

  const relayer = new SettlementRelayer(runtime.paymentStore, runtime.casperSettlement);
  for (const job of jobs) {
    const result = await relayer.submit(job);
    summary.attempted += 1;
    if (result.status === "confirmed") {
      summary.confirmed += 1;
    }
    if (result.status === "retryable_failed") {
      summary.retryableFailed += 1;
    }
  }

  return summary;
}

export function ensureBackgroundJobs(runtime: PaymentRuntime): void {
  if (started || process.env.NODE_ENV === "test" || process.env.DISABLE_BACKGROUND_JOBS === "true") {
    return;
  }
  started = true;

  const intervalMs = parsePositiveInt(process.env.BACKGROUND_SYNC_INTERVAL_MS, 15_000);
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runBackgroundJobsOnce(runtime);
    } catch (error) {
      console.error("Background Casper sync failed", error);
    } finally {
      running = false;
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref?.();
}

function hasCasperSyncConfig(): boolean {
  return Boolean(process.env.CASPER_NODE_RPC_URL) && Boolean(process.env.INVOICE_REGISTRY_PACKAGE_HASH);
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}
