import { PublicKey } from "casper-js-sdk";

export type StoredWalletIdentity = {
  publicKeyHex: string;
  accountHash: string;
};

export type CsprClickSendResult = {
  cancelled?: boolean;
  deployHash?: string | null;
  transactionHash?: string | null;
  error?: string | null;
};

export function resolveCsprClickTransactionHash(result: CsprClickSendResult | undefined): string {
  if (!result) throw new Error("CSPR.click returned no transaction result.");
  if (result.cancelled) throw new Error("Transaction signing cancelled.");
  if (result.error) throw new Error(`CSPR.click transaction failed: ${result.error}`);
  const transactionHash = result.transactionHash ?? result.deployHash;
  if (!transactionHash) throw new Error("CSPR.click did not return a transaction hash.");
  return transactionHash;
}

export function readWalletIdentity(account: { public_key?: string; publicKey?: string } | null): StoredWalletIdentity {
  const publicKeyHex = account?.public_key ?? account?.publicKey ?? "";
  if (!publicKeyHex) return emptyIdentity();
  try {
    return { publicKeyHex, accountHash: PublicKey.fromHex(publicKeyHex).accountHash().toPrefixedString() };
  } catch {
    return emptyIdentity();
  }
}

export function readStoredWalletIdentity(value: string | null): StoredWalletIdentity {
  if (!value) return emptyIdentity();
  try {
    const parsed = JSON.parse(value) as Partial<StoredWalletIdentity>;
    if (typeof parsed.publicKeyHex === "string" && typeof parsed.accountHash === "string") {
      const derived = readWalletIdentity({ public_key: parsed.publicKeyHex });
      return derived.accountHash === parsed.accountHash ? derived : emptyIdentity();
    }
  } catch {
    // Backward compatibility with the old single-public-key storage shape.
  }
  return readWalletIdentity({ public_key: value });
}

function emptyIdentity(): StoredWalletIdentity {
  return { publicKeyHex: "", accountHash: "" };
}
