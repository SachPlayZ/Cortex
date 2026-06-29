import { getPaymentRuntime } from "../../../../../server/payment-runtime";

export async function GET(_request: Request, { params }: { params: Promise<{ invoiceId: string }> }): Promise<Response> {
  const { invoiceId } = await params;
  try {
    const { paymentStore } = await getPaymentRuntime();
    const invoice = await paymentStore.requireInvoice(invoiceId);
    const successful = invoice.statusCasper === "Repaid" || invoice.statusCasper === "Settled";
    return Response.json({
      invoice_id: invoice.id,
      payment_status: successful ? "succeeded" : "pending_webhook",
      on_chain_status: invoice.statusCasper,
      casper_deploy_hash: invoice.lastRepaymentDeployHash ?? null,
      checkout_url: invoice.dodoCheckoutUrl ?? null
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Payment status unavailable" }, { status: 404 });
  }
}
