import { buttonVariants } from "../../../components/ui/button";
import { cn } from "@/lib/utils";

export default async function CheckoutCancelPage({
  searchParams
}: {
  searchParams: Promise<{ invoice_id?: string }>;
}) {
  const { invoice_id: invoiceId } = await searchParams;
  const retryHref = invoiceId ? `/buyer/pay/${invoiceId}` : "/";

  return (
    <section className="mx-auto grid max-w-[640px] place-items-center content-center gap-4 text-center" style={{ minHeight: "58dvh" }}>
      <div className="grid size-[76px] place-items-center rounded-full bg-bad text-[44px] font-extrabold text-[#160606] shadow-[0_0_80px_rgba(248,113,113,0.25)]">
        ×
      </div>
      <h1 className="m-0 text-[clamp(34px,5vw,64px)] font-extrabold leading-[0.98] tracking-[-0.055em] text-ink">
        Payment failed
      </h1>
      <p className="m-0 leading-relaxed text-ink-muted">Retry paying by visiting the invoice payment link again.</p>
      <a href={retryHref} className={cn(buttonVariants())}>Retry paying</a>
    </section>
  );
}
