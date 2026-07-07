import { CreditCardIcon, LockKeyholeIcon, ReceiptTextIcon } from "lucide-react";
import { CheckoutButton } from "../../../../components/checkout-button";
import { PageShell } from "../../../../components/page-shell";
import { StatusPill } from "../../../../components/status-pill";
import { Badge } from "../../../../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { formatUsd } from "../../../../lib/finance";
import { CasperLifecycleService } from "../../../../server/integrations/casper-lifecycle";
import { getPaymentRuntime } from "../../../../server/payment-runtime";

export const metadata = { title: "Pay invoice | Cortex" };

export default async function BuyerPayPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const { paymentStore } = await getPaymentRuntime();
  const invoice =
    (await new CasperLifecycleService().reconcileInvoice(invoiceId).catch(() => undefined)) ??
    (await paymentStore.requireInvoice(invoiceId).catch(() => undefined));
  if (!invoice) {
    return (
      <PageShell title="Invoice not found" description="This payment link does not match a receivable record.">
        <Card className="rounded-2xl border-white/10 bg-card/72">
          <CardContent>Invoice not found.</CardContent>
        </Card>
      </PageShell>
    );
  }

  const kvRows = [
    ["Invoice reference", invoice.id],
    ["Amount due", formatUsd(invoice.repaymentAmountUsdCents)],
    ["Seller wallet", invoice.sellerAccount ?? "verified seller"],
    ["Wallet required", "No"],
    ["Payment state source", "Backend + Casper only"]
  ];

  return (
    <PageShell
      eyebrow="Client payment"
      title="Pay the invoice through hosted Dodo checkout."
      description="This page never asks the buyer for a Casper wallet. Payment still remains pending until Cortex receives the signed webhook and records settlement on Casper."
      action={<StatusPill status={invoice.statusCasper} />}
    >
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-2xl border-white/10 bg-card/72">
          <CardHeader>
            <ReceiptTextIcon className="text-primary" />
            <CardTitle className="text-3xl tracking-normal">{formatUsd(invoice.repaymentAmountUsdCents)}</CardTitle>
            <CardDescription>Amount due for this receivable.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {kvRows.map(([label, val]) => (
              <div key={label} className="flex justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.035] p-3">
                <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
                <strong className="min-w-0 break-all text-right text-sm text-foreground">{val}</strong>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden rounded-2xl border-white/10 bg-background/54">
          <div className="absolute inset-0 -z-10">
            <img
              src={`https://picsum.photos/seed/${encodeURIComponent(invoice.id)}-checkout/1200/900`}
              alt=""
              className="size-full object-cover opacity-30 grayscale contrast-125"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,11,15,0.35),rgba(8,11,15,0.92))]" />
          </div>
          <CardHeader>
            <CreditCardIcon className="text-primary" />
            <CardTitle className="text-3xl tracking-normal">Dodo Test Mode</CardTitle>
            <CardDescription>Hosted checkout creates the payment. The webhook creates proof.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center gap-3">
                <LockKeyholeIcon className="text-primary" />
                <span className="text-sm font-medium text-foreground">Success redirect is not payment proof.</span>
              </div>
              <p className="m-0 text-sm leading-6 text-muted-foreground">
                Cortex waits for Standard Webhooks verification, metadata match, amount validation, idempotency, and
                Casper repayment submission.
              </p>
            </div>
            {invoice.statusCasper === "RepaymentPending" ? (
              <CheckoutButton invoiceId={invoice.id} />
            ) : (
              <Badge variant="outline" className="w-fit">Checkout opens when Casper status is RepaymentPending</Badge>
            )}
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}
