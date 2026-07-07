import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const SWIFT_OCR_SCRIPT_PATH = resolve(process.cwd(), "scripts/vision_ocr.swift");

export type OcrResult = {
  text: string;
  averageConfidence?: number | undefined;
  engine: "apple-vision";
  renderedImageDataUrl?: string | undefined;
};

export async function extractInvoiceTextWithLocalOcr(input: {
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
}): Promise<OcrResult | undefined> {
  if (input.mimeType === "application/pdf") {
    return extractPdfTextWithVision(input.bytes, input.fileName);
  }
  if (input.mimeType === "image/png" || input.mimeType === "image/jpeg" || input.mimeType === "image/webp") {
    return extractImageTextWithVision(input.bytes, extensionForMimeType(input.mimeType, input.fileName));
  }
  return undefined;
}

async function extractPdfTextWithVision(bytes: Uint8Array, fileName: string): Promise<OcrResult | undefined> {
  const tempDir = await fs.mkdtemp(join(tmpdir(), "cortex-ocr-pdf-"));
  const pdfPath = join(tempDir, sanitizeName(fileName, "invoice.pdf"));
  const renderedPrefix = join(tempDir, "page");
  const renderedImagePath = `${renderedPrefix}.png`;

  try {
    await fs.writeFile(pdfPath, bytes);
    await execFileAsync("pdftoppm", ["-f", "1", "-singlefile", "-png", pdfPath, renderedPrefix], {
      maxBuffer: 10 * 1024 * 1024
    });
    const imageBytes = await fs.readFile(renderedImagePath);
    const ocr = await extractImageTextWithVision(imageBytes, ".png");
    const renderedImageDataUrl = `data:image/png;base64,${imageBytes.toString("base64")}`;
    if (!ocr) {
      return {
        text: "",
        engine: "apple-vision",
        renderedImageDataUrl
      };
    }
    return {
      ...ocr,
      renderedImageDataUrl
    };
  } catch {
    return undefined;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function extractImageTextWithVision(bytes: Uint8Array, extension: string): Promise<OcrResult | undefined> {
  const tempDir = await fs.mkdtemp(join(tmpdir(), "cortex-ocr-image-"));
  const imagePath = join(tempDir, `invoice${extension}`);

  try {
    await fs.writeFile(imagePath, bytes);
    const { stdout } = await execFileAsync("swift", [SWIFT_OCR_SCRIPT_PATH, imagePath], {
      maxBuffer: 10 * 1024 * 1024
    });
    const parsed = JSON.parse(stdout) as { text?: string; average_confidence?: number };
    const text = parsed.text?.trim();
    if (!text) return undefined;
    return {
      text,
      averageConfidence: parsed.average_confidence,
      engine: "apple-vision"
    };
  } catch {
    return undefined;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

function extensionForMimeType(mimeType: string, fileName: string): string {
  switch (mimeType) {
    case "image/png":
      return ".png";
    case "image/jpeg":
      return fileName.toLowerCase().endsWith(".jpeg") ? ".jpeg" : ".jpg";
    case "image/webp":
      return ".webp";
    default:
      return ".img";
  }
}

function sanitizeName(fileName: string, fallback: string): string {
  const cleaned = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.length > 0 ? cleaned : fallback;
}
