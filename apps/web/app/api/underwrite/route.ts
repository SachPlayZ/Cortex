import { NextRequest, NextResponse } from "next/server";
import { runUnderwriting } from "@cortex/agents";
import { FrankfurterFxRateProvider } from "@cortex/agents";
import { sha256Hex } from "@cortex/shared";
import { createRequire } from "node:module";
import { loadServerEnv } from "../../../server/env";
import { getPaymentRuntime } from "../../../server/payment-runtime";

loadServerEnv();

export const runtime = "nodejs";

type InvoiceEvidence = {
  invoiceText: string;
  invoiceHash: `0x${string}`;
  evidenceHash: `0x${string}`;
  fileName?: string;
  mimeType?: string;
  imageDataUrl?: string;
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const nodeRequire = createRequire(import.meta.url);

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    let invoiceText: string;
    let sellerWallet: string;
    let evidence: InvoiceEvidence | undefined;

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
      evidence = await readInvoiceEvidence(file);
      invoiceText = evidence.invoiceText;
      sellerWallet = wallet;
    } else {
      const body = (await req.json()) as { invoiceText?: string; sellerWallet?: string };
      if (!body.invoiceText || !body.sellerWallet) {
        return NextResponse.json({ error: "invoiceText and sellerWallet required" }, { status: 400 });
      }
      invoiceText = body.invoiceText;
      const textBytes = new TextEncoder().encode(invoiceText);
      evidence = {
        invoiceText,
        invoiceHash: sha256Hex(textBytes),
        evidenceHash: sha256Hex(new TextEncoder().encode(invoiceText.trim())),
        mimeType: "text/plain"
      };
      sellerWallet = body.sellerWallet;
    }

    const groqApiKey = process.env.GROQ_API_KEY;
    const groqModel = process.env.GROQ_MODEL;
    const groqVisionModel = process.env.GROQ_VISION_MODEL;
    const fxProvider = new FrankfurterFxRateProvider();

    const result = await runUnderwriting({
      invoiceText,
      sellerWallet,
      fxProvider,
      invoiceHash: evidence.invoiceHash,
      evidenceHash: evidence.evidenceHash,
      ...(evidence.imageDataUrl ? { invoiceImageDataUrl: evidence.imageDataUrl } : {}),
      ...(evidence.fileName ? { invoiceFileName: evidence.fileName } : {}),
      ...(evidence.mimeType ? { invoiceMimeType: evidence.mimeType } : {}),
      ...(groqApiKey ? { groqApiKey } : {}),
      ...(groqModel ? { groqModel } : {}),
      ...(groqVisionModel ? { groqVisionModel } : {})
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

async function readInvoiceEvidence(file: File): Promise<InvoiceEvidence> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  if (bytes.byteLength === 0) {
    throw new Error("Uploaded invoice file is empty");
  }
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("Uploaded invoice file is too large. Maximum size is 10MB");
  }

  const fileName = file.name || "invoice-upload";
  const mimeType = normalizeMimeType(file.type, fileName);
  const fileHash = sha256Hex(bytes);

  if (isTextInvoice(mimeType, fileName)) {
    const invoiceText = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (!invoiceText.trim()) {
      throw new Error("Uploaded text invoice is empty");
    }
    return {
      invoiceText,
      invoiceHash: fileHash,
      evidenceHash: fileHash,
      fileName,
      mimeType
    };
  }

  if (mimeType === "application/pdf") {
    const invoiceText = await extractPdfText(bytes);
    if (!invoiceText.trim()) {
      throw new Error(
        "This PDF does not contain extractable text. Upload a PNG/JPG scan or paste the invoice text so OCR can process it."
      );
    }
    return {
      invoiceText,
      invoiceHash: fileHash,
      evidenceHash: fileHash,
      fileName,
      mimeType
    };
  }

  if (mimeType === "image/png" || mimeType === "image/jpeg" || mimeType === "image/webp") {
    return {
      invoiceText: [
        "Invoice image upload",
        `File: ${fileName}`,
        `MIME: ${mimeType}`,
        `Evidence hash: ${fileHash}`
      ].join("\n"),
      invoiceHash: fileHash,
      evidenceHash: fileHash,
      fileName,
      mimeType,
      imageDataUrl: `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`
    };
  }

  throw new Error("Unsupported invoice file type. Upload a PDF, PNG, JPG, WEBP, or plain text invoice.");
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const { PDFParse } = nodeRequire("pdf-parse") as typeof import("pdf-parse");
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    return normalizeExtractedText(result.text ?? "");
  } finally {
    await parser.destroy();
  }
}

function normalizeMimeType(fileType: string, fileName: string): string {
  const lowerType = fileType.toLowerCase();
  const lowerName = fileName.toLowerCase();
  if (lowerType) return lowerType;
  if (lowerName.endsWith(".pdf")) return "application/pdf";
  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
  if (lowerName.endsWith(".webp")) return "image/webp";
  if (lowerName.endsWith(".txt") || lowerName.endsWith(".text")) return "text/plain";
  return "application/octet-stream";
}

function isTextInvoice(mimeType: string, fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  return mimeType.startsWith("text/") || lowerName.endsWith(".txt") || lowerName.endsWith(".text");
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
