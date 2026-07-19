import { describe, expect, it } from "vitest";
import { readStoredWalletIdentity, readWalletIdentity, resolveCsprClickTransactionHash } from "../lib/casper-wallet-identity";

const publicKey = "020344aed50809cabf417e89f51fc71fab442c5564cb8aa1ee2cff57d6e4a6c927cb";
const accountHash = "account-hash-d0fbcba833a5bc6421de00c9b12936f43f92bcd8e5b336a0448612e7f2aeda70";

describe("CSPR.click wallet identity", () => {
  it("derives the Casper account hash from the official public_key account shape", () => {
    expect(readWalletIdentity({ public_key: publicKey })).toEqual({ publicKeyHex: publicKey, accountHash });
  });

  it("rejects malformed persisted identities", () => {
    expect(readStoredWalletIdentity('{"publicKeyHex":"bad","accountHash":"account-hash-fake"}')).toEqual({
      publicKeyHex: "",
      accountHash: ""
    });
  });

  it("accepts both CSPR.click transaction result hash variants", () => {
    expect(resolveCsprClickTransactionHash({ transactionHash: "transaction-1" })).toBe("transaction-1");
    expect(resolveCsprClickTransactionHash({ deployHash: "deploy-1" })).toBe("deploy-1");
  });

  it("fails closed for cancellation, provider errors, and missing hashes", () => {
    expect(() => resolveCsprClickTransactionHash({ cancelled: true })).toThrow("cancelled");
    expect(() => resolveCsprClickTransactionHash({ error: "rejected" })).toThrow("rejected");
    expect(() => resolveCsprClickTransactionHash({})).toThrow("transaction hash");
  });
});
