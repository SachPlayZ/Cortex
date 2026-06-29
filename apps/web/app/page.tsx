import { StatusPill } from "../components/status-pill";
import { demoInvoices, expectedReturnPercent, formatUsd } from "../lib/demo-data";

export default function HomePage() {
  const live = demoInvoices[0]!;
  return (
    <>
      <section className="hero">
        <div>
          <h1>One airtight receivable lifecycle.</h1>
          <p className="lead">Cortex turns invoice evidence into a hashed Casper receivable, funds it with one investor, and records repayment only after a signed Dodo webhook.</p>
        </div>
        <div className="panel">
          <div className="label">Current demo path</div>
          <h2>{live.title}</h2>
          <StatusPill status={live.statusCasper} />
          <p className="fineprint">Ready for buyer Dodo Test Mode checkout. Return URL alone cannot mark paid.</p>
        </div>
      </section>

      <section className="grid">
        <div className="metric"><div className="label">Invoice amount</div><div className="value">{formatUsd(live.usdAmountCents)}</div></div>
        <div className="metric"><div className="label">Advance</div><div className="value">{formatUsd(live.advanceAmountUsdCents)}</div></div>
        <div className="metric"><div className="label">Investor return</div><div className="value">{expectedReturnPercent(live)}</div></div>
      </section>

      <div className="sectionTitle"><h2>Receivables</h2><a className="secondary" href="/seller/upload">Upload</a></div>
      <section className="invoiceList">
        {demoInvoices.map((invoice) => (
          <a className="invoiceRow" href={`/invoice/${invoice.id}`} key={invoice.id}>
            <div><strong>{invoice.id}</strong><br /><span className="fineprint">{invoice.title}</span></div>
            <div>{formatUsd(invoice.usdAmountCents)}</div>
            <div>{invoice.riskTier} / {invoice.riskScore}</div>
            <div><StatusPill status={invoice.statusCasper} /></div>
            <div>Open</div>
          </a>
        ))}
      </section>
    </>
  );
}
