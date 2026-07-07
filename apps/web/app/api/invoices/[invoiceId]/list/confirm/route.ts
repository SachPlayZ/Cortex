import { CasperLifecycleService } from "../../../../../../server/integrations/casper-lifecycle";

export async function POST(request: Request, { params }: { params: Promise<{ invoiceId: string }> }): Promise<Response> {
  const { invoiceId } = await params;
  const body = (await request.json()) as { deploy_hash?: string; intent_id?: string };
  if (!body.deploy_hash || !body.intent_id) {
    return Response.json({ error: "intent_id and deploy_hash required" }, { status: 400 });
  }
  try {
    const invoice = await new CasperLifecycleService().confirmList(invoiceId, body.intent_id, body.deploy_hash);
    return Response.json({ invoice });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to confirm list" }, { status: 400 });
  }
}
