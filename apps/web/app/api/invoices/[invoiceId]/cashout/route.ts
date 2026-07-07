import { CasperLifecycleService } from "../../../../../server/integrations/casper-lifecycle";

export async function POST(request: Request, { params }: { params: Promise<{ invoiceId: string }> }): Promise<Response> {
  const { invoiceId } = await params;
  const body = (await request.json()) as { public_key_hex?: string; account_hash?: string };
  if (!body.public_key_hex || !body.account_hash) {
    return Response.json({ error: "public_key_hex and account_hash required" }, { status: 400 });
  }
  try {
    const prepared = await new CasperLifecycleService().prepareCashout(invoiceId, body.public_key_hex, body.account_hash);
    return Response.json(prepared);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to prepare cash out" }, { status: 400 });
  }
}
