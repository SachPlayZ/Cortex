import { LifecycleActions } from "../../../components/lifecycle-actions";
import { StatusPill } from "../../../components/status-pill";
import { expectedReturnPercent, formatUsd, getDemoInvoice } from "../../../lib/demo-data";

export default async function InvoicePage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const invoice = getDemoInvoice(invoiceId);
  if (!invoice) {
    return <div className="panel">Invoice not found.</div>;
  }

  return (
    <>
      <div className="sectionTitle"><h2>{invoice.id}</h2><StatusPill status={invoice.statusCasper} /></div>
      <section className="detailGrid">
        <div className="panel kv">
          <div><span>Original</span><strong>{invoice.originalCurrency} {invoice.originalAmount}</strong></div>
          <div><span>USD amount</span><strong>{formatUsd(invoice.usdAmountCents)}</strong></div>
          <div><span>FX</span><strong>{invoice.fxRate} via {invoice.fxProvider}</strong></div>
          <div><span>Risk</span><strong>{invoice.riskTier} / {invoice.riskScore}</strong></div>
          <div><span>Advance</span><strong>{formatUsd(invoice.advanceAmountUsdCents)}</strong></div>
          <div><span>Repayment</span><strong>{formatUsd(invoice.repaymentAmountUsdCents)}</strong></div>
          <div><span>Expected return</span><strong>{expectedReturnPercent(invoice)}</strong></div>
          <div><span>Agent confidence</span><strong>{invoice.agentConfidence}</strong></div>
        </div>
        <div className="panel">
          <h3>Hashes on Casper</h3>
          <p className="mono">invoice_hash: {invoice.invoiceHash}</p>
          <p className="mono">buyer_hash: {invoice.buyerHash}</p>
          <p className="mono">attestation_hash: {invoice.attestationHash}</p>
          <h3>Deploy hashes</h3>
          {invoice.txHashes.length === 0 ? <p className="fineprint">No deploy: invoice rejected before listing.</p> : null}
          {invoice.txHashes.map((tx) => (
            <p className="mono" key={tx.label}>{tx.label}: {tx.hash}<br />{tx.note ? <span className="fineprint">{tx.note}</span> : null}</p>
          ))}
          {invoice.riskTier !== "Rejected" ? <LifecycleActions invoiceId={invoice.id} /> : null}
        </div>
      </section>

      <div className="sectionTitle"><h2>Agent Trace</h2></div>
      <section className="trace">
        {invoice.trace.map((item) => (
          <div className="traceItem" key={`${item.actor}-${item.event}`}>
            <strong>{item.actor}</strong>
            <span>{item.event}</span>
            <StatusPill status={item.status} />
          </div>
        ))}
      </section>
    </>
  );
}
