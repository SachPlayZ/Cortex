import type { CasperSigner } from "./integrations/casper-sdk";

export type ServerSignerName = "CASPER_ADMIN" | "CASPER_TREASURY" | "SETTLEMENT_RELAYER" | "AGENT";

export function hasServerSigner(name: ServerSignerName): boolean {
  return Boolean(readEnv(`${name}_PRIVATE_KEY_PEM`) || readEnv(`${name}_PRIVATE_KEY_PATH`));
}

export function requireServerSigner(name: ServerSignerName, purpose: string): CasperSigner {
  const privateKeyPem = readEnv(`${name}_PRIVATE_KEY_PEM`);
  if (privateKeyPem) return { privateKeyPem };

  const keyPath = readEnv(`${name}_PRIVATE_KEY_PATH`);
  if (keyPath) return { keyPath };

  throw new Error(`${name}_PRIVATE_KEY_PEM or ${name}_PRIVATE_KEY_PATH is required for ${purpose}`);
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}
