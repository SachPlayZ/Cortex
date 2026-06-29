import { createDodoCheckout, HttpDodoCheckoutClient } from "../../../../../server/integrations/dodo";
import { getPaymentRuntime } from "../../../../../server/demo-runtime";
import { loadServerEnv } from "../../../../../server/env";

export async function POST(request: Request): Promise<Response> {
  loadServerEnv();
  const body = (await request.json()) as { invoice_id?: string; buyer_email?: string };
  const apiKey = process.env.DODO_PAYMENTS_API_KEY;
  const productId = process.env.DODO_PRODUCT_ID;
  if (!apiKey || !productId) {
    return Response.json({ error: "Dodo environment not configured" }, { status: 500 });
  }
  if (!body.invoice_id) {
    return Response.json({ error: "invoice_id required" }, { status: 400 });
  }

  try {
    const { casperSettlement, paymentStore } = await getPaymentRuntime();
    const input = body.buyer_email
      ? { invoiceId: body.invoice_id, buyerEmail: body.buyer_email }
      : { invoiceId: body.invoice_id };
    const result = await createDodoCheckout({
      input,
      store: paymentStore,
      casper: casperSettlement,
      dodo: new HttpDodoCheckoutClient(
        apiKey,
        productId,
        "https://test.dodopayments.com",
        process.env.DODO_RETURN_URL,
        process.env.DODO_CANCEL_URL
      )
    });
    return Response.json({
      session_id: result.sessionId,
      checkout_url: result.checkoutUrl,
      metadata: result.metadata
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Checkout failed" }, { status: 400 });
  }
}
