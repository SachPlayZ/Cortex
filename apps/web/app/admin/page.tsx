export default function AdminPage() {
  return (
    <>
      <div className="sectionTitle"><h2>Admin Runbook</h2></div>
      <section className="detailGrid">
        <div className="panel">
          <h3>Required checks</h3>
          <div className="trace">
            {[".env ignored, no private keys committed", "Dodo webhook uses raw body verification", "Payment ID and gateway hash idempotency enforced", "Return URL cannot mark repaid", "Casper status wins over backend cache"].map((item) => <div className="traceItem" key={item}>{item}</div>)}
          </div>
        </div>
        <div className="panel">
          <h3>Commands</h3>
          <p className="mono">pnpm install</p>
          <p className="mono">pnpm lint && pnpm test && pnpm build</p>
          <p className="mono">cargo odra test -b casper</p>
          <p className="mono">pnpm dev</p>
        </div>
      </section>
    </>
  );
}
