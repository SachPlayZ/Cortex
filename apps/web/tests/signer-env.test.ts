import { afterEach, describe, expect, it } from "vitest";
import { normalizePrivateKeyPem } from "../server/integrations/casper-sdk";
import { hasServerSigner, requireServerSigner } from "../server/signer-env";

const names = [
  "AGENT_PRIVATE_KEY_PEM",
  "AGENT_PRIVATE_KEY_PATH",
  "SETTLEMENT_RELAYER_PRIVATE_KEY_PEM",
  "SETTLEMENT_RELAYER_PRIVATE_KEY_PATH"
] as const;

afterEach(() => {
  for (const name of names) delete process.env[name];
});

describe("server signer environment", () => {
  it("prefers inline PEM secrets for serverless deployments", () => {
    process.env.AGENT_PRIVATE_KEY_PEM = "-----BEGIN PRIVATE KEY-----\\nsecret\\n-----END PRIVATE KEY-----";
    process.env.AGENT_PRIVATE_KEY_PATH = "/tmp/agent.pem";

    expect(hasServerSigner("AGENT")).toBe(true);
    expect(requireServerSigner("AGENT", "testing")).toEqual({
      privateKeyPem: "-----BEGIN PRIVATE KEY-----\\nsecret\\n-----END PRIVATE KEY-----"
    });
  });

  it("keeps local file paths as a fallback", () => {
    process.env.SETTLEMENT_RELAYER_PRIVATE_KEY_PATH = "/tmp/relayer.pem";

    expect(requireServerSigner("SETTLEMENT_RELAYER", "testing")).toEqual({ keyPath: "/tmp/relayer.pem" });
  });

  it("normalizes escaped newlines from environment values", () => {
    expect(normalizePrivateKeyPem("  first\\nsecond  ")).toBe("first\nsecond");
  });
});
