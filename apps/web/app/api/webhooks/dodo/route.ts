import { handleDodoWebhook } from "../../../../server/integrations/dodo";
import { getPaymentRuntime } from "../../../../server/demo-runtime";
import { loadServerEnv } from "../../../../server/env";

export async function POST(request: Request): Promise<Response> {
  loadServerEnv();
  const webhookSecret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return Response.json({ error: "Dodo webhook secret not configured" }, { status: 500 });
  }
  const rawBody = await request.text();
  const headers = {
    "webhook-id": request.headers.get("webhook-id") ?? "",
    "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
    "webhook-signature": request.headers.get("webhook-signature") ?? ""
  };
  const { casperSettlement, paymentStore } = await getPaymentRuntime();
  const result = await handleDodoWebhook({
    rawBody,
    headers,
    webhookSecret,
    store: paymentStore,
    casper: casperSettlement
  });
  if (result.outcome === "rejected") {
    return Response.json({ ok: false, reason: result.reason }, { status: 400 });
  }
  return Response.json({ ok: true, outcome: result.outcome });
}
