"use client";

import {
  ArrowRightIcon,
  BadgeCheckIcon,
  BanknoteIcon,
  CheckCircle2Icon,
  CircleDollarSignIcon,
  FileCheck2Icon,
  FingerprintIcon,
  LandmarkIcon,
  LockKeyholeIcon,
  RadioTowerIcon,
  ReceiptTextIcon,
  ShieldCheckIcon,
  WalletCardsIcon
} from "lucide-react";
import { OnboardingPanel } from "./onboarding";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Progress, ProgressLabel } from "./ui/progress";
import { Separator } from "./ui/separator";

const underwritingSteps = [
  { label: "Evidence hashed", detail: "Private invoice stays off-chain", Icon: FingerprintIcon },
  { label: "Amount normalized", detail: "INR → integer USD cents", Icon: BanknoteIcon },
  { label: "Risk terms validated", detail: "Score, discount, advance", Icon: ShieldCheckIcon },
  { label: "Casper receivable ready", detail: "Seller signs the listing", Icon: LandmarkIcon }
];

const roles = [
  {
    value: "seller",
    title: "Freelancer: turn waiting time into working capital",
    body: "Upload real evidence, review the agent-priced offer, then sign the receivable listing from the wallet that owns it."
  },
  {
    value: "investor",
    title: "Investor: see the math before committing capital",
    body: "Compare face value, advance, discount, due date, AI confidence, and on-chain state before funding one receivable."
  },
  {
    value: "buyer",
    title: "Buyer: pay without learning web3",
    body: "Open a hosted Dodo checkout. Cortex waits for a signed webhook and Casper settlement before showing repayment complete."
  },
  {
    value: "operator",
    title: "Operator: inspect every proof boundary",
    body: "Track schema validation, webhook idempotency, relayer status, Casper deploys, and investor claim state from one system."
  }
];

