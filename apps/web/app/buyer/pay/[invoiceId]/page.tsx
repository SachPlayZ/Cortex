import { CheckoutButton } from "../../../../components/checkout-button";
import { StatusPill } from "../../../../components/status-pill";
import { formatUsd, getDemoInvoice } from "../../../../lib/demo-data";

export default async function BuyerPayPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const invoice = getDemoInvoice(invoiceId);
  if (!invoice) {
    return <div className="panel">Invoice not found.</div>;
  }

  return (
    <>
      <div className="sectionTitle"><h2>Buyer Payment</h2><StatusPill status={invoice.statusCasper} /></div>
      <section className="detailGrid">
        <div className="panel kv">
          <div><span>Invoice reference</span><strong>{invoice.id}</strong></div>
          <div><span>Amount due</span><strong>{formatUsd(invoice.repaymentAmountUsdCents)}</strong></div>
          <div><span>Seller</span><strong>{invoice.seller}</strong></div>
          <div><span>Payment state source</span><strong>Backend + Casper only</strong></div>
        </div>
        <div className="panel">
          {invoice.statusCasper === "RepaymentPending" ? <CheckoutButton invoiceId={invoice.id} /> : <p>Checkout opens only when Casper status is RepaymentPending.</p>}
        </div>
      </section>
    </>
  );
}
