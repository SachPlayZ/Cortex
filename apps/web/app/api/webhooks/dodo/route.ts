import { after } from "next/server";
import { handleDodoWebhook } from "../../../../server/integrations/dodo";
import { CasperChainSyncService } from "../../../../server/integrations/casper-chain-sync";
import { SettlementRelayer } from "../../../../server/integrations/settlement-relayer";
import { getPaymentRuntime } from "../../../../server/payment-runtime";
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
    casper: casperSettlement,
    readVerifiedInvoiceState: async (invoiceId) => new CasperChainSyncService().getInvoiceState(invoiceId),
    deferSettlement: true
  });
  if (result.outcome === "rejected") {
    const ignored = result.reason === "not_successful_payment";
    return Response.json({ ok: ignored, ignored, reason: result.reason }, { status: ignored ? 200 : 400 });
  }
  if (result.outcome === "accepted") {
    // Ack Dodo fast; Casper settlement runs after the response. Failed jobs stay
    // retryable and are drained by /api/relayer/retry.
    const job = result.relayerJob;
    after(async () => {
      try {
        await new SettlementRelayer(paymentStore, casperSettlement).submit(job);
      } catch (error) {
        console.error("Deferred Casper settlement failed", error);
      }
    });
  }
  return Response.json({ ok: true, outcome: result.outcome });
}
