import { getCasperLifecycleClient, getPaymentRuntime } from "../../../../../server/demo-runtime";
import { loadServerEnv } from "../../../../../server/env";
import { readPublicKeyHex, type CasperSigner } from "../../../../../server/integrations/casper-sdk";
import { getDemoInvoice } from "../../../../../lib/demo-data";

type LifecycleAction =
  | "register"
  | "create"
  | "score"
  | "list"
  | "fund"
  | "cash_out"
  | "prepare_repayment_pending"
  | "claim";

export async function POST(request: Request): Promise<Response> {
  loadServerEnv();
  const auth = authorize(request);
  if (auth) return auth;

  const body = (await request.json().catch(() => ({}))) as { action?: LifecycleAction; invoice_id?: string };
  const action = body.action ?? "prepare_repayment_pending";
  const invoiceId = body.invoice_id ?? "crd-inr-live-001";
  const invoice = getDemoInvoice(invoiceId);
  if (!invoice) return Response.json({ error: "invoice not found" }, { status: 404 });
  if (invoice.riskTier === "Rejected") return Response.json({ error: "rejected invoice has no on-chain lifecycle" }, { status: 400 });

  try {
    const lifecycle = getCasperLifecycleClient();
    const { paymentStore } = await getPaymentRuntime();
    const signers = await getSigners();
    const txs: Array<{ step: string; hash: string }> = [];

    if (action === "register" || action === "prepare_repayment_pending") {
      const agentPublicKey = await readPublicKeyHex(signers.agent.keyPath);
      const relayerPublicKey = await readPublicKeyHex(signers.relayer.keyPath);
      txs.push({ step: "register_agent", hash: await submitAndWait(lifecycle, lifecycle.registerAgent(agentPublicKey, signers.admin)) });
      txs.push({
        step: "register_settlement_relayer",
        hash: await submitAndWait(lifecycle, lifecycle.registerSettlementRelayer(relayerPublicKey, signers.admin))
      });
    }

    if (action === "create" || action === "prepare_repayment_pending") {
      txs.push({ step: "create_invoice", hash: await submitAndWait(lifecycle, lifecycle.createInvoice(invoice, signers.seller)) });
      await paymentStore.updateInvoice(invoice.id, { statusCasper: "Created" });
    }

    if (action === "score" || action === "prepare_repayment_pending") {
      txs.push({ step: "post_risk_score", hash: await submitAndWait(lifecycle, lifecycle.postRiskScore(invoice, signers.agent)) });
      await paymentStore.updateInvoice(invoice.id, { statusCasper: "Scored" });
    }

    if (action === "list" || action === "prepare_repayment_pending") {
      txs.push({ step: "list_invoice", hash: await submitAndWait(lifecycle, lifecycle.listInvoice(invoice.id, signers.seller)) });
      await paymentStore.updateInvoice(invoice.id, { statusCasper: "Listed" });
    }

    if (action === "fund" || action === "prepare_repayment_pending") {
      txs.push({ step: "fund_invoice", hash: await submitAndWait(lifecycle, lifecycle.fundInvoice(invoice, signers.investor)) });
      await paymentStore.updateInvoice(invoice.id, { statusCasper: "Funded" });
    }

    if (action === "cash_out" || action === "prepare_repayment_pending") {
      txs.push({ step: "cash_out_advance", hash: await submitAndWait(lifecycle, lifecycle.cashOutAdvance(invoice.id, signers.seller)) });
      await paymentStore.updateInvoice(invoice.id, { statusCasper: "RepaymentPending" });
    }

    if (action === "claim") {
      txs.push({ step: "claim_repayment", hash: await submitAndWait(lifecycle, lifecycle.claimRepayment(invoice.id, signers.investor)) });
      await paymentStore.updateInvoice(invoice.id, { statusCasper: "Settled" });
    }

    return Response.json({ ok: true, invoice_id: invoice.id, action, txs });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Casper lifecycle failed" }, { status: 400 });
  }
}

async function submitAndWait(lifecycle: ReturnType<typeof getCasperLifecycleClient>, promise: Promise<string>): Promise<string> {
  const hash = await promise;
  await lifecycle.waitForTransaction(hash);
  return hash;
}

async function getSigners(): Promise<{
  admin: CasperSigner;
  agent: CasperSigner;
  relayer: CasperSigner;
  seller: CasperSigner;
  investor: CasperSigner;
}> {
  const admin = process.env.CASPER_ADMIN_PRIVATE_KEY_PATH ?? process.env.SETTLEMENT_RELAYER_PRIVATE_KEY_PATH;
  const agent = process.env.AGENT_PRIVATE_KEY_PATH || process.env.SETTLEMENT_RELAYER_PRIVATE_KEY_PATH;
  const relayer = process.env.SETTLEMENT_RELAYER_PRIVATE_KEY_PATH;
  const seller = process.env.CASPER_DEMO_SELLER_PRIVATE_KEY_PATH;
  const investor = process.env.CASPER_DEMO_INVESTOR_PRIVATE_KEY_PATH;
  if (!admin || !agent || !relayer || !seller || !investor) {
    throw new Error("Casper demo signer paths are not fully configured");
  }
  return {
    admin: { keyPath: admin },
    agent: { keyPath: agent },
    relayer: { keyPath: relayer },
    seller: { keyPath: seller },
    investor: { keyPath: investor }
  };
}

function authorize(request: Request): Response | undefined {
  const token = process.env.CASPER_DEMO_ADMIN_TOKEN;
  if (!token || process.env.NODE_ENV !== "production") return undefined;
  if (request.headers.get("authorization") === `Bearer ${token}`) return undefined;
  return Response.json({ error: "unauthorized" }, { status: 401 });
}
