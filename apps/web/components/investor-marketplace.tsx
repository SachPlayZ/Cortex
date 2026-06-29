"use client";

import { useEffect, useMemo, useState } from "react";
import { aprEquivalent, expectedReturnPercent, formatUsd, investorYield, type ReceivableView } from "../lib/finance";
import { WalletGate, shortAccount, useCasperWallet } from "./casper-wallet";
import { StatusPill } from "./status-pill";
import { buttonVariants } from "./ui/button";
import { cn } from "@/lib/utils";

export function InvestorMarketplace() {
  return (
    <WalletGate role="investor" title="Connect the investor wallet before funding receivables.">
      <ConnectedInvestorMarketplace />
    </WalletGate>
  );
}

function ConnectedInvestorMarketplace() {
  const wallet = useCasperWallet();
  const marketplace = useReceivables({ status: "Listed" });
  const portfolio = useReceivables({ role: "investor", account: wallet.accountHash });
  const committed = useMemo(
    () => portfolio.invoices.reduce((sum, invoice) => sum + BigInt(invoice.advanceAmountUsdCents ?? "0"), 0n),
    [portfolio.invoices]
  );
  const expectedYield = useMemo(
    () => portfolio.invoices.reduce((sum, invoice) => sum + BigInt(invoice.investorYieldUsdCents ?? investorYield(invoice)), 0n),
    [portfolio.invoices]
  );

  return (
    <>
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <h2 className="m-0 text-lg font-bold tracking-tight text-ink">Investor marketplace</h2>
        <span className="rounded-full border border-line bg-[rgba(24,24,28,0.88)] px-2.5 py-1.5 text-xs font-semibold text-ink">
          Investor wallet {shortAccount(wallet.accountHash)}
        </span>
      </div>

      <section className="mb-10 grid grid-cols-3 gap-3 max-sm:grid-cols-1">
        <div className="flex flex-col gap-1.5 rounded-[10px] border border-line bg-panel px-6 py-[22px]">
          <div className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">Portfolio committed</div>
          <div className="text-[26px] font-extrabold tracking-[-0.03em] tabular-nums text-ink">{formatUsd(committed.toString())}</div>
          <div className="mt-0.5 text-xs text-ink-muted-2">Crypto-funded receivable positions for this wallet</div>
        </div>
        <div className="flex flex-col gap-1.5 rounded-[10px] border border-line bg-panel px-6 py-[22px]">
          <div className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">Expected yield</div>
          <div className="text-[26px] font-extrabold tracking-[-0.03em] tabular-nums text-good">{formatUsd(expectedYield.toString())}</div>
          <div className="mt-0.5 text-xs text-ink-muted-2">Claims unlock after Dodo webhook settlement</div>
        </div>
        <div className="flex flex-col gap-1.5 rounded-[10px] border border-line bg-panel px-6 py-[22px]">
          <div className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">Open listings</div>
          <div className="text-[26px] font-extrabold tracking-[-0.03em] tabular-nums text-ink">{marketplace.invoices.length}</div>
          <div className="mt-0.5 text-xs text-ink-muted-2">Live receivables listed from real uploads</div>
        </div>
      </section>

      <div className="mb-3.5 flex items-center gap-3">
        <h2 className="m-0 text-lg font-bold tracking-tight text-ink">Available receivables</h2>
      </div>
      {marketplace.state === "loading" ? (
        <EmptyState><p className="text-ink">Loading marketplace...</p></EmptyState>
      ) : null}
      {marketplace.state === "error" ? (
        <EmptyState>
          <p className="text-ink">Marketplace unavailable</p>
          <p className="m-0 text-xs text-bad">{marketplace.error}</p>
        </EmptyState>
      ) : null}
      {marketplace.state === "ready" && marketplace.invoices.length === 0 ? (
        <EmptyState>
          <p className="text-lg font-bold tracking-tight text-ink">No listed receivables yet.</p>
          <p className="m-0 text-xs leading-relaxed text-ink-muted">
            Clean slate. Invoices appear here only after real seller underwriting and Casper listing.
          </p>
        </EmptyState>
      ) : null}

      {marketplace.invoices.length > 0 ? (
        <section className="mb-9 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          {marketplace.invoices.map((invoice) => (
            <article key={invoice.id} className="grid gap-4 rounded-[10px] border border-line bg-[rgba(17,17,22,0.84)] p-5">
              <div className="flex justify-between gap-4">
                <div>
                  <span className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">{invoice.id}</span>
                  <h3 className="mt-1.5 m-0 text-lg font-bold tracking-[-0.02em] text-ink">{invoice.title ?? "Receivable"}</h3>
                </div>
                <StatusPill status={invoice.statusCasper} />
              </div>
              <div className="grid grid-cols-4 gap-2.5 max-sm:grid-cols-2">
                <NumberStat label="Fund" value={formatUsd(invoice.advanceAmountUsdCents ?? "0")} />
                <NumberStat label="Receive" value={formatUsd(invoice.repaymentAmountUsdCents)} />
                <NumberStat label="Yield" value={`${formatUsd(invoice.investorYieldUsdCents ?? investorYield(invoice))} / ${expectedReturnPercent(invoice)}`} />
                <NumberStat label="APR display" value={aprEquivalent(invoice)} />
              </div>
              <p className="m-0 text-xs leading-relaxed text-ink-muted">
                Risk {invoice.riskTier ?? "pending"} / {invoice.riskScore ?? "-"}.
                {invoice.dueDate ? ` Due ${invoice.dueDate}.` : ""} Agent confidence{" "}
                {invoice.agentConfidence ? `${(invoice.agentConfidence * 100).toFixed(0)}%` : "pending"}.
              </p>
              <a href={`/invoice/${invoice.id}`} className={cn(buttonVariants({ size: "sm" }), "w-fit")}>Inspect and fund</a>
            </article>
          ))}
        </section>
      ) : null}

      <div className="mb-3.5 flex items-center gap-3">
        <h2 className="m-0 text-lg font-bold tracking-tight text-ink">Current portfolio</h2>
      </div>
      {portfolio.state === "ready" && portfolio.invoices.length === 0 ? (
        <EmptyState>
          <p className="text-lg font-bold tracking-tight text-ink">No funded invoices for this wallet yet.</p>
          <p className="m-0 text-xs leading-relaxed text-ink-muted">Fund a listed receivable to add it to this connected wallet&apos;s portfolio.</p>
        </EmptyState>
      ) : null}
      {portfolio.invoices.length > 0 ? (
        <section className="grid gap-1.5">
          {portfolio.invoices.map((invoice) => (
            <a
              key={invoice.id}
              href={`/invoice/${invoice.id}`}
              className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.9fr_60px] items-center gap-3.5 rounded-[10px] border border-line bg-panel px-4 py-3.5 text-inherit transition-colors hover:border-ink-muted-2 hover:bg-panel-elevated max-sm:grid-cols-1"
            >
              <div>
                <strong className="text-ink">{invoice.id}</strong>
                <br />
                <span className="text-xs text-ink-muted">Due {invoice.dueDate ?? "not set"}</span>
              </div>
              <div className="tabular-nums text-ink">{formatUsd(invoice.advanceAmountUsdCents ?? "0")} funded</div>
              <div className="tabular-nums text-ink">{formatUsd(invoice.investorYieldUsdCents ?? investorYield(invoice))} yield</div>
              <div><StatusPill status={invoice.statusCasper} /></div>
              <div className="text-sm font-semibold text-ink-muted">Claim</div>
            </a>
          ))}
        </section>
      ) : null}
    </>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <section className="mb-6 grid gap-4 rounded-[10px] border border-line bg-gradient-to-b from-[rgba(24,24,28,0.96)] to-[rgba(17,17,22,0.96)] p-[22px]">
      {children}
    </section>
  );
}

function NumberStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-1 rounded-lg border border-line-subtle bg-[rgba(9,9,11,0.36)] p-3">
      <span className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">{label}</span>
      <strong className="overflow-anywhere font-semibold text-ink">{value}</strong>
    </div>
  );
}

function useReceivables(filter: { role?: "investor"; account?: string; status?: string }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [invoices, setInvoices] = useState<ReceivableView[]>([]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (filter.role) params.set("role", filter.role);
    if (filter.account) params.set("account", filter.account);
    if (filter.status) params.set("status", filter.status);

    async function load() {
      setState("loading");
      setError("");
      try {
        const response = await fetch(`/api/invoices?${params.toString()}`, { cache: "no-store" });
        const body = (await response.json()) as { invoices?: ReceivableView[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? "Unable to load receivables");
        if (!cancelled) {
          setInvoices(body.invoices ?? []);
          setState("ready");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load receivables");
          setState("error");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [filter.account, filter.role, filter.status]);

  return { invoices, state, error };
}
