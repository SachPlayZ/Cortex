import { BrainCircuitIcon, CableIcon, DatabaseZapIcon, ShieldCheckIcon } from "lucide-react";
import { PageShell } from "../../components/page-shell";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../../components/ui/empty";
import { Separator } from "../../components/ui/separator";
import { formatUsd } from "../../lib/finance";
import { getPaymentRuntime } from "../../server/payment-runtime";

export const metadata = { title: "Agent operations | Cortex" };
export const dynamic = "force-dynamic";

const traces = [
  ["Parser Agent", "Extracts invoice number, buyer, amount, currency, due date, and terms."],
  ["FX Agent", "Normalizes original currency into USD cents using a timestamped quote."],
  ["Verification Agent", "Checks duplicates, due date, buyer shape, wallet, amount bounds, and schema completeness."],
  ["Risk Agent", "Assigns tier, discount bps, advance, repayment, and investor yield."],
  ["Settlement Monitor", "Waits for verified Dodo webhook and Casper repayment state."]
];

export default async function AgentPage() {
  const runtime = await getPaymentRuntime().catch(() => undefined);
  const invoices = runtime ? await runtime.paymentStore.listInvoices().catch(() => []) : [];
  const events = runtime ? await runtime.paymentStore.listCasperLifecycleEvents(12).catch(() => []) : [];

  return (
    <PageShell
      eyebrow="Agent operations"
      title="Every automated decision stops at a validation boundary."
      description="Inspect what agents extracted, normalized, verified, and hashed before any result can affect a receivable."
    >
      <section className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
        <Card>
          <CardHeader>
            <BrainCircuitIcon className="text-primary" />
            <CardTitle className="text-2xl">Contract input policy</CardTitle>
            <CardDescription>Raw model output never reaches Casper. Every material field passes the same deterministic gate.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {["Zod schemas", "Integer cents", "Basis points", "Canonical hashes", "Private data off-chain"].map((item) => <Badge key={item} variant="secondary"><ShieldCheckIcon data-icon="inline-start" />{item}</Badge>)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Underwriting pipeline</CardTitle>
            <CardDescription>Concrete responsibilities, ordered by the evidence handoff.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-0">
            {traces.map(([title, body], index) => (
              <div key={title}>
                <div className="grid gap-4 py-4 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                  <Badge variant="outline">0{index + 1}</Badge>
                  <div><p className="m-0 font-medium text-foreground">{title}</p><p className="m-0 mt-1 text-sm text-muted-foreground">{body}</p></div>
                  {index === traces.length - 1 ? <CableIcon className="text-primary" /> : <ShieldCheckIcon className="text-muted-foreground" />}
                </div>
                {index < traces.length - 1 ? <Separator /> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Underwritten receivables</CardTitle><CardDescription>Validated outputs persisted by the live pipeline.</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-0">
            {invoices.length ? invoices.slice(0, 6).map((invoice, index) => (
              <div key={invoice.id}>
                <div className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0"><Button variant="link" nativeButton={false} render={<a href={`/invoice/${invoice.id}`} />} className="h-auto max-w-full justify-start truncate px-0">{invoice.title ?? invoice.id}</Button><p className="m-0 text-xs text-muted-foreground">{formatUsd(invoice.repaymentAmountUsdCents)} · {invoice.riskTier ?? "unscored"} · score {invoice.riskScore ?? "-"}</p></div>
                  <Badge variant="secondary">{invoice.statusCasper}</Badge>
                </div>
                {index < Math.min(invoices.length, 6) - 1 ? <Separator /> : null}
              </div>
            )) : <Empty><EmptyHeader><EmptyMedia variant="icon"><BrainCircuitIcon /></EmptyMedia><EmptyTitle>No underwriting runs</EmptyTitle><EmptyDescription>Validated invoice output will appear after the first upload.</EmptyDescription></EmptyHeader></Empty>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Observed Casper events</CardTitle><CardDescription>Latest contract dictionary events parsed by reconciliation.</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-0">
            {events.length ? events.map((event, index) => (
              <div key={event.id}>
                <div className="grid gap-2 py-4 sm:grid-cols-[1fr_auto] sm:items-center"><div className="min-w-0"><p className="m-0 font-medium text-foreground">{event.eventName}</p><p className="m-0 mt-1 truncate font-mono text-xs text-muted-foreground">{event.invoiceId ?? event.actorPublicKey ?? "system event"}</p></div><Badge variant="outline">#{event.eventIndex}</Badge></div>
                {index < events.length - 1 ? <Separator /> : null}
              </div>
            )) : <Empty><EmptyHeader><EmptyMedia variant="icon"><DatabaseZapIcon /></EmptyMedia><EmptyTitle>No indexed events</EmptyTitle><EmptyDescription>Casper lifecycle events will appear after reconciliation.</EmptyDescription></EmptyHeader></Empty>}
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
