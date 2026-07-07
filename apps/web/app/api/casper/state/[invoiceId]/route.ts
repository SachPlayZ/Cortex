import { CasperLifecycleService } from "../../../../../server/integrations/casper-lifecycle";

export async function GET(_request: Request, { params }: { params: Promise<{ invoiceId: string }> }): Promise<Response> {
  const { invoiceId } = await params;
  try {
    const invoice = await new CasperLifecycleService().reconcileInvoice(invoiceId);
    return Response.json({ invoice });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to reconcile invoice" }, { status: 400 });
  }
}
