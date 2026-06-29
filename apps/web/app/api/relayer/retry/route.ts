import { getPaymentRuntime } from "../../../../server/payment-runtime";
import { loadServerEnv } from "../../../../server/env";
import { SettlementRelayer } from "../../../../server/integrations/settlement-relayer";

export async function POST(request: Request): Promise<Response> {
  loadServerEnv();
  const auth = authorize(request);
  if (auth) return auth;

  const { paymentStore, casperSettlement } = await getPaymentRuntime();
  const jobs = await paymentStore.listRetryableRelayerJobs(25);
  const relayer = new SettlementRelayer(paymentStore, casperSettlement);
  const results = [];
  for (const job of jobs) {
    results.push(await relayer.submit(job));
  }
  return Response.json({
    ok: true,
    attempted: jobs.length,
    confirmed: results.filter((job) => job.status === "confirmed").length,
    retryable_failed: results.filter((job) => job.status === "retryable_failed").length
  });
}

export async function GET(request: Request): Promise<Response> {
  return POST(request);
}

function authorize(request: Request): Response | undefined {
  const token = process.env.RELAYER_RETRY_TOKEN;
  if (!token || process.env.NODE_ENV !== "production") return undefined;
  if (request.headers.get("authorization") === `Bearer ${token}`) return undefined;
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
