export default function SellerUploadPage() {
  return (
    <>
      <div className="sectionTitle"><h2>Seller Upload Flow</h2></div>
      <section className="detailGrid">
        <div className="panel">
          <h3>Sample upload</h3>
          <p className="lead">Use `samples/invoices/low-risk-inr.txt` for the main demo path.</p>
          <a className="primary" href="/invoice/crd-inr-live-001">Review generated terms</a>
        </div>
        <div className="panel trace">
          {["File uploaded", "Invoice hash generated", "Parser result schema validated", "FX conversion stored with timestamp", "Verification checks complete", "Risk terms generated", "Seller mints/lists receivable"].map((step) => <div className="traceItem" key={step}>{step}</div>)}
        </div>
      </section>
    </>
  );
}
