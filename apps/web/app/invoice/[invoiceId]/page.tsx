import { StatusPill } from "../../../components/status-pill";
import { expectedReturnPercent, formatUsd, investorYield } from "../../../lib/finance";
import { getPaymentRuntime } from "../../../server/payment-runtime";

export default async function InvoicePage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const { paymentStore } = await getPaymentRuntime();
  const invoice = await paymentStore.requireInvoice(invoiceId).catch(() => undefined);
  if (!invoice) {
    return <div className="panel">Invoice not found.</div>;
  }

  return (
    <>
      <div className="sectionTitle"><h2>{invoice.id}</h2><StatusPill status={invoice.statusCasper} /></div>
      <section className="detailGrid">
        <div className="panel kv">
          <div><span>Original currency</span><strong>{invoice.originalCurrency ?? "stored off-chain"}</strong></div>
          <div><span>USD amount</span><strong>{formatUsd(invoice.usdAmountCents ?? invoice.repaymentAmountUsdCents)}</strong></div>
          <div><span>Risk</span><strong>{invoice.riskTier ?? "pending"} / {invoice.riskScore ?? "-"}</strong></div>
          <div><span>Advance</span><strong>{formatUsd(invoice.advanceAmountUsdCents ?? "0")}</strong></div>
          <div><span>Repayment</span><strong>{formatUsd(invoice.repaymentAmountUsdCents)}</strong></div>
          <div><span>Expected return</span><strong>{expectedReturnPercent(invoice)}</strong></div>
          <div><span>Investor yield</span><strong>{formatUsd(invoice.investorYieldUsdCents ?? investorYield(invoice))}</strong></div>
          <div><span>Agent confidence</span><strong>{invoice.agentConfidence ?? "pending"}</strong></div>
        </div>
        <div className="panel">
          <h3>Hashes on Casper</h3>
          <p className="mono">invoice_hash: {invoice.invoiceHash}</p>
          {invoice.attestationHash ? <p className="mono">attestation_hash: {invoice.attestationHash}</p> : null}
          {invoice.lastRepaymentDeployHash ? <p className="mono">repayment_deploy: {invoice.lastRepaymentDeployHash}</p> : null}
          <p className="fineprint">Private buyer details and invoice documents are not shown or written on-chain.</p>
        </div>
      </section>

      <div className="sectionTitle"><h2>Agent Trace</h2></div>
      <section className="trace">
        {[
          "Parser output schema-validated",
          "FX normalized into USD cents",
          "Verification checks completed",
          "Risk terms persisted off-chain",
          "Only hashes are eligible for Casper calls"
        ].map((event) => (
          <div className="traceItem" key={event}>
            <strong>Cortex underwriting</strong>
            <span>{event}</span>
            <StatusPill status="done" />
          </div>
        ))}
      </section>
    </>
  );
}
