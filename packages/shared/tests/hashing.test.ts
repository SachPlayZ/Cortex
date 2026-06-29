import { describe, expect, it } from "vitest";
import { canonicalJson, hashJson, sha256Hex } from "../src/index.js";

describe("hashing helpers", () => {
  it("canonicalizes object keys deterministically", () => {
    const left = canonicalJson({ b: "2", a: { z: "9", y: "8" } });
    const right = canonicalJson({ a: { y: "8", z: "9" }, b: "2" });

    expect(left).toBe(right);
  });

  it("hashes JSON deterministically", () => {
    const left = hashJson({ invoice_id: "inv_1", amount: "1000" });
    const right = hashJson({ amount: "1000", invoice_id: "inv_1" });

    expect(left).toBe(right);
    expect(left).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it("hashes raw strings", () => {
    expect(sha256Hex("cortex")).toMatch(/^0x[a-f0-9]{64}$/);
  });
});
