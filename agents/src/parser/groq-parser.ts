import Groq from "groq-sdk";
import { ParsedInvoiceSchema, type ParsedInvoice } from "@cortex/shared";

const SYSTEM_PROMPT = `You are an invoice data extraction engine.
Extract the following fields from the invoice text and return ONLY valid JSON.
No markdown, no explanation, just the JSON object.

Required fields:
- invoice_number: string (invoice identifier)
- seller_name: string
- buyer_name: string
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
  apiKey: string;
  model?: string;
  now?: Date;
}): Promise<ParsedInvoice> {
  const client = new Groq({ apiKey: input.apiKey });
  const model = input.model ?? "llama-3.3-70b-versatile";

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: input.invoiceText }
    ],
    temperature: 0,
    max_tokens: 512
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Groq returned empty response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    throw new Error(`Groq response not valid JSON: ${raw.slice(0, 200)}`);
  }

  const now = input.now ?? new Date();

  // Merge defaults for optional fields before Zod validation
  const candidate = {
    line_items: [],
    warnings: [],
    extraction_confidence: 0.92,
    ...(parsed as Record<string, unknown>)
  };

  const result = ParsedInvoiceSchema.parse(candidate);

  if (result.extraction_confidence < 0.75) {
    throw new Error("Groq extraction confidence below threshold");
  }
  if (Date.parse(`${result.due_date}T00:00:00.000Z`) <= now.getTime()) {
    throw new Error("Due date is in the past");
  }

  return result;
}
