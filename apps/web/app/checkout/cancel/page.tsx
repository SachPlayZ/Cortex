import { XCircleIcon } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";

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
      <Card className="mx-auto min-h-[62dvh] max-w-3xl items-center justify-center text-center">
        <CardHeader className="items-center gap-6">
          <div className="grid size-16 place-items-center rounded-lg bg-muted text-destructive">
            <XCircleIcon />
          </div>
          <CardTitle className="text-3xl md:text-4xl">Checkout cancelled</CardTitle>
          <CardDescription className="max-w-xl text-base leading-7">
            No repayment was recorded. Retry from the invoice payment link when you are ready.
          </CardDescription>
          <Button nativeButton={false} render={<a href={retryHref} />}>Retry paying</Button>
        </CardHeader>
      </Card>
    </div>
  );
}
