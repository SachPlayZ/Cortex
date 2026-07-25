import { describe, expect, it } from "vitest";
import {
  bootstrapStatusId,
  casperDeploymentScope,
  isCanonicalRegistryEvent,
  mockUsdBalanceDictionaryKey,
  mockUsdUnitsToUsdCents,
  parseLifecycleEvent
} from "../server/integrations/casper-chain-sync";

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

  it("scopes bootstrap state and event cursors to the deployed package hashes", () => {
    const original = {
      registry: process.env.INVOICE_REGISTRY_PACKAGE_HASH,
      vault: process.env.FUNDING_VAULT_PACKAGE_HASH,
      escrow: process.env.REPAYMENT_ESCROW_PACKAGE_HASH
    };
    process.env.INVOICE_REGISTRY_PACKAGE_HASH = "hash-registry";
    process.env.FUNDING_VAULT_PACKAGE_HASH = "hash-vault";
    process.env.REPAYMENT_ESCROW_PACKAGE_HASH = "hash-escrow";

    try {
      expect(bootstrapStatusId()).toBe("invoice_registry_bootstrap:registry");
      expect(casperDeploymentScope()).toBe("registry:vault:escrow");
    } finally {
      restoreEnv("INVOICE_REGISTRY_PACKAGE_HASH", original.registry);
      restoreEnv("FUNDING_VAULT_PACKAGE_HASH", original.vault);
      restoreEnv("REPAYMENT_ESCROW_PACKAGE_HASH", original.escrow);
    }
  });

  it("derives the mUSDC balances dictionary item key (verified live against testnet)", () => {
    // account-hash-ea0b...bc84 held exactly 5,000,000,000 raw units (500,000.000000 mUSDC)
    // after a real on-chain mint during manual testing; this locks in that known-good pair.
    expect(mockUsdBalanceDictionaryKey("account-hash-ea0b32c46b9a7d6a4ee1f18d7b1d85784d26c6d24424f3caf93bb6a05dfcbc84")).toBe(
      "50629474b98b95fa74cfad1174834cea38d5a19327e88f87a637f1e801086aef"
    );
  });

  it("decodes the length-prefixed U256 CLValue.parsed array into USD cents", () => {
    expect(mockUsdUnitsToUsdCents([5, 0, 242, 5, 42, 1])).toBe("500000");
    expect(mockUsdUnitsToUsdCents([0])).toBe("0");
    expect(mockUsdUnitsToUsdCents([])).toBe("0");
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
