const MAX_REQUEST_BYTES = 1_000_000;
const MAX_BATCH_SIZE = 25;
const UPSTREAM_TIMEOUT_MS = 30_000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonRpcRequest = {
  jsonrpc: "2.0";
  method: string;
};

function errorResponse(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: { "cache-control": "no-store" } });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  return isRecord(value) && value.jsonrpc === "2.0" && typeof value.method === "string" && value.method.trim().length > 0;
}

function isJsonRpcPayload(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0 && value.length <= MAX_BATCH_SIZE && value.every(isJsonRpcRequest);
  }
  return isJsonRpcRequest(value);
}

function resolveUpstreamRpcUrl(): URL | null {
  const configuredUrl = process.env.CASPER_NODE_RPC_URL;
  if (!configuredUrl) return null;

  try {
    const url = new URL(configuredUrl);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  const upstreamUrl = resolveUpstreamRpcUrl();
  if (!upstreamUrl) {
    return errorResponse("Casper RPC is not configured", 503);
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return errorResponse("JSON-RPC request is too large", 413);
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return errorResponse("Unable to read JSON-RPC request", 400);
  }

  if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
    return errorResponse("JSON-RPC request is too large", 413);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return errorResponse("Invalid JSON-RPC payload", 400);
  }

  if (!isJsonRpcPayload(payload)) {
    return errorResponse("Invalid JSON-RPC request", 400);
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json"
      },
      body: rawBody,
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
    });

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: {
        "cache-control": "no-store",
        "content-type": upstreamResponse.headers.get("content-type") ?? "application/json"
      }
    });
  } catch {
    return errorResponse("Casper RPC is unavailable", 502);
  }
}
