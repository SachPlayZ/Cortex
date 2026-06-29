"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

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
      <div className={compact ? "walletCompact" : "walletPanel"}>
        <span className="walletDot" />
        <span className="walletAddress">{shortAccount(wallet.accountHash)}</span>
        {wallet.role ? <span className="walletRole">{wallet.role}</span> : null}
        <button className="ghostButton" type="button" onClick={wallet.disconnect}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className={compact ? "walletCompact" : "walletPanel"}>
      <button className="primary" type="button" onClick={connect}>
        {wallet.isSdkReady ? "Connect with CSPR.click" : "Loading CSPR.click..."}
      </button>
      {error ? <span className="walletError">{error}</span> : null}
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
      <section className="panel walletGate">
        <span className="label">{role} wallet required</span>
        <h2>{title}</h2>
        <p className="fineprint">
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
