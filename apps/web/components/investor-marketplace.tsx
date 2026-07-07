"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRightIcon, ChartNoAxesCombinedIcon, LandmarkIcon, TimerIcon, WalletCardsIcon } from "lucide-react";
import { aprEquivalent, expectedReturnPercent, formatUsd, investorYield, type ReceivableView } from "../lib/finance";
import { WalletGate, shortAccount, useCasperWallet } from "./casper-wallet";
import { PageShell } from "./page-shell";
import { StatusPill } from "./status-pill";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";
import { buttonVariants } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
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
    <PageShell
      eyebrow={`Investor wallet ${shortAccount(wallet.accountHash)}`}
      title="Receivables market with the math up front."
      description="Fund one listed invoice at a time, then wait for Dodo webhook settlement before claiming on Casper."
    >
      <section className="grid gap-4 md:grid-cols-3">
        <Metric icon={WalletCardsIcon} label="Committed" value={formatUsd(committed.toString())} sub="Funding signed by this wallet" />
        <Metric icon={ChartNoAxesCombinedIcon} label="Expected yield" value={formatUsd(expectedYield.toString())} sub="Unlocked after verified repayment" active />
        <Metric icon={LandmarkIcon} label="Open listings" value={String(marketplace.invoices.length)} sub="Receivables currently listed" />
      </section>

      <Tabs defaultValue="market" className="gap-6">
        <TabsList>
          <TabsTrigger value="market">Market</TabsTrigger>
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
        </TabsList>

        <TabsContent value="market" id="marketplace" className="scroll-mt-28">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="m-0 text-2xl font-semibold tracking-normal text-foreground">Available receivables</h2>
              <p className="m-0 mt-2 text-sm text-muted-foreground">Only scored and listed invoices appear here.</p>
            </div>
            <Badge variant="secondary">{marketplace.invoices.length} live</Badge>
          </div>
          <ReceivableState
            state={marketplace.state}
            error={marketplace.error}
            isEmpty={marketplace.invoices.length === 0}
            emptyTitle="No listed receivables yet"
            emptyBody="Seller uploads and Casper listings will appear here when ready."
          />
          {marketplace.invoices.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {marketplace.invoices.map((invoice) => (
                <MarketCard key={invoice.id} invoice={invoice} />
              ))}
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="portfolio">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="m-0 text-2xl font-semibold tracking-normal text-foreground">Current portfolio</h2>
              <p className="m-0 mt-2 text-sm text-muted-foreground">Claim actions unlock only after Casper records repayment.</p>
            </div>
            <Badge variant="secondary">{portfolio.invoices.length} positions</Badge>
          </div>
          <ReceivableState
            state={portfolio.state}
            error={portfolio.error}
            isEmpty={portfolio.invoices.length === 0}
            emptyTitle="No funded invoices for this wallet yet"
            emptyBody="Fund a listed receivable to add it to this portfolio."
          />
          {portfolio.invoices.length > 0 ? <PortfolioTable invoices={portfolio.invoices} /> : null}
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function Metric({
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

function MarketCard({ invoice }: { invoice: ReceivableView }) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-white/10 bg-card/72 transition-colors hover:bg-card">
      <div className="relative h-44 overflow-hidden">
        <img
          src={`https://picsum.photos/seed/${encodeURIComponent(invoice.id)}/1000/520`}
          alt=""
          className="absolute inset-0 size-full object-cover opacity-55 grayscale contrast-125 transition-transform duration-700 ease-out group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,11,15,0.1),rgba(8,11,15,0.9))]" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5">
          <div className="min-w-0">
            <Badge variant="secondary">{invoice.riskTier ? `${invoice.riskTier} risk` : "Receivable"}</Badge>
            <h3 className="mt-3 truncate text-2xl font-semibold tracking-normal text-foreground">{invoice.title ?? invoice.id}</h3>
          </div>
          <StatusPill status={invoice.statusCasper} />
        </div>
      </div>
      <div className="grid gap-4 p-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <NumberStat label="Fund" value={formatUsd(invoice.advanceAmountUsdCents ?? "0")} />
          <NumberStat label="Receive" value={formatUsd(invoice.repaymentAmountUsdCents)} />
          <NumberStat label="Yield" value={formatUsd(invoice.investorYieldUsdCents ?? investorYield(invoice))} />
          <NumberStat label="APR display" value={aprEquivalent(invoice)} />
        </div>
        <p className="m-0 text-sm leading-6 text-muted-foreground">
          Risk {invoice.riskTier ?? "pending"} / {invoice.riskScore ?? "-"}. Due {invoice.dueDate ?? "not set"}.
          Agent confidence {invoice.agentConfidence ? `${(invoice.agentConfidence * 100).toFixed(0)}%` : "pending"}.
        </p>
        <a href={`/invoice/${invoice.id}`} className={cn(buttonVariants({ size: "sm" }), "w-fit")}>
          Inspect and fund
          <ArrowRightIcon data-icon="inline-end" />
        </a>
      </div>
    </article>
  );
}

function PortfolioTable({ invoices }: { invoices: ReceivableView[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-card/72">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Funded</TableHead>
            <TableHead>Yield</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell>
                <a href={`/invoice/${invoice.id}`} className="font-semibold text-foreground hover:text-primary">
                  {invoice.title ?? invoice.id}
                </a>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <TimerIcon />
                  Due {invoice.dueDate ?? "not set"}
                </div>
              </TableCell>
              <TableCell className="tabular-nums">{formatUsd(invoice.advanceAmountUsdCents ?? "0")}</TableCell>
              <TableCell className="tabular-nums">{formatUsd(invoice.investorYieldUsdCents ?? investorYield(invoice))}</TableCell>
              <TableCell><StatusPill status={invoice.statusCasper} /></TableCell>
              <TableCell>{portfolioActionLabel(invoice.statusCasper)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ReceivableState({
  state,
  error,
  isEmpty,
  emptyTitle,
  emptyBody
}: {
  state: "loading" | "ready" | "error";
  error: string;
  isEmpty: boolean;
  emptyTitle: string;
  emptyBody: string;
}) {
  if (state === "loading") {
    return (
      <div className="mb-6 grid gap-3">
        {[0, 1].map((item) => (
          <Skeleton key={item} className="h-48 rounded-2xl" />
        ))}
      </div>
    );
  }
  if (state === "error") {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertTitle>Receivables unavailable</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (!isEmpty) return null;

  return (
    <div className="mb-6 rounded-2xl border border-white/10 bg-card/72 p-6">
      <h3 className="m-0 text-2xl font-semibold tracking-normal text-foreground">{emptyTitle}</h3>
      <p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{emptyBody}</p>
    </div>
  );
}

function NumberStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <strong className="mt-1 block truncate font-semibold tabular-nums text-foreground">{value}</strong>
    </div>
  );
}

function portfolioActionLabel(status: string) {
  switch (status) {
    case "Funded":
      return "Await seller cash out";
    case "RepaymentPending":
      return "Await buyer repayment";
    case "Repaid":
      return "Claim now";
    case "Settled":
      return "Settled";
    default:
      return "Open";
  }
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
