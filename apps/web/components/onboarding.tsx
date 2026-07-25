"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRightIcon, LandmarkIcon, ReceiptTextIcon, ShieldCheckIcon } from "lucide-react";
import { useCasperWallet } from "./casper-wallet";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Button } from "./ui/button";
import { Spinner } from "./ui/spinner";

type OnboardingRole = "seller" | "investor";

const roleCopy = {
  seller: {
    eyebrow: "I’m a seller",
    title: "Turn verified evidence into working capital.",
    body: "Upload an invoice, review the agent-priced offer, then sign the receivable listing from the wallet that owns it.",
    cta: "Connect seller wallet",
    Icon: ReceiptTextIcon
  },
  investor: {
    eyebrow: "I’m an investor",
    title: "Fund short-duration, legible receivables.",
    body: "Inspect deterministic terms, fund one invoice, and claim only after Casper confirms verified repayment.",
    cta: "Connect investor wallet",
    Icon: LandmarkIcon
  }
};

export function OnboardingPanel() {
  const router = useRouter();
  const wallet = useCasperWallet();
  const [error, setError] = useState("");
  const [pendingRole, setPendingRole] = useState<OnboardingRole | null>(null);

  useEffect(() => {
    if (!wallet.isConnected || !wallet.role) return;
    router.push(wallet.role === "seller" ? "/seller/upload" : "/investor");
  }, [router, wallet.isConnected, wallet.role]);

  async function start(role: OnboardingRole) {
    setError("");
    setPendingRole(role);
    try {
      await wallet.connect(role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet connection failed");
      setPendingRole(null);
    }
  }

  return (
    <div className="border border-border bg-panel">
      <div className="grid lg:grid-cols-2">
        {(Object.keys(roleCopy) as OnboardingRole[]).map((role, index) => {
          const copy = roleCopy[role];
          const Icon = copy.Icon;
          const isPending = pendingRole === role;
          return (
            <section key={role} className={`flex min-h-[22rem] flex-col items-start p-6 sm:p-9 ${index === 0 ? 'border-b border-border lg:border-b-0 lg:border-r' : ''}`}>
              <div className={`grid size-12 place-items-center rounded-full border ${role === 'seller' ? 'border-primary text-primary' : 'border-good text-good'}`}>
                <Icon className="size-5" />
              </div>
              <span className="mt-6 text-sm font-medium text-foreground">{copy.eyebrow}</span>
              <h3 className="mb-0 mt-3 max-w-[20ch] text-2xl font-medium leading-tight tracking-[-0.03em] sm:text-3xl">{copy.title}</h3>
              <p className="mb-0 mt-4 max-w-lg text-sm leading-6 text-muted-foreground">{copy.body}</p>
              <Button
                type="button"
                size="lg"
                variant={role === "seller" ? "default" : "secondary"}
                className={`mt-auto w-full sm:w-auto ${role === 'investor' ? 'bg-good text-background hover:bg-good/80' : ''}`}
                onClick={() => void start(role)}
                disabled={pendingRole !== null}
              >
                {isPending ? <Spinner data-icon="inline-start" /> : <ArrowRightIcon data-icon="inline-start" />}
                {isPending ? "Connecting" : copy.cta}
              </Button>
              <span className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheckIcon className="size-4 text-good" /> No private invoice data goes on-chain</span>
            </section>
          );
        })}
      </div>
      {error ? (
        <div className="border-t border-border p-5">
          <Alert variant="destructive">
            <AlertTitle>Wallet connection failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      ) : null}
    </div>
  );
}
