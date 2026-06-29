import { CheckoutButton } from "../../../../components/checkout-button";
import { StatusPill } from "../../../../components/status-pill";
import { formatUsd } from "../../../../lib/finance";
import { getPaymentRuntime } from "../../../../server/payment-runtime";

export default async function BuyerPayPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const { paymentStore } = await getPaymentRuntime();
  const invoice = await paymentStore.requireInvoice(invoiceId).catch(() => undefined);
  if (!invoice) {
    return <div className="panel">Invoice not found.</div>;
  }

  return (
    <>
      <div className="sectionTitle"><h2>Client payment link</h2><StatusPill status={invoice.statusCasper} /></div>
      <section className="detailGrid">
        <div className="panel kv">
          <div><span>Invoice reference</span><strong>{invoice.id}</strong></div>
          <div><span>Amount due</span><strong>{formatUsd(invoice.repaymentAmountUsdCents)}</strong></div>
          <div><span>Seller wallet</span><strong>{invoice.sellerAccount ?? "verified seller"}</strong></div>
          <div><span>Wallet required</span><strong>No</strong></div>
          <div><span>Payment state source</span><strong>Backend + Casper only</strong></div>
        </div>
        <div className="panel">
          <span className="label">Dodo hosted checkout</span>
          <h3>Pay this invoice in fiat test mode.</h3>
          <p className="fineprint">
            This page is for the client, so it never asks for a Casper wallet. A successful redirect is still only pending
            until the signed Dodo webhook is verified and the relayer records repayment on Casper.
          </p>
          {invoice.statusCasper === "RepaymentPending" ? <CheckoutButton invoiceId={invoice.id} /> : <p>Checkout opens only when Casper status is RepaymentPending.</p>}
        </div>
      </section>
    </>
  );
}
