import { hashJson, sha256Hex } from "@cortex/shared";
import { buildAttestation } from "../attestation/index.js";
import { FxNormalizer } from "../fx/index.js";
import { parseInvoiceText } from "../parser/index.js";
import { groqParseInvoice } from "../parser/groq-parser.js";
import { priceRisk } from "../risk/index.js";
import { verifyInvoice } from "../verification/index.js";
import type { FxRateProvider } from "../fx/index.js";

export async function runUnderwriting(input: {
  invoiceText: string;
  sellerWallet: string;
  fxProvider: FxRateProvider;
  invoiceImageDataUrl?: string;
  invoiceFileName?: string;
  invoiceMimeType?: string;
  invoiceHash?: `0x${string}`;
  evidenceHash?: `0x${string}`;
  groqApiKey?: string;
  groqModel?: string;
  groqVisionModel?: string;
  existingInvoiceHashes?: ReadonlySet<string>;
  existingSellerInvoiceNumbers?: ReadonlySet<string>;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (input.invoiceImageDataUrl && !input.groqApiKey) {
    throw new Error("Image invoice uploads require GROQ_API_KEY so the parser can use vision extraction");
  }
  const groqModel = input.invoiceImageDataUrl
    ? input.groqVisionModel ?? input.groqModel ?? "meta-llama/llama-4-scout-17b-16e-instruct"
    : input.groqModel;
  const parsed = input.groqApiKey
    ? await groqParseInvoice({
        invoiceText: input.invoiceText,
        ...(input.invoiceImageDataUrl ? { imageDataUrl: input.invoiceImageDataUrl } : {}),
        ...(input.invoiceFileName ? { fileName: input.invoiceFileName } : {}),
        ...(input.invoiceMimeType ? { mimeType: input.invoiceMimeType } : {}),
        apiKey: input.groqApiKey,
        ...(groqModel ? { model: groqModel } : {}),
        now
      })
    : parseInvoiceText({ invoiceText: input.invoiceText, now });
  const invoiceHash = input.invoiceHash ?? sha256Hex(input.invoiceText);
  const evidenceHash = input.evidenceHash ?? sha256Hex(input.invoiceText.trim());
  const buyerHash = hashJson({ buyer_name: parsed.buyer_name, buyer_domain: parsed.buyer_domain ?? "" });
  const invoiceId = hashJson({ sellerWallet: input.sellerWallet, invoiceHash, nonce: parsed.invoice_number });
  const fxNormalizer = new FxNormalizer(input.fxProvider, 10 * 60 * 1000, () => now.getTime());
  const fx = await fxNormalizer.normalize({
    original_currency: parsed.original_currency,
    original_amount_decimal: parsed.original_amount_decimal,
    invoice_date: parsed.issue_date
  });
  const verificationInput = {
    invoiceId,
    invoiceHash,
    sellerWallet: input.sellerWallet,
    parsed,
    fx,
    now
  };
  const verification = verifyInvoice({
    ...verificationInput,
    ...(input.existingInvoiceHashes ? { existingInvoiceHashes: input.existingInvoiceHashes } : {}),
    ...(input.existingSellerInvoiceNumbers ? { existingSellerInvoiceNumbers: input.existingSellerInvoiceNumbers } : {})
  });
  const pricing = priceRisk({
    invoiceId,
    parsed,
    verification,
    usdAmountCents: fx.usd_amount_cents,
    now
  });
  const { attestation, attestationHash } = buildAttestation({
    invoiceId,
    invoiceHash,
    evidenceHash,
    buyerHash,
    sellerWallet: input.sellerWallet,
    parsed,
    fx,
    verification,
    pricing,
    createdAt: now.toISOString(),
    model: input.groqApiKey ? `groq/${groqModel ?? "llama-3.3-70b-versatile"}` : "deterministic-v1"
  });

  return {
    invoiceId,
    invoiceHash,
    evidenceHash,
    buyerHash,
    parsed,
    fx,
    verification,
    pricing,
    attestation,
    attestationHash,
    status: pricing.risk_tier === "Rejected" ? "rejected" : "ready_to_mint"
  };
}
