import { getPaymentRuntime } from "../../../server/payment-runtime";

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
    return Response.json({ invoices });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load invoices" }, { status: 500 });
  }
}
