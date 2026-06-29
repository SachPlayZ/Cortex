export default async function CheckoutCancelPage({
  searchParams
}: {
  searchParams: Promise<{ invoice_id?: string }>;
}) {
  const { invoice_id: invoiceId } = await searchParams;
  const retryHref = invoiceId ? `/buyer/pay/${invoiceId}` : "/";

  return (
    <section className="paymentResult">
      <div className="statusIcon failed">×</div>
      <h1>Payment failed</h1>
      <p>Retry paying by visiting the invoice payment link again.</p>
      <a className="primary" href={retryHref}>Retry paying</a>
    </section>
  );
}
