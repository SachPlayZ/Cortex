import { afterEach, describe, expect, it } from "vitest";
import { extractPdfText } from "../server/integrations/pdf-text";

const pdfGlobals = globalThis as unknown as Record<string, unknown>;
const originalGlobals = {
  DOMMatrix: pdfGlobals.DOMMatrix,
  ImageData: pdfGlobals.ImageData,
  Path2D: pdfGlobals.Path2D
};

afterEach(() => {
  for (const [name, value] of Object.entries(originalGlobals)) {
    if (value === undefined) {
      delete pdfGlobals[name];
    } else {
      pdfGlobals[name] = value;
    }
  }
});

describe("server PDF text extraction", () => {
  it("installs Node canvas globals before loading PDF.js", async () => {
    delete pdfGlobals.DOMMatrix;
    delete pdfGlobals.ImageData;
    delete pdfGlobals.Path2D;

    const text = await extractPdfText(createTextPdf("Invoice CORTEX-1042"));

    expect(text).toContain("Invoice CORTEX-1042");
    expect(pdfGlobals.DOMMatrix).toBeTypeOf("function");
    expect(pdfGlobals.ImageData).toBeTypeOf("function");
    expect(pdfGlobals.Path2D).toBeTypeOf("function");
  });
});

function createTextPdf(text: string): Uint8Array {
  const escapedText = text.replace(/([\\()])/g, "\\$1");
  const stream = `BT\n/F1 18 Tf\n72 720 Td\n(${escapedText}) Tj\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
}
