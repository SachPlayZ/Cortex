"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRightIcon, LandmarkIcon, ReceiptTextIcon, ShieldCheckIcon } from "lucide-react";
import { useCasperWallet } from "./casper-wallet";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Separator } from "./ui/separator";
import { Spinner } from "./ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

type OnboardingRole = "seller" | "investor";

const roleCopy = {
  seller: {
    title: "Freelancer workspace",
    body: "Upload evidence, review underwriting, mint and list the receivable, then create the client payment link after funding.",
    cta: "Connect seller wallet",
    Icon: ReceiptTextIcon,
    checks: ["Own the invoice listing", "Sign mint and list", "Withdraw the funded advance"]
  },
  investor: {
    title: "Investor workspace",
    body: "Inspect deterministic terms, fund one receivable, track verified repayment, and claim after Casper confirms settlement.",
    cta: "Connect investor wallet",
    Icon: LandmarkIcon,
    checks: ["Compare receivable terms", "Sign funding transaction", "Claim after repayment"]
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
    <Card>
      <CardHeader className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
        <div className="flex max-w-3xl flex-col items-start gap-4">
          <Badge variant="outline">Wallet-scoped access</Badge>
          <CardTitle className="text-3xl md:text-4xl">Open the workspace that can sign the next action.</CardTitle>
          <CardDescription className="max-w-2xl text-base leading-7">
            Cortex never drops every user into the same dashboard. The connected account determines which financial actions are legal and relevant.
          </CardDescription>
        </div>
        <Badge variant="secondary"><ShieldCheckIcon data-icon="inline-start" /> CSPR.click</Badge>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="seller">
          <TabsList>
            <TabsTrigger value="seller"><ReceiptTextIcon data-icon="inline-start" />Freelancer</TabsTrigger>
            <TabsTrigger value="investor"><LandmarkIcon data-icon="inline-start" />Investor</TabsTrigger>
          </TabsList>
          {(Object.keys(roleCopy) as OnboardingRole[]).map((role) => {
            const copy = roleCopy[role];
            const Icon = copy.Icon;
            const isPending = pendingRole === role;
            return (
              <TabsContent key={role} value={role} className="pt-6">
                <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
                  <div className="flex flex-col items-start gap-5">
                    <div className="grid size-11 place-items-center rounded-lg bg-muted text-primary"><Icon /></div>
                    <div>
                      <h3 className="m-0 text-2xl font-semibold text-foreground">{copy.title}</h3>
                      <p className="m-0 mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{copy.body}</p>
                    </div>
                    <Button type="button" size="lg" onClick={() => void start(role)} disabled={pendingRole !== null}>
                      {isPending ? <Spinner data-icon="inline-start" /> : <ArrowRightIcon data-icon="inline-start" />}
                      {isPending ? "Connecting" : copy.cta}
                    </Button>
                  </div>
                  <div className="flex flex-col gap-0 rounded-lg border border-border px-4">
                    {copy.checks.map((check, index) => (
                      <div key={check}>
                        <div className="flex items-center justify-between gap-4 py-4">
                          <span className="text-sm text-foreground">{check}</span>
                          <Badge variant="secondary">Casper</Badge>
                        </div>
                        {index < copy.checks.length - 1 ? <Separator /> : null}
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
      {error ? (
        <CardFooter>
          <Alert variant="destructive">
            <AlertTitle>Wallet connection failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardFooter>
      ) : null}
    </Card>
  );
}
