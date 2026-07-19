"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRightIcon, ChartNoAxesCombinedIcon, LandmarkIcon, ReceiptTextIcon, TimerIcon, WalletCardsIcon } from "lucide-react";
import { aprEquivalent, expectedReturnPercent, formatUsd, investorYield, type ReceivableView } from "../lib/finance";
import { WalletGate, shortAccount, useCasperWallet } from "./casper-wallet";
import { PageShell } from "./page-shell";
import { StatusPill } from "./status-pill";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "./ui/empty";
import { Separator } from "./ui/separator";
import { Skeleton } from "./ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

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
  const committed = useMemo(() => portfolio.invoices.reduce((sum, invoice) => sum + BigInt(invoice.advanceAmountUsdCents ?? "0"), 0n), [portfolio.invoices]);
  const expectedYield = useMemo(() => portfolio.invoices.reduce((sum, invoice) => sum + BigInt(invoice.investorYieldUsdCents ?? investorYield(invoice)), 0n), [portfolio.invoices]);

  return (
    <PageShell
      eyebrow={`Investor wallet ${shortAccount(wallet.accountHash)}`}
      title="Underwrite the return before you fund the claim."
      description="Every listing exposes face value, advance, yield, due date, agent confidence, and the Casper state that makes funding legal."
    >
      <Card>
        <CardHeader>
          <CardTitle>Capital position</CardTitle>
          <CardDescription>Live totals scoped to the connected investor wallet.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-3">
          <SummaryMetric icon={WalletCardsIcon} label="Committed" value={formatUsd(committed.toString())} detail="Signed funding positions" />
          <SummaryMetric icon={ChartNoAxesCombinedIcon} label="Expected yield" value={formatUsd(expectedYield.toString())} detail="After verified repayment" signal />
          <SummaryMetric icon={LandmarkIcon} label="Open listings" value={String(marketplace.invoices.length)} detail="Eligible Casper receivables" />
        </CardContent>
      </Card>

      <Tabs defaultValue="market" className="gap-6">
        <TabsList>
          <TabsTrigger value="market">Market</TabsTrigger>
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
        </TabsList>

        <TabsContent value="market" id="marketplace" className="scroll-mt-24">
          <SectionHeading title="Available receivables" body="Only scored, seller-listed invoices with valid due dates appear here." count={`${marketplace.invoices.length} live`} />
          <ReceivableState state={marketplace.state} error={marketplace.error} isEmpty={marketplace.invoices.length === 0} emptyTitle="No listed receivables" emptyBody="New seller listings will appear after Casper confirms the listing transaction." />
          {marketplace.invoices.length > 0 ? <div className="flex flex-col gap-4">{marketplace.invoices.map((invoice) => <MarketRow key={invoice.id} invoice={invoice} />)}</div> : null}
        </TabsContent>

        <TabsContent value="portfolio">
          <SectionHeading title="Current portfolio" body="Claim becomes available only after verified repayment is recorded on Casper." count={`${portfolio.invoices.length} positions`} />
          <ReceivableState state={portfolio.state} error={portfolio.error} isEmpty={portfolio.invoices.length === 0} emptyTitle="No funded positions" emptyBody="Fund a listed receivable to create the first position for this wallet." />
          {portfolio.invoices.length > 0 ? <PortfolioTable invoices={portfolio.invoices} /> : null}
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function SummaryMetric({ icon: Icon, label, value, detail, signal = false }: { icon: typeof WalletCardsIcon; label: string; value: string; detail: string; signal?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-3"><Icon className={signal ? "text-primary" : "text-muted-foreground"} />{signal ? <Badge>Projected</Badge> : null}</div>
      <div><p className="m-0 text-sm text-muted-foreground">{label}</p><strong className="mt-1 block truncate text-3xl font-semibold tracking-[-0.03em] tabular-nums text-foreground">{value}</strong><p className="m-0 mt-2 text-xs text-muted-foreground">{detail}</p></div>
    </div>
  );
}

function SectionHeading({ title, body, count }: { title: string; body: string; count: string }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h2 className="m-0 text-2xl font-semibold tracking-[-0.02em] text-foreground">{title}</h2><p className="m-0 mt-2 text-sm text-muted-foreground">{body}</p></div>
      <Badge variant="secondary">{count}</Badge>
    </div>
  );
}

