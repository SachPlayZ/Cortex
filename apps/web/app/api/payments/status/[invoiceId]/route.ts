import { getPaymentRuntime } from "../../../../../server/payment-runtime";
import { CasperLifecycleService } from "../../../../../server/integrations/casper-lifecycle";

export async function GET(_request: Request, { params }: { params: Promise<{ invoiceId: string }> }): Promise<Response> {
  const { invoiceId } = await params;
  try {
    const { paymentStore } = await getPaymentRuntime();
    const invoice =
      (await new CasperLifecycleService().reconcileInvoice(invoiceId).catch(() => undefined)) ??
      (await paymentStore.requireInvoice(invoiceId));
    const successful = invoice.statusCasper === "Repaid" || invoice.statusCasper === "Settled";
    return Response.json({
      invoice_id: invoice.id,
      payment_status: successful ? "succeeded" : "pending_webhook",
      casper_status: invoice.statusCasper,
      casper_deploy_hash: invoice.lastRepaymentDeployHash ?? null,
      checkout_url: invoice.dodoCheckoutUrl ?? null,
      status_last_synced_at: invoice.statusLastSyncedAt ?? null
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Payment status unavailable" }, { status: 404 });
  }
}
