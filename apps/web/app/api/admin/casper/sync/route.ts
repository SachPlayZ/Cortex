import { loadServerEnv } from "../../../../../server/env";
import { requireBearerToken } from "../../../../../server/auth";
import { runBackgroundJobsOnce } from "../../../../../server/background-jobs";
import { getPaymentRuntime } from "../../../../../server/payment-runtime";

export async function POST(request: Request): Promise<Response> {
  loadServerEnv();
  const auth = requireBearerToken(request, "ADMIN_API_TOKEN");
  if (auth) return auth;

  try {
    const result = await runBackgroundJobsOnce(await getPaymentRuntime());
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Casper sync failed" }, { status: 400 });
  }
}

export async function GET(request: Request): Promise<Response> {
  return POST(request);
}