function MarketRow({ invoice }: { invoice: ReceivableView }) {
  return (
    <Card>
      <CardHeader className="grid gap-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <div className="grid size-11 place-items-center rounded-lg bg-muted text-primary"><ReceiptTextIcon /></div>
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2"><Badge variant="secondary">{invoice.riskTier ? `${invoice.riskTier} risk` : "Receivable"}</Badge><Badge variant="outline">score {invoice.riskScore ?? "-"}</Badge></div>
          <CardTitle className="truncate text-xl">{invoice.title ?? invoice.id}</CardTitle>
          <CardDescription>Due {invoice.dueDate ?? "not set"} · confidence {invoice.agentConfidence ? `${(invoice.agentConfidence * 100).toFixed(0)}%` : "pending"}</CardDescription>
        </div>
        <StatusPill status={invoice.statusCasper} />
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Separator />
        <div className="grid gap-4 sm:grid-cols-4">
          <NumberStat label="Fund" value={formatUsd(invoice.advanceAmountUsdCents ?? "0")} />
          <NumberStat label="Receive" value={formatUsd(invoice.repaymentAmountUsdCents)} />
          <NumberStat label="Yield" value={formatUsd(invoice.investorYieldUsdCents ?? investorYield(invoice))} />
          <NumberStat label="APR display" value={aprEquivalent(invoice)} />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="m-0 text-sm text-muted-foreground">Expected simple return {expectedReturnPercent(invoice)}. APR is display-only and never enters contract math.</p>
          <Button size="sm" nativeButton={false} render={<a href={`/invoice/${invoice.id}`} />}>
            Inspect and fund
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PortfolioTable({ invoices }: { invoices: ReceivableView[] }) {
  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Funded</TableHead><TableHead>Yield</TableHead><TableHead>Status</TableHead><TableHead>Next action</TableHead></TableRow></TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell><Button variant="link" nativeButton={false} render={<a href={`/invoice/${invoice.id}`} />} className="px-0">{invoice.title ?? invoice.id}</Button><div className="flex items-center gap-1.5 text-xs text-muted-foreground"><TimerIcon />Due {invoice.dueDate ?? "not set"}</div></TableCell>
                <TableCell className="tabular-nums">{formatUsd(invoice.advanceAmountUsdCents ?? "0")}</TableCell>
                <TableCell className="tabular-nums">{formatUsd(invoice.investorYieldUsdCents ?? investorYield(invoice))}</TableCell>
                <TableCell><StatusPill status={invoice.statusCasper} /></TableCell>
                <TableCell>{portfolioActionLabel(invoice.statusCasper)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ReceivableState({ state, error, isEmpty, emptyTitle, emptyBody }: { state: "loading" | "ready" | "error"; error: string; isEmpty: boolean; emptyTitle: string; emptyBody: string }) {
  if (state === "loading") return <div className="mb-6 flex flex-col gap-3">{[0, 1].map((item) => <Card key={item}><CardContent><Skeleton className="h-40" /></CardContent></Card>)}</div>;
  if (state === "error") return <Alert variant="destructive" className="mb-6"><AlertTitle>Receivables unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
  if (!isEmpty) return null;
  return <Empty className="mb-6 border"><EmptyHeader><EmptyMedia variant="icon"><ReceiptTextIcon /></EmptyMedia><EmptyTitle>{emptyTitle}</EmptyTitle><EmptyDescription>{emptyBody}</EmptyDescription></EmptyHeader></Empty>;
}

function NumberStat({ label, value }: { label: string; value: string }) {
  return <div><span className="text-xs text-muted-foreground">{label}</span><strong className="mt-1 block truncate text-lg font-semibold tabular-nums text-foreground">{value}</strong></div>;
}

function portfolioActionLabel(status: string) {
  switch (status) { case "Funded": return "Await seller cash out"; case "RepaymentPending": return "Await buyer repayment"; case "Repaid": return "Claim now"; case "Settled": return "Settled"; default: return "Open"; }
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
      setState("loading"); setError("");
      try {
        const response = await fetch(`/api/invoices?${params.toString()}`, { cache: "no-store" });
        const body = (await response.json()) as { invoices?: ReceivableView[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? "Unable to load receivables");
        if (!cancelled) { setInvoices(body.invoices ?? []); setState("ready"); }
      } catch (err) { if (!cancelled) { setError(err instanceof Error ? err.message : "Unable to load receivables"); setState("error"); } }
    }
    void load();
    return () => { cancelled = true; };
  }, [filter.account, filter.role, filter.status]);

  return { invoices, state, error };
}