export function LandingPage() {
  return (
    <div className="w-full overflow-x-hidden">
      <section className="border-b border-border px-4 pb-20 pt-28 sm:px-6 md:pb-28 md:pt-36 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] lg:gap-16">
          <div className="flex max-w-4xl flex-col items-start gap-7">
            <Badge variant="outline">
              <BadgeCheckIcon data-icon="inline-start" />
              Casper testnet · verified Dodo settlement
            </Badge>
            <h1 className="m-0 text-5xl font-semibold leading-[0.94] tracking-[-0.035em] text-balance text-foreground sm:text-6xl md:text-7xl xl:text-8xl">
              Finance the wait. Prove every handoff.
            </h1>
            <p className="m-0 max-w-2xl text-lg leading-8 text-pretty text-muted-foreground">
              Cortex turns an unpaid invoice into an agent-underwritten Casper receivable—then recognizes repayment only after a signed Dodo webhook reaches on-chain state.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" nativeButton={false} render={<a href="/seller/upload" />}>
                Upload an invoice
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
              <Button size="lg" variant="outline" nativeButton={false} render={<a href="/investor" />}>
                Inspect the market
                <LandmarkIcon data-icon="inline-start" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2"><CheckCircle2Icon className="text-primary" /> No floating-point money</span>
              <span className="inline-flex items-center gap-2"><CheckCircle2Icon className="text-primary" /> No private data on-chain</span>
              <span className="inline-flex items-center gap-2"><CheckCircle2Icon className="text-primary" /> No redirect-based repayment</span>
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <Badge>Ready to fund</Badge>
                <span className="font-mono text-xs text-muted-foreground">INV-2026-018</span>
              </div>
              <CardTitle className="text-2xl">Design services · 27 days</CardTitle>
              <CardDescription>Low risk · 94% extraction confidence · buyer identity hashed</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="grid grid-cols-[1fr_auto] items-end gap-5">
                <div>
                  <p className="m-0 text-sm text-muted-foreground">Investor funds</p>
                  <strong className="mt-1 block text-4xl font-semibold tracking-[-0.03em] tabular-nums text-foreground">$965.00</strong>
                </div>
                <div className="text-right">
                  <p className="m-0 text-sm text-muted-foreground">Receives</p>
                  <strong className="mt-1 block text-xl font-semibold tabular-nums text-foreground">$1,000.00</strong>
                </div>
              </div>
              <Separator />
              <div className="flex flex-col gap-3">
                {underwritingSteps.map(({ label, detail, Icon }) => (
                  <div key={label} className="flex items-center gap-3">
                    <Icon className="shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-sm font-medium text-foreground">{label}</p>
                      <p className="m-0 truncate text-xs text-muted-foreground">{detail}</p>
                    </div>
                    <Badge variant="secondary">done</Badge>
                  </div>
                ))}
              </div>
              <Progress value={72}>
                <ProgressLabel>Receivable lifecycle</ProgressLabel>
                <span className="ml-auto text-sm tabular-nums text-muted-foreground">Listed</span>
              </Progress>
            </CardContent>
            <CardFooter className="justify-between gap-4">
              <span className="text-xs text-muted-foreground">Attestation</span>
              <span className="max-w-[18rem] truncate font-mono text-xs text-foreground">0x9c8f…31d2</span>
            </CardFooter>
          </Card>
        </div>
      </section>

      <section className="px-4 py-8 sm:px-6 lg:px-8" aria-label="Cortex guarantees">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <p className="m-0 max-w-md text-sm leading-6 text-muted-foreground">
            One narrow financing path, engineered so every financial state has evidence behind it.
          </p>
          <div className="flex flex-wrap gap-x-8 gap-y-4">
            <ProofValue value="10,000" label="basis-point denominator" />
            <ProofValue value="1" label="investor per invoice" />
            <ProofValue value="2×" label="payment replay protection" />
          </div>
        </div>
      </section>

      <section id="flow" className="border-y border-border bg-card px-4 py-20 sm:px-6 md:py-28 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
          <div className="flex max-w-xl flex-col items-start gap-5">
            <h2 className="m-0 text-4xl font-semibold leading-[1.02] tracking-[-0.03em] text-balance text-foreground md:text-5xl">
              Evidence becomes capital without becoming public data.
            </h2>
            <p className="m-0 text-base leading-7 text-pretty text-muted-foreground">
              Each agent does one auditable job. Only validated financial fields and hashes cross the contract boundary.
            </p>
            <Alert>
              <LockKeyholeIcon />
              <AlertTitle>Privacy boundary</AlertTitle>
              <AlertDescription>Buyer names, emails, line items, PDFs, OCR text, and model reasoning remain off-chain.</AlertDescription>
            </Alert>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Underwriting handoff</CardTitle>
              <CardDescription>Typed output at every boundary. No raw model response reaches Casper.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-0">
              {underwritingSteps.map(({ label, detail, Icon }, index) => (
                <div key={`${label}-flow`}>
                  <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-5">
                    <div className="grid size-10 place-items-center rounded-lg bg-muted text-primary"><Icon /></div>
                    <div>
                      <p className="m-0 font-medium text-foreground">{label}</p>
                      <p className="m-0 mt-1 text-sm text-muted-foreground">{detail}</p>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
                  </div>
                  {index < underwritingSteps.length - 1 ? <Separator /> : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="roles" className="px-4 py-20 sm:px-6 md:py-28 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <h2 className="m-0 max-w-2xl text-4xl font-semibold leading-[1.02] tracking-[-0.03em] text-balance text-foreground md:text-5xl">
              One receivable. Four clear points of view.
            </h2>
            <p className="m-0 mt-5 max-w-xl text-base leading-7 text-muted-foreground">
              Every participant sees the information needed for their next action—never a generic dashboard full of borrowed complexity.
            </p>
          </div>
          <Card>
            <CardContent>
              <Accordion defaultValue={["seller"]}>
                {roles.map((role) => (
                  <AccordionItem key={role.value} value={role.value}>
                    <AccordionTrigger>{role.title}</AccordionTrigger>
                    <AccordionContent>
                      <p className="m-0 max-w-2xl leading-6 text-muted-foreground">{role.body}</p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="settlement" className="border-y border-border bg-card px-4 py-20 sm:px-6 md:py-28 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1.06fr_0.94fr] lg:gap-16">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <Badge variant="secondary"><RadioTowerIcon data-icon="inline-start" /> Payment event</Badge>
                <span className="text-xs text-muted-foreground">Dodo Test Mode</span>
              </div>
              <CardTitle className="text-3xl">A return URL is never proof.</CardTitle>
              <CardDescription>Cortex waits for the signed webhook, validates it, then relays one idempotent repayment to Casper.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <SettlementRow icon={ReceiptTextIcon} label="Hosted checkout completed" value="untrusted redirect" muted />
              <SettlementRow icon={BadgeCheckIcon} label="Webhook signature verified" value="trusted payment proof" />
              <SettlementRow icon={CircleDollarSignIcon} label="Amount + metadata matched" value="USD 1,000.00" />
              <SettlementRow icon={LandmarkIcon} label="Casper repayment recorded" value="claim unlocked" />
            </CardContent>
          </Card>

          <div className="flex flex-col justify-center gap-6">
            <div className="grid size-12 place-items-center rounded-lg bg-primary text-primary-foreground"><ShieldCheckIcon /></div>
            <h2 className="m-0 text-4xl font-semibold leading-[1.02] tracking-[-0.03em] text-balance text-foreground md:text-5xl">
              Web2 payment. Web3 finality. No pretend bridge between them.
            </h2>
            <p className="m-0 max-w-xl text-base leading-7 text-muted-foreground">
              Backend state coordinates the work. Casper remains the financial source of truth for funding, repayment, settlement, and claim.
            </p>
          </div>
        </div>
      </section>

      <section id="onboarding" className="px-4 py-20 sm:px-6 md:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <OnboardingPanel />
        </div>
      </section>

      <footer className="border-t border-border px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 text-foreground">
            <img src="/android-chrome-512x512.png" alt="" className="size-9 rounded-lg" />
            <strong>Cortex</strong>
          </div>
          <p className="m-0">AI-underwritten invoice financing on Casper.</p>
          <Button variant="ghost" size="sm" nativeButton={false} render={<a href="/agent" />}>
            Agent operations
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </footer>
    </div>
  );
}

function ProofValue({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-32">
      <strong className="block text-xl font-semibold tabular-nums text-foreground">{value}</strong>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function SettlementRow({ icon: Icon, label, value, muted = false }: { icon: typeof WalletCardsIcon; label: string; value: string; muted?: boolean }) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-border p-3">
      <Icon className={muted ? "text-muted-foreground" : "text-primary"} />
      <span className="text-sm text-foreground">{label}</span>
      <Badge variant={muted ? "outline" : "secondary"}>{value}</Badge>
    </div>
  );
}
