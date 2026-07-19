import { describe, expect, it } from "vitest";
import { isCanonicalRegistryEvent, parseLifecycleEvent } from "../server/integrations/casper-chain-sync";

describe("Casper Odra event decoding", () => {
  it("decodes the length-prefixed event name, invoice id, and account address", () => {
    const bytes =
      "79000000140000006576656e745f496e766f69636543726561746564" +
      "c59353855dc8e60c4473e84a8d93809e3c60c5e6c3f4b1df48b392b0d705cc79" +
      "00d0fbcba833a5bc6421de00c9b12936f43f92bcd8e5b336a0448612e7f2aeda70" +
      "d290c2bfa182b0fb1436a2cf9f3dfd1305e87349993c9ec66ccc18ca13a2f47d";

    expect(parseLifecycleEvent(bytes, 0)).toMatchObject({
      eventIndex: 0,
      eventName: "InvoiceCreated",
      invoiceIdHash: "0xc59353855dc8e60c4473e84a8d93809e3c60c5e6c3f4b1df48b392b0d705cc79",
      actorPublicKey: "account-hash-d0fbcba833a5bc6421de00c9b12936f43f92bcd8e5b336a0448612e7f2aeda70"
    });
  });

  it("rejects malformed event envelopes", () => {
    expect(() => parseLifecycleEvent("79000000", 0)).toThrow("truncated");
  });

  it("decodes the live InvoiceFunded event shape", () => {
    const bytes =
      "5b000000130000006576656e745f496e766f69636546756e646564" +
      "568ac4298874cf556d2618d1978424c91dda93706efdaac988dcf3c9cfb6c86e" +
      "00beea3ac6078ff20aa021121787353ae8b1fbdb4bf45e0e9c7ac790f6a00a9119" +
      "0208b3";
    expect(parseLifecycleEvent(bytes, 5)).toMatchObject({
      eventName: "InvoiceFunded",
      invoiceIdHash: "0x568ac4298874cf556d2618d1978424c91dda93706efdaac988dcf3c9cfb6c86e",
      actorPublicKey: "account-hash-beea3ac6078ff20aa021121787353ae8b1fbdb4bf45e0e9c7ac790f6a00a9119"
    });
  });

  it("excludes legacy Vault and Escrow event ranges from canonical invoice state", () => {
    expect(isCanonicalRegistryEvent(42)).toBe(true);
    expect(isCanonicalRegistryEvent(1_000_000_000)).toBe(false);
    expect(isCanonicalRegistryEvent(2_000_000_000)).toBe(false);
  });
});
