"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRightIcon, CircleDollarSignIcon, FileUpIcon, LinkIcon, ReceiptTextIcon, WalletCardsIcon } from "lucide-react";
import { formatUsd, type ReceivableView } from "../lib/finance";
import { WalletGate, shortAccount, useCasperWallet } from "./casper-wallet";
import { HostedPaymentLinkActions } from "./hosted-payment-link-actions";
import { InvoiceLifecyclePanel } from "./invoice-lifecycle-panel";
import { PageShell } from "./page-shell";
import { StatusPill } from "./status-pill";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "./ui/empty";
import { Separator } from "./ui/separator";
import { Skeleton } from "./ui/skeleton";

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
  const advanced = useMemo(
    () => invoices
      .filter((invoice) => invoice.statusCasper === "RepaymentPending" && !invoice.cashoutDeployHash)
      .reduce((sum, invoice) => sum + BigInt(invoice.advanceAmountUsdCents ?? "0"), 0n),
    [invoices]
  );
  const open = invoices.filter((invoice) => !["Settled", "Rejected", "Defaulted", "Cancelled"].includes(invoice.statusCasper)).length;

  return (
    <PageShell
      eyebrow={`Seller wallet ${shortAccount(wallet.accountHash)}`}
      title="Move one invoice from evidence to early liquidity."
      description="Upload, underwrite, list, withdraw, and generate the client payment link from the wallet that owns the receivable."
      action={
        <Button size="lg" nativeButton={false} render={<a href="/seller/upload" />}>
          <FileUpIcon data-icon="inline-start" />
          Upload invoice
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Portfolio at a glance</CardTitle>
          <CardDescription>Contract-backed values for this connected seller wallet.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-3">
          <Metric icon={WalletCardsIcon} label="Face value" value={formatUsd(faceValue.toString())} detail="Across uploaded invoices" />
          <Metric icon={CircleDollarSignIcon} label="Advance available" value={formatUsd(advanced.toString())} detail="Ready after funding" signal={advanced > 0n} />
          <Metric icon={LinkIcon} label="Open workflows" value={String(open)} detail="Still moving on-chain" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Next actions</CardTitle>
          <CardDescription>Cortex exposes only actions that the current lifecycle state can support.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-0">
          <ActionRow
            icon={FileUpIcon}
            title="Run underwriting"
            body="Upload evidence and produce validated risk terms."
            action={<Button variant="outline" size="sm" nativeButton={false} render={<a href="/seller/upload" />}>Upload<ArrowRightIcon data-icon="inline-end" /></Button>}
          />
          <Separator />
          <ActionRow
            icon={CircleDollarSignIcon}
            title="Withdraw funded advance"
            body="Available only after Casper reaches RepaymentPending."
            action={<Button variant="outline" size="sm" disabled={!invoices.some((invoice) => invoice.statusCasper === "RepaymentPending" && !invoice.cashoutDeployHash)} onClick={() => document.getElementById("uploaded-invoices")?.scrollIntoView({ behavior: "smooth" })}>Review<ArrowRightIcon data-icon="inline-end" /></Button>}
          />
          <Separator />
          <ActionRow
            icon={LinkIcon}
            title="Create client payment link"
            body="Hosted Dodo checkout; redirects never mark repayment complete."
            action={<Button variant="outline" size="sm" disabled={!invoices.some((invoice) => invoice.statusCasper === "RepaymentPending")} onClick={() => document.getElementById("uploaded-invoices")?.scrollIntoView({ behavior: "smooth" })}>Open links<ArrowRightIcon data-icon="inline-end" /></Button>}
          />
        </CardContent>
      </Card>

      <section id="uploaded-invoices" className="scroll-mt-24">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="m-0 text-2xl font-semibold tracking-[-0.02em] text-foreground">Your receivables</h2>
            <p className="m-0 mt-2 text-sm text-muted-foreground">Each record expands only when its next financial action becomes available.</p>
          </div>
          <Badge variant="secondary">{invoices.length} total</Badge>
        </div>

        {state === "loading" ? <InvoiceSkeleton /> : null}
        {state === "error" ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load invoices</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {state === "ready" && invoices.length === 0 ? <InvoiceEmpty /> : null}

        {invoices.length > 0 ? (
          <div className="flex flex-col gap-4">
            {invoices.map((invoice) => (
              <Card key={invoice.id}>
                <CardHeader className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-lg">{invoice.title ?? invoice.id}</CardTitle>
                    <CardDescription>Due {invoice.dueDate ?? "not set"}</CardDescription>
                  </div>
                  <StatusPill status={invoice.statusCasper} />
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <MetricValue label="Face value" value={formatUsd(invoice.usdAmountCents ?? invoice.repaymentAmountUsdCents)} />
                    <MetricValue label="Advance" value={formatUsd(invoice.advanceAmountUsdCents ?? "0")} />
                    <Button variant="outline" size="sm" nativeButton={false} render={<a href={`/invoice/${invoice.id}`} />}>
                      Inspect proof
                      <ArrowRightIcon data-icon="inline-end" />
                    </Button>
                  </div>
                  {invoice.statusCasper === "RepaymentPending" ? <><Separator /><HostedPaymentLinkActions invoiceId={invoice.id} /></> : null}
                  {["Scored", "RepaymentPending", "Repaid"].includes(invoice.statusCasper) ? <><Separator /><InvoiceLifecyclePanel invoice={invoice} compact /></> : null}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </section>
    </PageShell>
  );
}

function Metric({ icon: Icon, label, value, detail, signal = false }: { icon: typeof WalletCardsIcon; label: string; value: string; detail: string; signal?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Icon className={signal ? "text-primary" : "text-muted-foreground"} />
        {signal ? <Badge>Available</Badge> : null}
      </div>
      <div>
        <p className="m-0 text-sm text-muted-foreground">{label}</p>
        <strong className="mt-1 block truncate text-3xl font-semibold tracking-[-0.03em] tabular-nums text-foreground">{value}</strong>
        <p className="m-0 mt-2 text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function ActionRow({ icon: Icon, title, body, action }: { icon: typeof FileUpIcon; title: string; body: string; action: React.ReactNode }) {
  return (
    <div className="grid gap-4 py-5 sm:grid-cols-[auto_1fr_auto] sm:items-center">
      <div className="grid size-10 place-items-center rounded-lg bg-muted text-primary"><Icon /></div>
      <div>
        <p className="m-0 font-medium text-foreground">{title}</p>
        <p className="m-0 mt-1 text-sm text-muted-foreground">{body}</p>
      </div>
      {action}
    </div>
  );
}

function MetricValue({ label, value }: { label: string; value: string }) {
  return <div><p className="m-0 text-xs text-muted-foreground">{label}</p><strong className="mt-1 block truncate font-semibold tabular-nums text-foreground">{value}</strong></div>;
}

function InvoiceSkeleton() {
  return <div className="flex flex-col gap-4">{[0, 1, 2].map((item) => <Card key={item}><CardContent><Skeleton className="h-24" /></CardContent></Card>)}</div>;
}

function InvoiceEmpty() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon"><ReceiptTextIcon /></EmptyMedia>
        <EmptyTitle>No invoices yet</EmptyTitle>
        <EmptyDescription>Upload evidence from this seller wallet to begin underwriting.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent><Button nativeButton={false} render={<a href="/seller/upload" />}>Upload invoice<ArrowRightIcon data-icon="inline-end" /></Button></EmptyContent>
    </Empty>
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
        if (!cancelled) { setInvoices(body.invoices ?? []); setState("ready"); }
      } catch (err) {
        if (!cancelled) { setError(err instanceof Error ? err.message : "Unable to load invoices"); setState("error"); }
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [account, role]);

  return { invoices, state, error };
}
