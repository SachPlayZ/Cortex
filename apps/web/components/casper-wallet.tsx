"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LockKeyholeIcon, WalletIcon } from "lucide-react";
import { readStoredWalletIdentity, readWalletIdentity, resolveCsprClickTransactionHash, type StoredWalletIdentity } from "../lib/casper-wallet-identity";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Skeleton } from "./ui/skeleton";
import { cn } from "@/lib/utils";

type CsprClickAccount = {
  public_key?: string;
  publicKey?: string;
};

type CsprClickEvent = {
  account?: CsprClickAccount;
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
    signingPublicKey: string,
    onStatusUpdate?: (status: string, data: unknown) => void
  ) => Promise<
    | {
        cancelled?: boolean;
        deployHash?: string | null;
        transactionHash?: string | null;
        error?: string | null;
        errorData?: unknown;
      }
    | undefined
  >;
};

type WalletRole = "seller" | "investor";

type CasperWalletState = {
  publicKeyHex: string;
  accountHash: string;
  isConnected: boolean;
  isSdkReady: boolean;
  isInitializing: boolean;
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
  process.env.NEXT_PUBLIC_CSPRCLICK_SCRIPT_SRC ?? "https://cdn.cspr.click/ui/v1.12.0/csprclick-client-1.12.0.js";
const CSPRCLICK_CHAIN_NAME = process.env.NEXT_PUBLIC_CASPER_CHAIN_NAME ?? "casper-test";
const CSPRCLICK_NODE_RPC_URL =
  process.env.NEXT_PUBLIC_CASPER_NODE_RPC_URL ?? "https://node.testnet.cspr.cloud/rpc";

const CasperWalletContext = createContext<CasperWalletState | undefined>(undefined);

declare global {
  interface Window {
    csprclick?: CsprClickSDK;
    clickSDKOptions?: Record<string, unknown>;
    clickUIOptions?: Record<string, unknown>;
  }
}

export function CasperWalletProvider({ children }: { children: ReactNode }) {
  const [publicKeyHex, setPublicKeyHex] = useState("");
  const [accountHash, setAccountHash] = useState("");
  const [isSdkReady, setIsSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState("");
  const [role, setRole] = useState<WalletRole | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const storedIdentity = readStoredWalletIdentity(localStorage.getItem(STORAGE_KEY));
    setPublicKeyHex(storedIdentity.publicKeyHex);
    setAccountHash(storedIdentity.accountHash);
    const storedRole = localStorage.getItem(ROLE_KEY);
    setRole(storedRole === "seller" || storedRole === "investor" ? storedRole : null);
    setIsInitializing(false);
  }, []);

  const persistAccount = useCallback((identity: StoredWalletIdentity, nextRole?: WalletRole | null) => {
    setPublicKeyHex(identity.publicKeyHex);
    setAccountHash(identity.accountHash);
    if (identity.publicKeyHex && identity.accountHash) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
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
      const account =
        (await window.csprclick?.getActiveAccount?.()) ??
        event?.account ??
        event?.detail?.account ??
        null;
      const identity = readWalletIdentity(account);
      if (identity.publicKeyHex && identity.accountHash) {
        persistAccount(identity, undefined);
      } else if (event) {
        // Only clear the session if we explicitly received an event indicating sign out or account switch to null.
        persistAccount({ publicKeyHex: "", accountHash: "" }, null);
      }
    }

    function clearActiveAccount() {
      persistAccount({ publicKeyHex: "", accountHash: "" }, null);
    }

    function handleLoaded() {
      activeSdk = window.csprclick;
      if (!activeSdk) return;
      setIsSdkReady(true);
      setSdkError("");
      activeSdk.on("csprclick:signed_in", syncActiveAccount);
      activeSdk.on("csprclick:switched_account", syncActiveAccount);
      activeSdk.on("csprclick:unsolicited_account_change", syncActiveAccount);
      activeSdk.on("csprclick:signed_out", clearActiveAccount);
      activeSdk.on("csprclick:disconnected", clearActiveAccount);
      void syncActiveAccount();
    }

    window.clickSDKOptions = {
      appName: "Cortex",
      appId: process.env.NEXT_PUBLIC_CSPRCLICK_APP_ID ?? "csprclick-template",
      chainName: CSPRCLICK_CHAIN_NAME,
      casperNode: CSPRCLICK_NODE_RPC_URL,
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
      activeSdk?.off("csprclick:unsolicited_account_change", syncActiveAccount);
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
    persistAccount({ publicKeyHex: "", accountHash: "" }, null);
  }, [persistAccount]);

  const sendTransaction = useCallback(
    async (transactionJson: unknown, onStatusUpdate?: (status: unknown) => void) => {
      const sdk = window.csprclick;
      if (!sdk?.send || !publicKeyHex || !accountHash) {
        throw new Error("Connect CSPR.click before signing Casper transactions.");
      }
      const result = await sdk.send(
        transactionJson,
        publicKeyHex.toLowerCase(),
        onStatusUpdate ? (status, data) => onStatusUpdate({ status, data }) : undefined
      );
      return resolveCsprClickTransactionHash(result);
    },
    [accountHash, publicKeyHex]
  );

  const value = useMemo<CasperWalletState>(
    () => ({
      publicKeyHex,
      accountHash,
      isConnected: Boolean(publicKeyHex && accountHash),
      isSdkReady,
      isInitializing,
      role,
      connect,
      disconnect,
      sendTransaction
    }),
    [accountHash, connect, disconnect, isInitializing, isSdkReady, publicKeyHex, role, sendTransaction]
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
      <div className={cn("flex flex-wrap items-center gap-2", !compact && "mt-2")}>
        <Badge><WalletIcon data-icon="inline-start" />{shortAccount(wallet.accountHash)}</Badge>
        {wallet.role ? <Badge variant="outline">{wallet.role}</Badge> : null}
        <Button variant="ghost" size="xs" onClick={wallet.disconnect}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", !compact && "mt-2")}>
      <Button onClick={connect} size="sm">
        {wallet.isSdkReady ? "Connect with CSPR.click" : "Loading CSPR.click..."}
      </Button>
      {error ? <Alert variant="destructive" className="max-w-sm"><AlertTitle>Connection failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
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

  if (wallet.isInitializing) {
    return (
      <div className="min-h-dvh px-5 pb-24 pt-32 md:px-8 md:pt-36">
        <Card className="mx-auto max-w-3xl">
          <CardHeader>
            <div className="mb-3 grid size-11 place-items-center rounded-lg bg-muted text-primary">
              <WalletIcon />
            </div>
            <CardTitle className="text-2xl">Loading wallet session</CardTitle>
            <CardDescription>Checking the local CSPR.click account state.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Skeleton className="h-10" />
            <Skeleton className="h-10 w-2/3" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!wallet.isConnected || wallet.role !== role) {
    return (
      <div className="min-h-dvh px-5 pb-24 pt-32 md:px-8 md:pt-36">
        <Card className="mx-auto max-w-3xl">
          <CardHeader>
            <div className="mb-3 grid size-11 place-items-center rounded-lg bg-muted text-primary">
              <LockKeyholeIcon />
            </div>
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription className="leading-6">
              Cortex ties invoices, funding, and claims to the connected Casper account. Buyer repayment pages stay
              wallet-free because clients pay fiat through Dodo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConnectWalletButton role={role} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

export function shortAccount(account: string): string {
  if (account.length <= 22) return account;
  return `${account.slice(0, 10)}...${account.slice(-8)}`;
}
