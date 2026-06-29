"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, buttonVariants } from "./ui/button";
import { cn } from "@/lib/utils";

type CsprClickAccount = {
  public_key?: string;
  publicKey?: string;
  account_hash?: string;
  accountHash?: string;
};

type CsprClickEvent = {
  detail?: {
    account?: CsprClickAccount;
  };
};

type CsprClickSDK = {
  signIn: () => void;
  signOut: () => void;
  disconnect: () => void;
  switchAccount?: () => void;
  getActiveAccount?: () => CsprClickAccount | null | Promise<CsprClickAccount | null>;
  on: (eventName: string, handler: (event: CsprClickEvent) => void | Promise<void>) => void;
  off: (eventName: string, handler: (event: CsprClickEvent) => void | Promise<void>) => void;
  send?: (
    transactionJson: unknown,
    options?: { signingPublicKey?: string; onStatusUpdate?: (status: unknown) => void }
  ) => Promise<string | { transactionHash?: string; hash?: string }>;
};

type WalletRole = "seller" | "investor";

type CasperWalletState = {
  accountHash: string;
  isConnected: boolean;
  isSdkReady: boolean;
  role: WalletRole | null;
  connect: (role?: WalletRole) => Promise<void>;
  disconnect: () => Promise<void>;
  sendTransaction: (
    transactionJson: unknown,
    onStatusUpdate?: (status: unknown) => void
  ) => Promise<string>;
};

const STORAGE_KEY = "cortex.casperWallet";
const ROLE_KEY = "cortex.walletRole";
const CSPRCLICK_SCRIPT_ID = "csprclick-client-runtime";
const CSPRCLICK_UI_CONTAINER_ID = "csprclick-ui";
const CSPRCLICK_SCRIPT_SRC =
  process.env.NEXT_PUBLIC_CSPRCLICK_SCRIPT_SRC ?? "https://cdn.cspr.click/ui/v1.9.0/csprclick-client-1.9.0.js";

const CasperWalletContext = createContext<CasperWalletState | undefined>(undefined);

declare global {
  interface Window {
    csprclick?: CsprClickSDK;
    clickSDKOptions?: Record<string, unknown>;
    clickUIOptions?: Record<string, unknown>;
  }
}

