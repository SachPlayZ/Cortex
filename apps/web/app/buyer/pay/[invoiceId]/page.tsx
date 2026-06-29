import { CheckoutButton } from "../../../../components/checkout-button";
import { StatusPill } from "../../../../components/status-pill";
import { formatUsd } from "../../../../lib/finance";
import { getPaymentRuntime } from "../../../../server/payment-runtime";

export default async function BuyerPayPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const { paymentStore } = await getPaymentRuntime();
  const invoice = await paymentStore.requireInvoice(invoiceId).catch(() => undefined);
  if (!invoice) {
    return (
      <div className="rounded-[10px] border border-line bg-gradient-to-b from-[rgba(24,24,28,0.96)] to-[rgba(17,17,22,0.96)] p-[22px] text-ink">
        Invoice not found.
      </div>
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
    <>
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <h2 className="m-0 text-lg font-bold tracking-tight text-ink">Client payment link</h2>
        <StatusPill status={invoice.statusCasper} />
      </div>

      <section className="grid grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-[18px] max-sm:grid-cols-1">
        <div className="grid gap-2.5 rounded-[10px] border border-line bg-gradient-to-b from-[rgba(24,24,28,0.96)] to-[rgba(17,17,22,0.96)] p-[22px]">
          {kvRows.map(([label, val]) => (
            <div key={label} className="flex justify-between gap-4 border-b border-line-subtle pb-2.5">
              <span className="text-ink-muted">{label}</span>
              <strong className="text-ink">{val}</strong>
            </div>
          ))}
        </div>

        <div className="grid content-start gap-3 rounded-[10px] border border-line bg-gradient-to-b from-[rgba(24,24,28,0.96)] to-[rgba(17,17,22,0.96)] p-[22px]">
          <span className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">Dodo hosted checkout</span>
          <h3 className="m-0 text-lg font-bold tracking-[-0.02em] text-ink">Pay this invoice in fiat test mode.</h3>
          <p className="m-0 text-xs leading-relaxed text-ink-muted">
            This page is for the client, so it never asks for a Casper wallet. A successful redirect is still only pending
            until the signed Dodo webhook is verified and the relayer records repayment on Casper.
          </p>
          {invoice.statusCasper === "RepaymentPending" ? (
            <CheckoutButton invoiceId={invoice.id} />
          ) : (
            <p className="m-0 text-sm text-ink-muted">Checkout opens only when Casper status is RepaymentPending.</p>
          )}
        </div>
      </section>
    </>
  );
}
