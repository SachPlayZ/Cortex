"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUsd, type ReceivableView } from "../lib/finance";
import { WalletGate, shortAccount, useCasperWallet } from "./casper-wallet";
import { HostedPaymentLinkActions } from "./hosted-payment-link-actions";
import { StatusPill } from "./status-pill";
import { Button, buttonVariants } from "./ui/button";
import { cn } from "@/lib/utils";

export function SellerConsole() {
  return (
    <WalletGate role="seller" title="Connect the freelancer wallet to see your invoices.">
      <ConnectedSellerConsole />
    </WalletGate>
  );
}

function ConnectedSellerConsole() {
  const wallet = useCasperWallet();
  const { invoices, state, error } = useInvoices("seller", wallet.accountHash);
  const faceValue = useMemo(() => invoices.reduce((sum, invoice) => sum + BigInt(invoice.usdAmountCents ?? "0"), 0n), [invoices]);
  const advanced = useMemo(() => invoices.reduce((sum, invoice) => sum + BigInt(invoice.advanceAmountUsdCents ?? "0"), 0n), [invoices]);

  return (
    <>
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <h2 className="m-0 text-lg font-bold tracking-tight text-ink">Freelancer workspace</h2>
        <a href="/seller/upload" className={cn(buttonVariants({ size: "sm" }))}>Upload invoice</a>
      </div>

      <section className="mb-10 grid grid-cols-3 gap-3 max-sm:grid-cols-1">
        <MetricCard label="Connected wallet" value={shortAccount(wallet.accountHash)} sub="Seller identity for uploads and receivable listing" compact />
        <MetricCard label="Face value" value={formatUsd(faceValue.toString())} sub="Real invoices owned by this wallet" />
        <MetricCard label="Advance available" value={formatUsd(advanced.toString())} sub="Unlocks after investor funding and Casper confirmation" good />
      </section>

      <div className="mb-3.5 flex items-center gap-3">
        <h2 className="m-0 text-lg font-bold tracking-tight text-ink">Freelancer actions</h2>
      </div>
      <section className="mb-10 grid grid-cols-3 gap-3 max-sm:grid-cols-1">
        <RoleCard label="Upload" title="Submit a new invoice" desc="Run parser, FX, verification, risk pricing, and prepare a receivable for Casper mint/list.">
          <a href="/seller/upload" className={cn(buttonVariants({ size: "sm" }), "w-fit")}>Upload invoice</a>
        </RoleCard>
        <RoleCard label="Withdrawals" title="Advance withdrawal" desc="After investor funding, withdraw the advanced amount tied to this wallet.">
          <Button variant="outline" size="sm" disabled>Awaiting funded invoices</Button>
        </RoleCard>
        <RoleCard label="Client reminders" title="Hosted Dodo links only" desc="Generate a hosted checkout URL from a repayment-pending invoice and send that link to the client." />
      </section>

      <div className="mb-3.5 flex items-center gap-3">
        <h2 className="m-0 text-lg font-bold tracking-tight text-ink">Uploaded invoices</h2>
      </div>

      {state === "loading" ? (
        <EmptyState><p className="text-ink">Loading invoices...</p></EmptyState>
      ) : null}
      {state === "error" ? (
        <EmptyState>
          <p className="text-ink">Could not load invoices</p>
          <p className="m-0 text-xs text-bad">{error}</p>
        </EmptyState>
      ) : null}
      {state === "ready" && invoices.length === 0 ? (
        <EmptyState>
          <p className="text-lg font-bold tracking-tight text-ink">No invoices yet.</p>
          <p className="m-0 text-xs leading-relaxed text-ink-muted">Clean slate. Upload a real invoice from this connected Casper account to begin.</p>
          <a href="/seller/upload" className={cn(buttonVariants({ size: "sm" }), "w-fit")}>Upload invoice</a>
        </EmptyState>
      ) : null}

      {invoices.length > 0 ? (
        <section className="grid gap-1.5">
          {invoices.map((invoice) => (
            <article
              key={invoice.id}
              className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.9fr_60px] items-center gap-3.5 rounded-[10px] border border-line bg-panel px-4 py-3.5 transition-colors hover:border-ink-muted-2 hover:bg-panel-elevated max-sm:grid-cols-1"
            >
              <div>
                <strong className="text-ink">{invoice.title ?? invoice.id}</strong>
                <br />
                <span className="text-xs text-ink-muted">Due {invoice.dueDate ?? "not set"}</span>
              </div>
              <div className="font-semibold tabular-nums text-ink">{formatUsd(invoice.usdAmountCents ?? invoice.repaymentAmountUsdCents)}</div>
              <div className="font-semibold tabular-nums text-ink">{formatUsd(invoice.advanceAmountUsdCents ?? "0")}</div>
              <div><StatusPill status={invoice.statusCasper} /></div>
              <div>
                <a href={`/invoice/${invoice.id}`} className={cn(buttonVariants({ variant: "outline", size: "xs" }))}>Review</a>
              </div>
              {invoice.statusCasper === "RepaymentPending" ? (
                <div className="col-span-full border-t border-line-subtle pt-3.5">
                  <HostedPaymentLinkActions invoiceId={invoice.id} />
                </div>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}
    </>
  );
}

function MetricCard({ label, value, sub, good, compact }: { label: string; value: string; sub: string; good?: boolean; compact?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[10px] border border-line bg-panel px-6 py-[22px]">
      <div className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">{label}</div>
      <div className={`font-extrabold tracking-[-0.03em] tabular-nums ${compact ? "break-all text-lg" : "text-[26px]"} ${good ? "text-good" : "text-ink"}`}>
        {value}
      </div>
      <div className="mt-0.5 text-xs text-ink-muted-2">{sub}</div>
    </div>
  );
}

function RoleCard({ label, title, desc, children }: { label: string; title: string; desc: string; children?: React.ReactNode }) {
  return (
    <div className="grid gap-2.5 rounded-[10px] border border-line bg-[rgba(17,17,22,0.72)] p-5 transition-all hover:-translate-y-0.5 hover:border-[rgba(183,255,90,0.36)] hover:bg-[rgba(24,24,28,0.92)]">
      <span className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">{label}</span>
      <h3 className="m-0 text-lg font-bold tracking-[-0.02em] text-ink">{title}</h3>
      <p className="m-0 text-[13px] leading-[1.55] text-ink-muted">{desc}</p>
      {children}
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <section className="grid gap-4 rounded-[10px] border border-line bg-gradient-to-b from-[rgba(24,24,28,0.96)] to-[rgba(17,17,22,0.96)] p-[22px]">
      {children}
    </section>
  );
}

export function useInvoices(role: "seller" | "investor", account: string) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [invoices, setInvoices] = useState<ReceivableView[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      setError("");
      try {
        const response = await fetch(`/api/invoices?role=${role}&account=${encodeURIComponent(account)}`, { cache: "no-store" });
        const body = (await response.json()) as { invoices?: ReceivableView[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? "Unable to load invoices");
        if (!cancelled) {
          setInvoices(body.invoices ?? []);
          setState("ready");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load invoices");
          setState("error");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [account, role]);

  return { invoices, state, error };
}
