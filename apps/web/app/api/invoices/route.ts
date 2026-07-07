import { getPaymentRuntime } from "../../../server/payment-runtime";
import { CasperLifecycleService } from "../../../server/integrations/casper-lifecycle";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const account = url.searchParams.get("account") ?? undefined;
  const role = url.searchParams.get("role");
  const status = url.searchParams.get("status") ?? undefined;

  try {
    const { paymentStore } = await getPaymentRuntime();
    const invoices = await paymentStore.listInvoices({
      ...(role === "seller" && account ? { sellerAccount: account } : {}),
      ...(role === "investor" && account ? { investorAccount: account } : {}),
      ...(status ? { statusCasper: status as never } : {})
    });
    const service = new CasperLifecycleService();
    // Only invoices with a live on-chain lifecycle can change state; terminal and
    // off-chain records are returned as stored to avoid an RPC call per invoice.
    const TERMINAL_STATUSES = new Set(["Settled", "Rejected", "Defaulted"]);
    const MAX_RECONCILE = 25;
    let reconcileBudget = MAX_RECONCILE;
    const reconciled = await Promise.all(
      invoices.map(async (invoice) => {
        const needsSync = invoice.casperInvoiceExists && !TERMINAL_STATUSES.has(invoice.statusCasper);
        if (!needsSync || reconcileBudget-- <= 0) return invoice;
        return service.reconcileInvoice(invoice.id).catch(() => invoice);
      })
    );
    return Response.json({ invoices: reconciled });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load invoices" }, { status: 500 });
  }
}
