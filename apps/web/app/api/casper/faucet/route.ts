import { CasperLifecycleService } from "../../../../server/integrations/casper-lifecycle";

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as { public_key_hex?: string };
  if (!body.public_key_hex) {
    return Response.json({ error: "public_key_hex required" }, { status: 400 });
  }
  try {
    const result = await new CasperLifecycleService().faucetMockUsd(body.public_key_hex);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "mUSDC faucet unavailable" }, { status: 400 });
  }
}
