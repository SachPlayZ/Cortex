import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../app/api/casper/rpc/route";

const originalRpcUrl = process.env.CASPER_NODE_RPC_URL;

function rpcRequest(body: string): Request {
  return new Request("https://cortex.example/api/casper/rpc", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body
  });
}

afterEach(() => {
  if (originalRpcUrl === undefined) {
    delete process.env.CASPER_NODE_RPC_URL;
  } else {
    process.env.CASPER_NODE_RPC_URL = originalRpcUrl;
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Casper JSON-RPC proxy", () => {
  it("forwards valid JSON-RPC requests to the server-only HTTP endpoint", async () => {
    process.env.CASPER_NODE_RPC_URL = "http://185.170.112.40:7777/rpc";
    const payload = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "chain_get_state_root_hash", params: [] });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { state_root_hash: "abc" } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(rpcRequest(payload));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ result: { state_root_hash: "abc" } });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe("http://185.170.112.40:7777/rpc");
    expect(init).toMatchObject({ method: "POST", body: payload, cache: "no-store" });
    expect(init.headers).toEqual({ accept: "application/json", "content-type": "application/json" });
  });

  it("rejects malformed requests without contacting the upstream", async () => {
    process.env.CASPER_NODE_RPC_URL = "http://rpc.internal/rpc";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(rpcRequest(JSON.stringify({ method: "chain_get_block" })));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unsafe upstream protocols", async () => {
    process.env.CASPER_NODE_RPC_URL = "file:///etc/passwd";

    const response = await POST(rpcRequest(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "chain_get_block" })));

    expect(response.status).toBe(503);
  });

  it("returns a stable gateway error when the upstream is unavailable", async () => {
    process.env.CASPER_NODE_RPC_URL = "http://rpc.internal/rpc";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));

    const response = await POST(rpcRequest(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "chain_get_block" })));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Casper RPC is unavailable" });
  });
});
