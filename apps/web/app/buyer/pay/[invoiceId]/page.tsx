import { CreditCardIcon, LockKeyholeIcon } from "lucide-react";
import { CheckoutButton } from "../../../../components/checkout-button";
import { PageShell } from "../../../../components/page-shell";
import { StatusPill } from "../../../../components/status-pill";
import { Badge } from "../../../../components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "../../../../components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../../../../components/ui/empty";
import { formatUsd } from "../../../../lib/finance";
import { CasperLifecycleService } from "../../../../server/integrations/casper-lifecycle";
import { getPaymentRuntime } from "../../../../server/payment-runtime";

export const metadata = { title: "Pay invoice | Cortex" };

export default async function BuyerPayPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const { paymentStore } = await getPaymentRuntime();
  let chainVerified = true;
  const chainInvoice = await new CasperLifecycleService().reconcileInvoice(invoiceId).catch(() => {
    chainVerified = false;
    return undefined;
  });
  const invoice = chainInvoice ?? (await paymentStore.requireInvoice(invoiceId).catch(() => undefined));
  if (!invoice) {
    return (
      <PageShell title="Invoice not found" description="This payment link does not match a receivable record.">
        <Empty className="border"><EmptyHeader><EmptyMedia variant="icon"><CreditCardIcon /></EmptyMedia><EmptyTitle>Invoice not found</EmptyTitle><EmptyDescription>This payment link does not match a receivable record.</EmptyDescription></EmptyHeader></Empty>
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
      {!chainVerified ? (
        <Alert variant="destructive">
          <AlertTitle>Casper sync unavailable</AlertTitle>
          <AlertDescription>Showing cached invoice data. Checkout stays disabled until Casper state is verified.</AlertDescription>
        </Alert>
      ) : null}
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <span className="mb-3 grid size-10 place-items-center overflow-hidden rounded-lg bg-muted">
              <img src="/android-chrome-512x512.png" alt="Cortex Logo" className="size-full object-cover" />
            </span>
            <CardTitle className="text-3xl tracking-normal">{formatUsd(invoice.repaymentAmountUsdCents)}</CardTitle>
            <CardDescription>Amount due for this receivable.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {kvRows.map(([label, val]) => (
              <div key={label} className="flex justify-between gap-4 rounded-lg border border-border bg-muted/50 p-3">
                <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
                <strong className="min-w-0 break-all text-right text-sm text-foreground">{val}</strong>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CreditCardIcon className="text-primary" />
            <CardTitle className="text-3xl tracking-normal">Dodo Test Mode</CardTitle>
            <CardDescription>Hosted checkout creates the payment. The webhook creates proof.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <Alert><LockKeyholeIcon /><AlertTitle>Success redirect is not payment proof</AlertTitle><AlertDescription>Cortex waits for signature verification, metadata and amount matching, replay protection, and Casper repayment submission.</AlertDescription></Alert>
            {chainVerified && invoice.statusCasper === "RepaymentPending" ? (
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
