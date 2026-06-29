import { PaymentReturnStatus } from "../../../components/payment-return-status";

export default async function CheckoutSuccessPage({
  searchParams
}: {
  searchParams: Promise<{ invoice_id?: string }>;
}) {
  const { invoice_id: invoiceId } = await searchParams;
  if (!invoiceId) {
    return (
      <section className="paymentResult">
        <div className="statusIcon spinner" />
        <h1>Waiting for payment confirmation</h1>
        <p>Dodo returned without an invoice reference. Keep this page open while Cortex waits for the webhook.</p>
      </section>
    );
  }

  return <PaymentReturnStatus invoiceId={invoiceId} />;
}
