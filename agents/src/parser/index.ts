import {
  ParsedInvoiceSchema,
  parseDecimalToMinorUnits,
  type ParsedInvoice
} from "@cortex/shared";

export type ParserInput = {
  invoiceText: string;
  now?: Date;
  confidence?: number;
};

export function parseInvoiceText(input: ParserInput): ParsedInvoice {
  const text = input.invoiceText;
  const invoiceNumber = matchRequired(text, /invoice(?:\s+number| #| no\.?)?\s*[:#-]\s*([A-Z0-9-]+)/i, "invoice number");
  const sellerName = matchRequired(text, /seller\s*:\s*(.+)/i, "seller");
  const buyerName = matchRequired(text, /buyer\s*:\s*(.+)/i, "buyer");
  const amountMatch = text.match(/amount\s*:\s*([A-Z]{3})\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (!amountMatch?.[1] || !amountMatch[2]) {
    throw new Error("Missing amount or currency");
  }

  const issueDate = matchRequired(text, /issue\s+date\s*:\s*(\d{4}-\d{2}-\d{2})/i, "issue date");
  const dueDate = matchRequired(text, /due\s+date\s*:\s*(\d{4}-\d{2}-\d{2})/i, "due date");
  const confidence = input.confidence ?? Number(text.match(/confidence\s*:\s*(0(?:\.\d+)?|1(?:\.0+)?)/i)?.[1] ?? "0.92");
  const originalCurrency = amountMatch[1].toUpperCase();
  const originalAmountDecimal = amountMatch[2];

  parseDecimalToMinorUnits(originalAmountDecimal, originalCurrency);

  if (confidence < 0.75) {
    throw new Error("Extraction confidence below threshold");
  }

  const now = input.now ?? new Date();
  if (Date.parse(`${dueDate}T00:00:00.000Z`) <= now.getTime()) {
    throw new Error("Due date is in the past");
  }

  return ParsedInvoiceSchema.parse({
    invoice_number: invoiceNumber,
    seller_name: sellerName,
    seller_email: optionalMatch(text, /seller\s+email\s*:\s*(\S+@\S+)/i),
    buyer_name: buyerName,
    buyer_email: optionalMatch(text, /buyer\s+email\s*:\s*(\S+@\S+)/i),
    buyer_domain: optionalMatch(text, /buyer\s+domain\s*:\s*([a-z0-9.-]+\.[a-z]{2,})/i),
    original_currency: originalCurrency,
    original_amount_decimal: originalAmountDecimal,
    issue_date: issueDate,
    due_date: dueDate,
    payment_terms: optionalMatch(text, /payment\s+terms\s*:\s*(.+)/i),
    line_items: [],
    extraction_confidence: confidence,
    warnings: []
  });
}

function matchRequired(text: string, regex: RegExp, field: string): string {
  const value = text.match(regex)?.[1]?.trim();
  if (!value) {
    throw new Error(`Missing ${field}`);
  }
  return value;
}

function optionalMatch(text: string, regex: RegExp): string | undefined {
  return text.match(regex)?.[1]?.trim();
}
