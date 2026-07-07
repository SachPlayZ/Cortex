import { CasperLifecycleService } from "../../../../../server/integrations/casper-lifecycle";
import { loadServerEnv } from "../../../../../server/env";
import { requireBearerToken } from "../../../../../server/auth";

export async function POST(request: Request): Promise<Response> {
  loadServerEnv();
  const auth = requireBearerToken(request, "ADMIN_API_TOKEN");
  if (auth) return auth;

  const body = (await request.json().catch(() => ({}))) as { deposit_amount_usd_cents?: string };
  try {
    const bootstrap = await new CasperLifecycleService().bootstrap(
      body.deposit_amount_usd_cents ? { depositAmountUsdCents: body.deposit_amount_usd_cents } : undefined
    );
    return Response.json({ bootstrap });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Casper bootstrap failed" }, { status: 400 });
  }
}
