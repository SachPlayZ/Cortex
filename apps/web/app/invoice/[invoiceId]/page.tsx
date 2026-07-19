import { BrainCircuitIcon, FingerprintIcon, ShieldCheckIcon } from "lucide-react";
import { InvoiceLifecyclePanel } from "../../../components/invoice-lifecycle-panel";
import { PageShell } from "../../../components/page-shell";
import { StatusPill } from "../../../components/status-pill";
import { Badge } from "../../../components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "../../../components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../../../components/ui/empty";
import { Separator } from "../../../components/ui/separator";
import { expectedReturnPercent, formatUsd, investorYield } from "../../../lib/finance";
import { CasperLifecycleService } from "../../../server/integrations/casper-lifecycle";
import { getPaymentRuntime } from "../../../server/payment-runtime";

export const metadata = { title: "Invoice detail | Cortex" };

export default async function InvoicePage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const { paymentStore } = await getPaymentRuntime();
  const service = new CasperLifecycleService();
  let chainVerified = true;
  const chainInvoice = await service.reconcileInvoice(invoiceId).catch(() => {
    chainVerified = false;
    return undefined;
  });
  const invoice = chainInvoice ?? (await paymentStore.requireInvoice(invoiceId).catch(() => undefined));
  if (!invoice) {
    return (
      <PageShell title="Invoice not found" description="No local or Casper-backed receivable matched this reference.">
        <Empty className="border"><EmptyHeader><EmptyMedia variant="icon"><FingerprintIcon /></EmptyMedia><EmptyTitle>Invoice not found</EmptyTitle><EmptyDescription>No local or Casper-backed record matched this reference.</EmptyDescription></EmptyHeader></Empty>
      </PageShell>
    );
  }

  const kvRows = [
    ["Original currency", invoice.originalCurrency ?? "stored off-chain"],
    ["USD amount", formatUsd(invoice.usdAmountCents ?? invoice.repaymentAmountUsdCents)],
    ["Risk", `${invoice.riskTier ?? "pending"} / ${invoice.riskScore ?? "-"}`],
    ["Advance", formatUsd(invoice.advanceAmountUsdCents ?? "0")],
    ["Repayment", formatUsd(invoice.repaymentAmountUsdCents)],
    ["Expected return", expectedReturnPercent(invoice)],
    ["Investor yield", formatUsd(invoice.investorYieldUsdCents ?? investorYield(invoice))],
    ["Agent confidence", invoice.agentConfidence ? `${(invoice.agentConfidence * 100).toFixed(0)}%` : "pending"]
  ];

  const rejected = invoice.statusCasper === "Rejected";
  const traceSteps: Array<[string, string]> = [
    ["Parser output schema-validated", "done"],
    ["FX normalized into USD cents", invoice.usdAmountCents ? "done" : "pending"],
    ["Verification checks completed", rejected ? "Rejected" : "done"],
    ["Risk priced and attestation hash persisted", rejected ? "skipped" : invoice.attestationHash ? "done" : "pending"],
    ["Receivable minted on Casper", rejected ? "skipped" : invoice.casperInvoiceExists ? "done" : "pending"],
    ["Risk score posted on-chain", rejected ? "skipped" : invoice.scoreDeployHash ? "done" : "pending"]
  ];

  return (
    <PageShell
      eyebrow="Receivable detail"
      title={invoice.title ?? invoice.id}
      description="Inspect financial terms, private-data boundaries, agent trace, and every Casper transition attached to this invoice."
      action={<StatusPill status={invoice.statusCasper} />}
    >
      {!chainVerified ? (
        <Alert variant="destructive">
          <AlertTitle>Casper sync unavailable</AlertTitle>
          <AlertDescription>Showing cached data. Financial actions will fail closed until Casper can be verified.</AlertDescription>
        </Alert>
      ) : null}
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <ShieldCheckIcon className="text-primary" />
            <CardTitle className="text-3xl tracking-normal">Terms</CardTitle>
            <CardDescription>All monetary values are displayed from integer cents.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {kvRows.map(([label, val]) => (
              <div key={label} className="flex justify-between gap-4 rounded-lg border border-border bg-muted/50 p-3">
                <span className="text-sm text-muted-foreground">{label}</span>
                <strong className="min-w-0 break-all text-right text-sm text-foreground">{val}</strong>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <FingerprintIcon className="text-primary" />
            <CardTitle className="text-3xl tracking-normal">Hashes and deploys</CardTitle>
            <CardDescription>Private buyer data stays off-chain. Casper receives hashes and financial fields.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <HashLine label="invoice_hash" value={invoice.invoiceHash} />
            {invoice.attestationHash ? <HashLine label="attestation_hash" value={invoice.attestationHash} /> : null}
            {invoice.lastRepaymentDeployHash ? <HashLine label="repayment_deploy" value={invoice.lastRepaymentDeployHash} /> : null}
            <Separator />
            {(
              [
                ["create_deploy", invoice.createDeployHash],
                ["score_deploy", invoice.scoreDeployHash],
                ["list_deploy", invoice.listDeployHash],
                ["fund_deploy", invoice.fundDeployHash],
                ["cashout_deploy", invoice.cashoutDeployHash],
                ["claim_deploy", invoice.claimDeployHash]
              ] as const
            )
              .filter(([, hash]) => Boolean(hash))
              .map(([label, hash]) => (
                <HashLine key={label} label={label} value={hash ?? ""} />
              ))}
            <Badge variant="secondary" className="w-fit">No raw invoice PDF on-chain</Badge>
          </CardContent>
        </Card>
      </section>

      <InvoiceLifecyclePanel invoice={invoice} />

      <Card>
        <CardHeader>
          <BrainCircuitIcon className="text-primary" />
          <CardTitle className="text-3xl tracking-normal">Agent trace</CardTitle>
          <CardDescription>Concrete outputs, not decorative AI status text.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {traceSteps.map(([event, stepStatus], index) => (
            <div key={event} className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/50 p-3">
              <div className="flex min-w-0 items-center gap-3">
                <Badge variant="outline">{index + 1}</Badge>
                <span className="truncate text-sm text-foreground">{event}</span>
              </div>
              <StatusPill status={stepStatus} />
            </div>
          ))}
        </CardContent>
      </Card>
    </PageShell>
  );
}

function HashLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-lg border border-border bg-muted/50 p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="break-all font-mono text-xs leading-5 text-foreground">{value}</span>
    </div>
  );
}
