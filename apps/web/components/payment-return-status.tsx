"use client";

import { useEffect, useState } from "react";
import { ArrowRightIcon, CheckCircle2Icon, XCircleIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { buttonVariants } from "./ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Progress, ProgressLabel } from "./ui/progress";
import { Spinner } from "./ui/spinner";
import { cn } from "@/lib/utils";

type PaymentStatus = {
  payment_status: "pending_webhook" | "succeeded";
  casper_status: string;
  casper_deploy_hash?: string | null;
  checkout_url?: string | null;
  status_last_synced_at?: string | null;
};

export function PaymentReturnStatus({ invoiceId }: { invoiceId: string }) {
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch(`/api/payments/status/${invoiceId}`, { cache: "no-store" });
        const body = (await response.json()) as PaymentStatus | { error?: string };
        if (!response.ok) throw new Error("error" in body ? body.error : "Payment status unavailable");
        if (!cancelled) {
          setStatus(body as PaymentStatus);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Payment status unavailable");
      }
    }

    void poll();
    const interval = window.setInterval(() => void poll(), 3_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [invoiceId]);

  if (error) {
    return (
      <PaymentResultLayout>
        <ResultIcon tone="bad" />
        <CardTitle className="text-4xl tracking-normal md:text-6xl">Payment status unavailable</CardTitle>
        <CardDescription className="max-w-xl text-base leading-7">{error}</CardDescription>
        <a href={`/buyer/pay/${invoiceId}`} className={cn(buttonVariants())}>
          Retry paying
          <ArrowRightIcon data-icon="inline-end" />
        </a>
      </PaymentResultLayout>
    );
  }

  if (status?.payment_status === "succeeded") {
    return (
      <PaymentResultLayout>
        <ResultIcon tone="good" />
        <CardTitle className="text-4xl tracking-normal md:text-6xl">Webhook verified. Casper updated.</CardTitle>
        <CardDescription className="max-w-xl text-base leading-7">
          Cortex has received webhook-confirmed payment settlement. The investor can continue to claim when their wallet is connected.
        </CardDescription>
        {status.casper_deploy_hash ? (
          <Alert>
            <AlertTitle>Casper repayment deploy</AlertTitle>
            <AlertDescription className="break-all font-mono text-xs">{status.casper_deploy_hash}</AlertDescription>
          </Alert>
        ) : null}
      </PaymentResultLayout>
    );
  }

  return (
    <PaymentResultLayout>
      <div className="grid size-20 place-items-center rounded-full border border-white/10 bg-primary/10 text-primary">
        <Spinner />
      </div>
      <CardTitle className="text-4xl tracking-normal md:text-6xl">Waiting for verified settlement</CardTitle>
      <CardDescription className="max-w-xl text-base leading-7">
        Dodo returned you to Cortex. The invoice stays pending until the signed webhook is verified and the settlement
        relayer records repayment on Casper.
      </CardDescription>
      <div className="w-full max-w-xl">
        <Progress value={status?.casper_status === "Repaid" ? 84 : 52}>
          <ProgressLabel>Webhook and Casper settlement</ProgressLabel>
          <span className="ml-auto text-sm text-muted-foreground">{status?.casper_status ?? "checking"}</span>
        </Progress>
      </div>
      {status?.status_last_synced_at ? (
        <p className="m-0 text-sm text-muted-foreground">Last reconciled: {new Date(status.status_last_synced_at).toLocaleString()}</p>
      ) : null}
    </PaymentResultLayout>
  );
}

function PaymentResultLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh px-5 pb-24 pt-32 md:px-8 md:pt-36">
      <Card className="mx-auto min-h-[62dvh] max-w-4xl items-center justify-center rounded-2xl border-white/10 bg-card/72 text-center">
        <CardHeader className="items-center gap-6">
          {children}
        </CardHeader>
      </Card>
    </div>
  );
}

function ResultIcon({ tone }: { tone: "good" | "bad" }) {
  const Icon = tone === "good" ? CheckCircle2Icon : XCircleIcon;
  return (
    <div className={cn("grid size-20 place-items-center rounded-full border border-white/10", tone === "good" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive")}>
      <Icon />
    </div>
  );
}
