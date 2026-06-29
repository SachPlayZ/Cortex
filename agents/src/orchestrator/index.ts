import { hashJson, sha256Hex } from "@cortex/shared";
import { buildAttestation } from "../attestation/index.js";
import { FxNormalizer } from "../fx/index.js";
import { parseInvoiceText } from "../parser/index.js";
import { priceRisk } from "../risk/index.js";
import { verifyInvoice } from "../verification/index.js";
import type { FxRateProvider } from "../fx/index.js";

export async function runUnderwriting(input: {
  invoiceText: string;
  sellerWallet: string;
  fxProvider: FxRateProvider;
  existingInvoiceHashes?: ReadonlySet<string>;
  existingSellerInvoiceNumbers?: ReadonlySet<string>;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const parsed = parseInvoiceText({ invoiceText: input.invoiceText, now });
  const invoiceHash = sha256Hex(input.invoiceText);
  const evidenceHash = sha256Hex(input.invoiceText.trim());
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
    createdAt: now.toISOString()
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