export function CasperWalletProvider({ children }: { children: ReactNode }) {
  const [accountHash, setAccountHash] = useState("");
  const [isSdkReady, setIsSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState("");
  const [role, setRole] = useState<WalletRole | null>(null);

  useEffect(() => {
    setAccountHash(localStorage.getItem(STORAGE_KEY) ?? "");
    const storedRole = localStorage.getItem(ROLE_KEY);
    setRole(storedRole === "seller" || storedRole === "investor" ? storedRole : null);
  }, []);

  const persistAccount = useCallback((account: string, nextRole?: WalletRole | null) => {
    setAccountHash(account);
    if (account) {
      localStorage.setItem(STORAGE_KEY, account);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    if (nextRole) {
      setRole(nextRole);
      localStorage.setItem(ROLE_KEY, nextRole);
    } else if (nextRole === null) {
      setRole(null);
      localStorage.removeItem(ROLE_KEY);
    }
  }, []);

  useEffect(() => {
    let activeSdk: CsprClickSDK | undefined;

    async function syncActiveAccount(event?: CsprClickEvent) {
      const account = (await window.csprclick?.getActiveAccount?.()) ?? event?.detail?.account ?? null;
      persistAccount(readAccountPublicKey(account), undefined);
    }

    function clearActiveAccount() {
      persistAccount("", null);
    }

    function handleLoaded() {
      activeSdk = window.csprclick;
      if (!activeSdk) return;
      setIsSdkReady(true);
      setSdkError("");
      activeSdk.on("csprclick:signed_in", syncActiveAccount);
      activeSdk.on("csprclick:switched_account", syncActiveAccount);
      activeSdk.on("csprclick:signed_out", clearActiveAccount);
      activeSdk.on("csprclick:disconnected", clearActiveAccount);
      void syncActiveAccount();
    }

    window.clickSDKOptions = {
      appName: "Cortex",
      appId: process.env.NEXT_PUBLIC_CSPRCLICK_APP_ID ?? "csprclick-template",
      contentMode: "iframe",
      providers: ["casper-wallet", "ledger", "walletconnect", "metamask-snap"]
    };
    window.clickUIOptions = {
      uiContainer: CSPRCLICK_UI_CONTAINER_ID,
      rootAppElement: "#cortex-root",
      defaultTheme: "dark",
      showTopBar: false,
      accountMenuItems: []
    };

    window.addEventListener("csprclick:loaded", handleLoaded);

    if (window.csprclick) {
      handleLoaded();
    } else if (!document.getElementById(CSPRCLICK_SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = CSPRCLICK_SCRIPT_ID;
      script.defer = true;
      script.src = CSPRCLICK_SCRIPT_SRC;
      script.onerror = () => setSdkError("CSPR.click SDK failed to load.");
      document.head.appendChild(script);
    }

    return () => {
      window.removeEventListener("csprclick:loaded", handleLoaded);
      activeSdk?.off("csprclick:signed_in", syncActiveAccount);
      activeSdk?.off("csprclick:switched_account", syncActiveAccount);
      activeSdk?.off("csprclick:signed_out", clearActiveAccount);
      activeSdk?.off("csprclick:disconnected", clearActiveAccount);
    };
  }, [persistAccount]);

  const connect = useCallback(async (nextRole?: WalletRole) => {
    if (nextRole) {
      setRole(nextRole);
      localStorage.setItem(ROLE_KEY, nextRole);
    }
    const sdk = window.csprclick;
    if (!sdk || !isSdkReady) {
      throw new Error(sdkError || "CSPR.click is still loading. Try again in a moment.");
    }
    sdk.signIn();
  }, [isSdkReady, sdkError]);

  const disconnect = useCallback(async () => {
    window.csprclick?.disconnect();
    persistAccount("", null);
  }, [persistAccount]);

  const sendTransaction = useCallback(
    async (transactionJson: unknown, onStatusUpdate?: (status: unknown) => void) => {
      const sdk = window.csprclick;
      if (!sdk?.send || !accountHash) {
        throw new Error("Connect CSPR.click before signing Casper transactions.");
      }
      const result = await sdk.send(transactionJson, {
        signingPublicKey: accountHash.toLowerCase(),
        ...(onStatusUpdate ? { onStatusUpdate } : {})
      });
      if (typeof result === "string") return result;
      return result.transactionHash ?? result.hash ?? "";
    },
    [accountHash]
  );

  const value = useMemo<CasperWalletState>(
    () => ({
      accountHash,
      isConnected: Boolean(accountHash),
      isSdkReady,
      role,
      connect,
      disconnect,
      sendTransaction
    }),
    [accountHash, connect, disconnect, isSdkReady, role, sendTransaction]
  );

  return (
    <CasperWalletContext.Provider value={value}>
      <div id={CSPRCLICK_UI_CONTAINER_ID} />
      {children}
    </CasperWalletContext.Provider>
  );
}

export function useCasperWallet() {
  const value = useContext(CasperWalletContext);
  if (!value) {
    throw new Error("useCasperWallet must be used inside CasperWalletProvider");
  }
  return value;
}

export function ConnectWalletButton({ role, compact = false }: { role?: WalletRole; compact?: boolean }) {
  const wallet = useCasperWallet();
  const [error, setError] = useState("");

  async function connect() {
    setError("");
    try {
      await wallet.connect(role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet connection failed");
    }
  }

  if (wallet.isConnected) {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "mt-2"}`}>
        <span className="size-2 rounded-full bg-good shadow-[0_0_18px_rgba(74,222,128,0.7)]" />
        <span className="rounded-full border border-line bg-[rgba(24,24,28,0.88)] px-2.5 py-1.5 text-xs font-semibold text-ink">
          {shortAccount(wallet.accountHash)}
        </span>
        {wallet.role ? (
          <span className="rounded-full border border-[rgba(183,255,90,0.22)] px-2 py-1 text-[11px] uppercase tracking-widest text-accent-2">
            {wallet.role}
          </span>
        ) : null}
        <Button variant="ghost" size="xs" onClick={wallet.disconnect}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "mt-2"}`}>
      <Button onClick={connect} size="sm">
        {wallet.isSdkReady ? "Connect with CSPR.click" : "Loading CSPR.click..."}
      </Button>
      {error ? <span className="max-w-[280px] text-xs text-bad">{error}</span> : null}
    </div>
  );
}

export function WalletGate({
  role,
  title,
  children
}: {
  role: WalletRole;
  title: string;
  children: ReactNode;
}) {
  const wallet = useCasperWallet();

  if (!wallet.isConnected || wallet.role !== role) {
    return (
      <section className="mx-auto my-10 grid max-w-[720px] gap-3.5 rounded-[10px] border border-line bg-gradient-to-b from-[rgba(24,24,28,0.96)] to-[rgba(17,17,22,0.96)] p-6">
        <span className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">
          {role} wallet required
        </span>
        <h2 className="text-3xl font-bold tracking-tight text-ink">{title}</h2>
        <p className="text-xs leading-relaxed text-ink-muted">
          Cortex ties invoices, funding, and claims to the connected Casper account. Buyer repayment pages stay wallet-free
          because clients pay fiat through Dodo.
        </p>
        <ConnectWalletButton role={role} />
      </section>
    );
  }

  return <>{children}</>;
}

export function shortAccount(account: string): string {
  if (account.length <= 22) return account;
  return `${account.slice(0, 10)}...${account.slice(-8)}`;
}

function readAccountPublicKey(account: CsprClickAccount | null): string {
  return account?.public_key ?? account?.publicKey ?? account?.account_hash ?? account?.accountHash ?? "";
}
