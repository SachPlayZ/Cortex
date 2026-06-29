import { StatusPill } from "../../components/status-pill";
import { demoInvoices } from "../../lib/demo-data";

export default function SellerPage() {
  return (
    <>
      <div className="sectionTitle"><h2>Seller Console</h2><a className="primary" href="/seller/upload">Upload Invoice</a></div>
      <section className="invoiceList">
        {demoInvoices.filter((invoice) => invoice.sellerAccount.includes("seller-01")).map((invoice) => (
          <a className="invoiceRow" href={`/invoice/${invoice.id}`} key={invoice.id}>
            <div><strong>{invoice.title}</strong><br /><span className="fineprint">{invoice.sampleFile}</span></div>
            <div>Risk {invoice.riskScore}</div>
            <div>Discount {invoice.discountBps} bps</div>
            <div><StatusPill status={invoice.statusCasper} /></div>
            <div>Review</div>
          </a>
        ))}
      </section>
    </>
  );
}
