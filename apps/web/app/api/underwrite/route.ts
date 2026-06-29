import { NextRequest, NextResponse } from "next/server";
import { runUnderwriting } from "@cortex/agents";
import { FrankfurterFxRateProvider } from "@cortex/agents";
import { loadServerEnv } from "../../../server/env";
import { getPaymentRuntime } from "../../../server/payment-runtime";

loadServerEnv();

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    let invoiceText: string;
    let sellerWallet: string;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      const wallet = form.get("sellerWallet");
      if (!wallet || typeof wallet !== "string") {
        return NextResponse.json({ error: "sellerWallet required" }, { status: 400 });
      }
      if (!file || typeof file === "string") {
        return NextResponse.json({ error: "file required" }, { status: 400 });
      }
      invoiceText = await (file as File).text();
      sellerWallet = wallet;
    } else {
      const body = (await req.json()) as { invoiceText?: string; sellerWallet?: string };
      if (!body.invoiceText || !body.sellerWallet) {
        return NextResponse.json({ error: "invoiceText and sellerWallet required" }, { status: 400 });
      }
      invoiceText = body.invoiceText;
      sellerWallet = body.sellerWallet;
    }

    const groqApiKey = process.env.GROQ_API_KEY;
    const groqModel = process.env.GROQ_MODEL;
    const fxProvider = new FrankfurterFxRateProvider();

    const result = await runUnderwriting({
      invoiceText,
      sellerWallet,
      fxProvider,
      ...(groqApiKey ? { groqApiKey } : {}),
      ...(groqModel ? { groqModel } : {})
    });
    const { paymentStore } = await getPaymentRuntime();
    await paymentStore.upsertInvoice({
      id: result.invoiceId,
      title: result.parsed.invoice_number,
      sellerAccount: sellerWallet,
      invoiceHash: result.invoiceHash,
      originalCurrency: result.parsed.original_currency,
      originalAmountMinor: result.fx.original_amount_minor,
      usdAmountCents: result.fx.usd_amount_cents,
      advanceAmountUsdCents: result.pricing.advance_amount_usd_cents,
      repaymentAmountUsdCents: result.pricing.repayment_amount_usd_cents,
      investorYieldUsdCents: (
        BigInt(result.pricing.repayment_amount_usd_cents) - BigInt(result.pricing.advance_amount_usd_cents)
      ).toString(),
      riskTier: result.pricing.risk_tier,
      riskScore: result.pricing.risk_score,
      discountBps: result.pricing.discount_bps,
      dueDate: result.parsed.due_date,
      statusCasper: result.status === "rejected" ? "Rejected" : "Scored",
      attestationHash: result.attestationHash,
      agentConfidence: result.parsed.extraction_confidence
    });

    return NextResponse.json({
      invoiceId: result.invoiceId,
      invoiceHash: result.invoiceHash,
      parsed: result.parsed,
      fx: result.fx,
      verification: result.verification,
      pricing: result.pricing,
      attestation: result.attestation,
      attestationHash: result.attestationHash,
      status: result.status,
      usingGroq: Boolean(groqApiKey)
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Underwriting failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
