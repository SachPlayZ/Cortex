import { DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import { createRequire } from "node:module";
import { getData as getPdfWorkerData } from "pdf-parse/worker";

const nodeRequire = createRequire(import.meta.url);

export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  installPdfJsNodeGlobals();
  const { PDFParse } = nodeRequire("pdf-parse") as typeof import("pdf-parse");
  PDFParse.setWorker(getPdfWorkerData());
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    return normalizeExtractedText(result.text ?? "");
  } finally {
    await parser.destroy();
  }
}

export function installPdfJsNodeGlobals(): void {
  const target = globalThis as unknown as Record<string, unknown>;
  target.DOMMatrix ??= DOMMatrix;
  target.ImageData ??= ImageData;
  target.Path2D ??= Path2D;
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
