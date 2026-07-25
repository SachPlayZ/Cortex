import { CasperChainSyncService } from "../../../../../server/integrations/casper-chain-sync";

export async function GET(_request: Request, { params }: { params: Promise<{ accountHash: string }> }): Promise<Response> {
  const { accountHash } = await params;
  try {
    const usdCents = await new CasperChainSyncService().getMockUsdBalanceUsdCents(accountHash);
    return Response.json({ usdCents });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to read mUSDC balance" }, { status: 400 });
  }
}
