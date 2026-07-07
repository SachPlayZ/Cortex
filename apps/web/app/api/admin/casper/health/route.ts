import { CasperLifecycleService } from "../../../../../server/integrations/casper-lifecycle";

export async function GET(): Promise<Response> {
  try {
    const health = await new CasperLifecycleService().getHealth();
    return Response.json(health);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Casper health unavailable" }, { status: 400 });
  }
}
