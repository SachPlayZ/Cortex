"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRightIcon, CircleDollarSignIcon, FileUpIcon, LinkIcon, WalletCardsIcon } from "lucide-react";
import { formatUsd, type ReceivableView } from "../lib/finance";
import { WalletGate, shortAccount, useCasperWallet } from "./casper-wallet";
import { HostedPaymentLinkActions } from "./hosted-payment-link-actions";
import { InvoiceLifecyclePanel } from "./invoice-lifecycle-panel";
import { PageShell } from "./page-shell";
import { StatusPill } from "./status-pill";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button, buttonVariants } from "./ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
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
  const advanced = useMemo(
    () =>
      invoices
        .filter((invoice) => invoice.statusCasper === "RepaymentPending" && !invoice.cashoutDeployHash)
        .reduce((sum, invoice) => sum + BigInt(invoice.advanceAmountUsdCents ?? "0"), 0n),
    [invoices]
  );
  const open = invoices.filter((invoice) => !["Settled", "Rejected", "Defaulted", "Cancelled"].includes(invoice.statusCasper)).length;

  return (
    <PageShell
      eyebrow={`Seller wallet ${shortAccount(wallet.accountHash)}`}
      title="Freelancer receivable console"
      description="Upload invoices, inspect agent output, list the receivable on Casper, and send a Dodo checkout link only after investor funding."
      action={
        <a href="/seller/upload" className={cn(buttonVariants({ size: "lg" }), "h-11 px-4")}>
          <FileUpIcon data-icon="inline-start" />
          Upload invoice
        </a>
      }
    >
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={WalletCardsIcon} label="Face value" value={formatUsd(faceValue.toString())} sub="Invoices owned by this wallet" />
        <MetricCard icon={CircleDollarSignIcon} label="Advance available" value={formatUsd(advanced.toString())} sub="Unlocks after funding confirmation" active={advanced > 0n} />
        <MetricCard icon={LinkIcon} label="Open workflows" value={String(open)} sub="Invoices still moving through the lifecycle" />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <ActionPanel
          title="Run underwriting"
          body="Upload PDF, image, or text evidence and let the agent pipeline produce validated terms."
          href="/seller/upload"
          cta="Upload invoice"
        />
        <ActionPanel
          title="Withdraw advance"
          body="Cash out only after the invoice reaches RepaymentPending on Casper and the vault confirms funding."
          onClick={() => document.getElementById("uploaded-invoices")?.scrollIntoView({ behavior: "smooth" })}
          disabled={!invoices.some((invoice) => invoice.statusCasper === "RepaymentPending" && !invoice.cashoutDeployHash)}
          cta="Review funded invoices"
        />
        <ActionPanel
          title="Send Dodo link"
          body="Generate hosted checkout links from repayment-pending invoices. Redirects never mark invoices paid."
          onClick={() => document.getElementById("uploaded-invoices")?.scrollIntoView({ behavior: "smooth" })}
          disabled={!invoices.some((invoice) => invoice.statusCasper === "RepaymentPending")}
          cta="Open payment links"
        />
      </section>

      <section id="uploaded-invoices" className="scroll-mt-28">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="m-0 text-2xl font-semibold tracking-normal text-foreground">Uploaded invoices</h2>
            <p className="m-0 mt-2 text-sm text-muted-foreground">Rows expand into Casper lifecycle and Dodo payment actions when relevant.</p>
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
        {state === "ready" && invoices.length === 0 ? (
          <EmptyState
            title="No invoices yet"
            body="Upload a real invoice from this connected Casper account to begin the demo path."
            action={<a href="/seller/upload" className={cn(buttonVariants({ size: "sm" }))}>Upload invoice</a>}
          />
        ) : null}

        {invoices.length > 0 ? (
          <div className="grid gap-3">
            {invoices.map((invoice) => (
              <article
                key={invoice.id}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-card/72 transition-colors hover:bg-card"
              >
                <a
                  href={`/invoice/${invoice.id}`}
                  className="grid gap-4 p-4 text-inherit md:grid-cols-[1.35fr_0.75fr_0.75fr_0.7fr_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold text-foreground">{invoice.title ?? invoice.id}</div>
                    <div className="mt-1 text-sm text-muted-foreground">Due {invoice.dueDate ?? "not set"}</div>
                  </div>
                  <NumberCell label="Face" value={formatUsd(invoice.usdAmountCents ?? invoice.repaymentAmountUsdCents)} />
                  <NumberCell label="Advance" value={formatUsd(invoice.advanceAmountUsdCents ?? "0")} />
                  <StatusPill status={invoice.statusCasper} />
                  <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}>
                    Review
                    <ArrowRightIcon data-icon="inline-end" />
                  </span>
                </a>
                {invoice.statusCasper === "RepaymentPending" ? (
                  <div className="border-t border-white/10 p-4">
                    <HostedPaymentLinkActions invoiceId={invoice.id} />
                  </div>
                ) : null}
                {(invoice.statusCasper === "Scored" || invoice.statusCasper === "RepaymentPending" || invoice.statusCasper === "Repaid") ? (
                  <div className="border-t border-white/10 p-4">
                    <InvoiceLifecyclePanel invoice={invoice} compact />
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </PageShell>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  active
}: {
  icon: typeof WalletCardsIcon;
  label: string;
  value: string;
  sub: string;
  active?: boolean;
}) {
  return (
    <Card className={cn("rounded-2xl border-white/10 bg-card/72", active && "bg-primary text-primary-foreground")}>
      <CardHeader>
        <div className={cn("mb-4 grid size-10 place-items-center rounded-full border border-white/10 bg-white/[0.035]", active && "bg-primary-foreground/12")}>
          <Icon />
        </div>
        <CardDescription className={active ? "text-primary-foreground/70" : undefined}>{label}</CardDescription>
        <CardTitle className="text-4xl tracking-normal tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("m-0 text-sm leading-6 text-muted-foreground", active && "text-primary-foreground/72")}>{sub}</p>
      </CardContent>
    </Card>
  );
}

function ActionPanel({
  title,
  body,
  cta,
  href,
  onClick,
  disabled
}: {
  title: string;
  body: string;
  cta: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const content = (
    <>
      {cta}
      <ArrowRightIcon data-icon="inline-end" />
    </>
  );

  return (
    <Card className="rounded-2xl border-white/10 bg-background/54">
      <CardHeader>
        <CardTitle className="text-2xl tracking-normal">{title}</CardTitle>
        <CardDescription className="leading-6">{body}</CardDescription>
      </CardHeader>
      <CardFooter>
        {href ? (
          <a href={href} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>{content}</a>
        ) : (
          <Button variant="outline" size="sm" type="button" onClick={onClick} disabled={disabled}>
            {content}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

function NumberCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="truncate font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function InvoiceSkeleton() {
  return (
    <div className="grid gap-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-2xl border border-white/10 bg-card/72 p-4">
          <div className="grid gap-4 md:grid-cols-[1.35fr_0.75fr_0.75fr_0.7fr_auto] md:items-center">
            <Skeleton className="h-12" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-7" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-card/72 p-6">
      <h3 className="m-0 text-2xl font-semibold tracking-normal text-foreground">{title}</h3>
      <p className="m-0 max-w-2xl text-sm leading-6 text-muted-foreground">{body}</p>
      {action ? <div>{action}</div> : null}
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
