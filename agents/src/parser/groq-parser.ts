import Groq from "groq-sdk";
import { z } from "zod";
import { ParsedInvoiceSchema, type ParsedInvoice } from "@cortex/shared";

const SYSTEM_PROMPT = `You are an invoice data extraction engine.
Extract the following fields from the provided invoice evidence and return ONLY valid JSON.
No markdown, no explanation, just the JSON object.
Do not invent missing required fields. If a required field is not present, return your best extraction with low extraction_confidence.
IMPORTANT: PDF text extraction can scramble column layouts. The buyer/client name may appear anywhere in the document — not necessarily directly under "BILL TO". Look for company names, client names, or "Acme"-style entities anywhere in the text and infer who the buyer is from context.

Required fields:
- invoice_number: string (invoice identifier)
- seller_name: string
- buyer_name: string (the client/customer being billed — scan the entire document, not just directly under "BILL TO")
- original_currency: string (ISO-4217, e.g. "INR", "USD", "EUR")
- original_amount_decimal: string (numeric string, e.g. "12500.00")
- issue_date: string (YYYY-MM-DD)
- due_date: string (YYYY-MM-DD)

Optional fields (omit if not present):
- seller_email: string
- buyer_email: string
- buyer_domain: string (domain only, e.g. "acme.com")
- payment_terms: string
- extraction_confidence: number between 0 and 1

Return exactly this shape:
{
  "invoice_number": "...",
  "seller_name": "...",
  "buyer_name": "...",
  "original_currency": "...",
  "original_amount_decimal": "...",
  "issue_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD",
  "seller_email": "...",
  "buyer_email": "...",
  "buyer_domain": "...",
  "payment_terms": "...",
  "extraction_confidence": 0.95
}`;

export async function groqParseInvoice(input: {
  invoiceText: string;
  imageDataUrl?: string;
  fileName?: string;
  mimeType?: string;
  apiKey: string;
  model?: string;
  now?: Date;
}): Promise<ParsedInvoice> {
  const client = new Groq({ apiKey: input.apiKey });
  const model = input.model ?? "llama-3.3-70b-versatile";
  const userText = input.imageDataUrl
    ? [
        "Extract invoice fields from the attached invoice image.",
        input.fileName ? `File name: ${input.fileName}` : undefined,
        input.mimeType ? `MIME type: ${input.mimeType}` : undefined,
        input.invoiceText ? `Upload metadata:\n${input.invoiceText}` : undefined
      ]
        .filter(Boolean)
        .join("\n")
    : `Extract invoice fields from this invoice text:\n\n${input.invoiceText}`;
  const userContent = input.imageDataUrl
    ? [
        { type: "text" as const, text: userText },
        { type: "image_url" as const, image_url: { url: input.imageDataUrl } }
      ]
    : userText;

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent }
    ],
    temperature: 0,
    max_completion_tokens: 700
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Groq returned empty response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObject(raw));
  } catch {
    throw new Error(`Groq response not valid JSON: ${sanitizeModelOutput(raw)}`);
  }

  const now = input.now ?? new Date();

  // Merge defaults for optional fields before Zod validation
  const candidate = {
    line_items: [],
    warnings: [],
    extraction_confidence: 0.92,
    ...(parsed as Record<string, unknown>)
  };

  let result: ParsedInvoice;
  try {
    result = ParsedInvoiceSchema.parse(candidate);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const missing = err.issues.map(i => i.path.join(".")).join(", ");
      throw new Error(`Invoice extraction failed — could not extract required fields: ${missing}. Check that the PDF contains readable text with invoice details.`);
    }
    throw err;
  }

  if (result.extraction_confidence < 0.75) {
    throw new Error("Groq extraction confidence below threshold");
  }
  if (Date.parse(`${result.due_date}T00:00:00.000Z`) <= now.getTime()) {
    throw new Error("Due date is in the past");
  }

  return result;
}

export function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  if (unfenced.startsWith("{") && unfenced.endsWith("}")) {
    return unfenced;
  }

  const firstBrace = unfenced.indexOf("{");
  const lastBrace = unfenced.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("No JSON object found");
  }
  return unfenced.slice(firstBrace, lastBrace + 1);
}

function sanitizeModelOutput(raw: string): string {
  return raw
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "�")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}
