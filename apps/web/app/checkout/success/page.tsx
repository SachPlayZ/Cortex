import { Clock3Icon } from "lucide-react";
import { PaymentReturnStatus } from "../../../components/payment-return-status";
import { Card, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Spinner } from "../../../components/ui/spinner";

export const metadata = { title: "Payment status | Cortex" };

export default async function CheckoutSuccessPage({
  searchParams
}: {
  searchParams: Promise<{ invoice_id?: string }>;
}) {
  const { invoice_id: invoiceId } = await searchParams;
  if (!invoiceId) {
    return (
      <div className="min-h-dvh px-5 pb-24 pt-32 md:px-8 md:pt-36">
        <Card className="mx-auto min-h-[62dvh] max-w-4xl items-center justify-center rounded-2xl border-white/10 bg-card/72 text-center">
          <CardHeader className="items-center gap-6">
            <div className="grid size-20 place-items-center rounded-full border border-white/10 bg-primary/10 text-primary">
              <Spinner />
            </div>
            <Clock3Icon className="text-primary" />
            <CardTitle className="text-4xl tracking-normal md:text-6xl">Waiting for payment confirmation</CardTitle>
            <CardDescription className="max-w-xl text-base leading-7">
              Dodo returned without an invoice reference. Keep this page open while Cortex waits for the webhook.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return <PaymentReturnStatus invoiceId={invoiceId} />;
}
