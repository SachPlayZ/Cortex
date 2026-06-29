import { PaymentReturnStatus } from "../../../components/payment-return-status";

export default async function CheckoutSuccessPage({
  searchParams
}: {
  searchParams: Promise<{ invoice_id?: string }>;
}) {
  const { invoice_id: invoiceId } = await searchParams;
  if (!invoiceId) {
    return (
      <section className="mx-auto grid max-w-[640px] place-items-center content-center gap-4 text-center" style={{ minHeight: "58dvh" }}>
        <div
          className="size-[76px] rounded-full"
          style={{
            border: "3px solid rgba(255,255,255,0.12)",
            borderTopColor: "var(--c-accent-2)",
            animation: "spin 0.8s linear infinite"
          }}
        />
        <h1 className="m-0 text-[clamp(34px,5vw,64px)] font-extrabold leading-[0.98] tracking-[-0.055em] text-ink">
          Waiting for payment confirmation
        </h1>
        <p className="m-0 leading-relaxed text-ink-muted">
          Dodo returned without an invoice reference. Keep this page open while Cortex waits for the webhook.
        </p>
      </section>
    );
  }

  return <PaymentReturnStatus invoiceId={invoiceId} />;
}
