import { XCircleIcon } from "lucide-react";
import { buttonVariants } from "../../../components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { cn } from "@/lib/utils";

export const metadata = { title: "Checkout cancelled | Cortex" };

export default async function CheckoutCancelPage({
  searchParams
}: {
  searchParams: Promise<{ invoice_id?: string }>;
}) {
  const { invoice_id: invoiceId } = await searchParams;
  const retryHref = invoiceId ? `/buyer/pay/${invoiceId}` : "/";

  return (
    <div className="min-h-dvh px-5 pb-24 pt-32 md:px-8 md:pt-36">
      <Card className="mx-auto min-h-[62dvh] max-w-4xl items-center justify-center rounded-2xl border-white/10 bg-card/72 text-center">
        <CardHeader className="items-center gap-6">
          <div className="grid size-20 place-items-center rounded-full border border-white/10 bg-destructive/10 text-destructive">
            <XCircleIcon />
          </div>
          <CardTitle className="text-4xl tracking-normal md:text-6xl">Checkout cancelled</CardTitle>
          <CardDescription className="max-w-xl text-base leading-7">
            No repayment was recorded. Retry from the invoice payment link when you are ready.
          </CardDescription>
          <a href={retryHref} className={cn(buttonVariants())}>Retry paying</a>
        </CardHeader>
      </Card>
    </div>
  );
}
