"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRightIcon, CheckCircle2Icon, RadioTowerIcon, WalletIcon } from "lucide-react";
import type { ReceivableView } from "../lib/finance";
import { shortAccount, useCasperWallet } from "./casper-wallet";
import { StatusPill } from "./status-pill";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Progress, ProgressLabel } from "./ui/progress";
import { Spinner } from "./ui/spinner";
import { cn } from "@/lib/utils";

type Props = {
  invoice: ReceivableView;
  compact?: boolean;
};

type PreparedAction = {
  entryPoint: string;
  transaction: unknown;
  transaction_hash: string;
  intent_id: string;
  expires_at: string;
};

type CasperHealth = {
  lifecycle_mode: "real" | "unavailable";
  bootstrap_completed: boolean;
  bootstrap: {
    agentRegistered: boolean;
    settlementRelayerRegistered: boolean;
    vaultLiquidityDeposited: boolean;
  };
};

const statusOrder = ["Created", "Scored", "Listed", "Funded", "RepaymentPending", "Repaid", "Settled"];

export function InvoiceLifecyclePanel({ invoice: initialInvoice, compact = false }: Props) {
  const wallet = useCasperWallet();
  const router = useRouter();
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [health, setHealth] = useState<CasperHealth | null>(null);
  const [invoice, setInvoice] = useState(initialInvoice);

  useEffect(() => setInvoice(initialInvoice), [initialInvoice]);

  useEffect(() => {
    void fetch("/api/admin/casper/health", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as CasperHealth | { error?: string };
        if (response.ok) setHealth(body as CasperHealth);
      })
      .catch(() => undefined);
  }, []);

  const actions = useMemo(() => {
    if (!wallet.isConnected) return [];
    if (wallet.role === "seller" && invoice.sellerAccount === wallet.accountHash) {
      if (!invoice.casperInvoiceExists && invoice.statusCasper === "Scored") {
        return [{ key: "mint", label: "Mint on Casper", route: "mint", confirmRoute: "mint/confirm" }];
      }
      if (invoice.casperInvoiceExists && invoice.statusCasper === "Scored") {
        return [{ key: "list", label: "List for funding", route: "list", confirmRoute: "list/confirm" }];
      }
      if (invoice.statusCasper === "RepaymentPending" && !invoice.cashoutDeployHash) {
        return [{ key: "cashout", label: "Withdraw advance", route: "cashout", confirmRoute: "cashout/confirm" }];
      }
    }
    if (wallet.role === "investor") {
      if (invoice.statusCasper === "Listed") {
        return [{ key: "fund", label: "Fund receivable", route: "fund", confirmRoute: "fund/confirm" }];
      }
      if (invoice.statusCasper === "Repaid" && invoice.investorAccount === wallet.accountHash) {
        return [{ key: "claim", label: "Claim repayment", route: "claim", confirmRoute: "claim/confirm" }];
      }
    }
    return [];
  }, [invoice, wallet.accountHash, wallet.isConnected, wallet.role]);

  async function runAction(route: string, confirmRoute: string, label: string) {
    setBusyAction(route);
    setError("");
    setMessage("");
    try {
      const prepareResponse = await fetch(`/api/invoices/${invoice.id}/${route}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          public_key_hex: wallet.publicKeyHex,
          account_hash: wallet.accountHash
        })
      });
      const preparedBody = (await prepareResponse.json()) as PreparedAction | { error?: string };
      if (!prepareResponse.ok || !("transaction" in preparedBody)) {
        throw new Error("error" in preparedBody ? preparedBody.error : `Unable to prepare ${label.toLowerCase()}`);
      }

      const submittedHash = await wallet.sendTransaction(preparedBody.transaction);
      const confirmResponse = await fetch(`/api/invoices/${invoice.id}/${confirmRoute}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intent_id: preparedBody.intent_id,
          deploy_hash: submittedHash
        })
      });
      const confirmBody = (await confirmResponse.json()) as { invoice?: ReceivableView; error?: string };
      if (!confirmResponse.ok) {
        throw new Error(confirmBody.error ?? `Unable to confirm ${label.toLowerCase()}`);
      }
      if (confirmBody.invoice) setInvoice(confirmBody.invoice);
      setMessage(`${label} confirmed on Casper.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : `${label} failed`);
    } finally {
      setBusyAction("");
    }
  }

  const steps = [
    ["Created", invoice.createDeployHash],
    ["Scored", invoice.scoreDeployHash],
    ["Listed", invoice.listDeployHash],
    ["Funded", invoice.fundDeployHash],
    ["RepaymentPending", invoice.cashoutDeployHash ?? invoice.fundDeployHash],
    ["Repaid", invoice.lastRepaymentDeployHash],
    ["Settled", invoice.claimDeployHash]
  ] as const;
  const currentIndex = Math.max(0, statusOrder.indexOf(invoice.statusCasper));
  const progress = Math.round(((currentIndex + 1) / statusOrder.length) * 100);

  return (
    <Card size={compact ? "sm" : "default"}>
      <CardHeader className="gap-4 md:grid-cols-[1fr_auto]">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-muted text-primary">
              <RadioTowerIcon />
            </span>
            <StatusPill status={invoice.statusCasper} />
          </div>
          <CardTitle className="text-3xl tracking-normal">Casper lifecycle</CardTitle>
          <CardDescription>Financial state is driven by deploy-confirmed transitions.</CardDescription>
        </div>
        {health ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm">
            <span className="text-muted-foreground">Lifecycle mode</span>
            <div className="flex items-center gap-2">
              <Badge variant={health.lifecycle_mode === "real" ? "default" : "destructive"}>{health.lifecycle_mode}</Badge>
              <Badge variant={health.bootstrap_completed ? "secondary" : "outline"}>
                {health.bootstrap_completed ? "bootstrapped" : "needs bootstrap"}
              </Badge>
            </div>
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <Progress value={progress}>
          <ProgressLabel>Lifecycle progress</ProgressLabel>
          <span className="ml-auto text-sm text-muted-foreground tabular-nums">{progress}%</span>
        </Progress>

        <div className="grid gap-3 md:grid-cols-7">
          {steps.map(([label, deployHash], index) => {
            const isPast = index < currentIndex;
            const isCurrent = invoice.statusCasper === label;
            const isDone = isPast || isCurrent || Boolean(deployHash);
            return (
              <div key={label} className={cn("min-w-0 rounded-lg border border-border bg-muted/50 p-3", isCurrent && "border-primary/50 bg-primary/10")}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Badge variant={isDone ? "default" : "outline"}>
                    {isDone ? <CheckCircle2Icon data-icon="inline-start" /> : index + 1}
                  </Badge>
                  {isCurrent ? <Badge variant="secondary">current</Badge> : null}
                </div>
                <div className="truncate text-sm font-medium text-foreground">{label}</div>
                <div className="mt-2 min-h-8 break-all font-mono text-xs leading-4 text-muted-foreground">
                  {deployHash ?? "Awaiting deploy"}
                </div>
              </div>
            );
          })}
        </div>

        {wallet.isConnected ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
            <WalletIcon />
            <span className="text-sm text-muted-foreground">Connected {wallet.role} wallet</span>
            <span className="break-all font-mono text-xs text-foreground">{shortAccount(wallet.accountHash)}</span>
          </div>
        ) : null}

        {health && !health.bootstrap_completed ? (
          <Alert>
            <AlertTitle>Bootstrap incomplete</AlertTitle>
            <AlertDescription>
              Missing:
              {!health.bootstrap.agentRegistered ? " agent registration" : ""}
              {!health.bootstrap.settlementRelayerRegistered ? " settlement relayer registration" : ""}
              {!health.bootstrap.vaultLiquidityDeposited ? " vault liquidity" : ""}
            </AlertDescription>
          </Alert>
        ) : null}

        {message ? (
          <Alert>
            <AlertTitle>Transaction confirmed</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Transaction failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>

      <CardFooter className="flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        {actions.length > 0 ? (
          <div className="flex flex-wrap gap-2.5">
            {actions.map((action) => (
              <Button
                key={action.key}
                size="sm"
                disabled={busyAction.length > 0}
                onClick={() => void runAction(action.route, action.confirmRoute, action.label)}
              >
                {busyAction === action.route ? <Spinner data-icon="inline-start" /> : <ArrowUpRightIcon data-icon="inline-start" />}
                {busyAction === action.route ? "Submitting" : action.label}
              </Button>
            ))}
          </div>
        ) : (
          <p className="m-0 text-sm leading-6 text-muted-foreground">
            {wallet.isConnected
              ? "No Casper action is available for this wallet and status yet."
              : "Connect the seller or investor wallet to sign the next Casper transaction."}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" nativeButton={false} render={<a href={`/buyer/pay/${invoice.id}`} />}>
            Buyer payment page
            <ArrowUpRightIcon data-icon="inline-end" />
          </Button>
          {invoice.statusLastSyncedAt ? (
            <span className="text-xs text-muted-foreground">Synced {new Date(invoice.statusLastSyncedAt).toLocaleString()}</span>
          ) : null}
        </div>
      </CardFooter>
    </Card>
  );
}
