"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRightIcon, LandmarkIcon, ReceiptTextIcon } from "lucide-react";
import { useCasperWallet } from "./casper-wallet";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "./ui/card";
import { Spinner } from "./ui/spinner";

type OnboardingRole = "seller" | "investor";

const roleCards = [
  {
    role: "seller" as const,
    title: "Freelancer console",
    body: "Upload evidence, review underwriting, mint and list the receivable, then generate a hosted Dodo payment link after funding.",
    cta: "Connect as freelancer",
    icon: ReceiptTextIcon
  },
  {
    role: "investor" as const,
    title: "Investor market",
    body: "Inspect risk terms, fund one listed receivable, track webhook-confirmed repayment, and claim after Casper settlement.",
    cta: "Connect as investor",
    icon: LandmarkIcon
  }
];

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
    <section className="grid gap-6 rounded-[28px] border border-white/10 bg-card/72 p-4 shadow-[0_34px_120px_rgba(0,0,0,0.3)] backdrop-blur md:grid-cols-[0.78fr_1.22fr] md:p-6">
      <div className="flex min-h-[360px] flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_20%_0%,rgba(217,255,111,0.2),transparent_18rem),rgba(255,255,255,0.035)] p-6">
        <div className="flex flex-col gap-5">
          <Badge variant="secondary" className="w-fit">Wallet scoped</Badge>
          <h2 className="max-w-lg text-4xl font-semibold leading-[0.98] tracking-normal text-foreground md:text-5xl">
            Choose the account that owns the next action.
          </h2>
          <p className="max-w-md text-sm leading-6 text-muted-foreground">
            Cortex does not show generic dashboards. Your connected Casper wallet opens the workspace that can legally
            sign the next transaction.
          </p>
        </div>
        <div className="mt-10 grid gap-3 text-sm text-muted-foreground">
          <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
            <span>Seller signs mint and list</span>
            <span className="text-primary">Casper</span>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
            <span>Investor signs fund and claim</span>
            <span className="text-primary">Casper</span>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
            <span>Buyer pays without wallet</span>
            <span className="text-primary">Dodo</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {roleCards.map((card) => {
          const Icon = card.icon;
          const isPending = pendingRole === card.role;
          return (
            <Card key={card.role} className="group rounded-2xl border-white/10 bg-background/54 transition-colors hover:bg-background/78">
              <CardHeader>
                <div className="mb-5 grid size-11 place-items-center rounded-full border border-white/10 bg-primary/10 text-primary transition-transform duration-700 ease-out group-hover:scale-105">
                  <Icon />
                </div>
                <CardTitle className="text-3xl tracking-normal">{card.title}</CardTitle>
                <CardDescription className="leading-6">{card.body}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.035] p-3 text-sm text-muted-foreground">
                  <span>Evidence hash visible</span>
                  <span>Deploy hashes visible</span>
                  <span>Payment redirect never marks paid</span>
                </div>
              </CardContent>
              <CardFooter>
                <Button type="button" onClick={() => void start(card.role)} disabled={pendingRole !== null}>
                  {isPending ? <Spinner data-icon="inline-start" /> : <ArrowRightIcon data-icon="inline-start" />}
                  {isPending ? "Connecting" : card.cta}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {error ? (
        <Alert variant="destructive" className="md:col-span-2">
          <AlertTitle>Wallet connection failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}
