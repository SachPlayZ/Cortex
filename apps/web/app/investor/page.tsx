import { StatusPill } from "../../components/status-pill";
import { demoInvoices, expectedReturnPercent, formatUsd } from "../../lib/demo-data";

export default function InvestorPage() {
  return (
    <>
      <div className="sectionTitle"><h2>Investor Marketplace</h2></div>
      <section className="invoiceList">
        {demoInvoices.filter((invoice) => invoice.riskTier !== "Rejected").map((invoice) => (
          <a className="invoiceRow" href={`/invoice/${invoice.id}`} key={invoice.id}>
            <div><strong>{invoice.id}</strong><br /><span className="fineprint">Due {invoice.dueDate}</span></div>
            <div>{formatUsd(invoice.advanceAmountUsdCents)} advance</div>
            <div>{formatUsd(invoice.investorYieldUsdCents)} yield / {expectedReturnPercent(invoice)}</div>
            <div><StatusPill status={invoice.statusCasper} /></div>
            <div>Fund/claim</div>
          </a>
        ))}
      </section>
    </>
  );
}
