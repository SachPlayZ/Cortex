"use client";

import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  BanknoteIcon,
  BrainCircuitIcon,
  CableIcon,
  FileCheck2Icon,
  LockKeyholeIcon,
  ReceiptTextIcon,
  ShieldCheckIcon,
  WalletCardsIcon
} from "lucide-react";
import { OnboardingPanel } from "./onboarding";
import { Badge } from "./ui/badge";
import { buttonVariants } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "./ui/card";
import { Progress, ProgressLabel } from "./ui/progress";
import { Separator } from "./ui/separator";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger);

const trustLoop = [
  "Parser Agent",
  "FX Agent",
  "Verification Agent",
  "Risk Agent",
  "Dodo Webhook",
  "Casper Settlement"
];

const bentoCards = [
  {
    title: "A receivable that starts from evidence, not vibes.",
    body: "The invoice file becomes a hash, the model output becomes validated agent data, and private buyer details stay off-chain.",
    icon: FileCheck2Icon,
    className: "md:col-span-6 md:row-span-2",
    image: "https://picsum.photos/seed/cortex-invoice-vault/1400/1100"
  },
  {
    title: "Money uses cents and basis points.",
    body: "FX, advance, repayment, discount, and yield stay deterministic.",
    icon: BanknoteIcon,
    className: "md:col-span-3"
  },
  {
    title: "Casper owns the lifecycle.",
    body: "The UI reads financial status from contract-backed state.",
    icon: ShieldCheckIcon,
    className: "md:col-span-3"
  },
  {
    title: "Hosted Dodo repayment.",
    body: "No client wallet, no redirect trust, no fake paid button.",
    icon: CableIcon,
    className: "md:col-span-3"
  },
  {
    title: "One investor, one clean demo path.",
    body: "Cortex avoids fractional complexity until the narrow path is airtight.",
    icon: LockKeyholeIcon,
    className: "md:col-span-3"
  }
];

const accordionItems = [
  {
    title: "Freelancers",
    body: "Upload an unpaid invoice, review the agent-priced offer, then mint and list the receivable from the connected Casper wallet.",
    image: "https://picsum.photos/seed/cortex-freelancer-ledger/1200/900"
  },
  {
    title: "Investors",
    body: "Compare face value, advance amount, risk tier, due date, and expected yield before funding one receivable on Casper.",
    image: "https://picsum.photos/seed/cortex-investor-market/1200/900"
  },
  {
    title: "Clients",
    body: "Open a wallet-free Dodo Test Mode checkout link and wait while Cortex verifies the signed webhook.",
    image: "https://picsum.photos/seed/cortex-payment-terminal/1200/900"
  },
  {
    title: "Agents",
    body: "Parse, normalize, verify, score, attest, and monitor the settlement loop with visible trace logs.",
    image: "https://picsum.photos/seed/cortex-agent-console/1200/900"
  }
];

const stackCards = [
  {
    title: "Evidence enters off-chain.",
    body: "The PDF or image never lands on Casper. Cortex stores evidence hashes and validated structured output."
  },
  {
    title: "Agents produce auditable terms.",
    body: "Parser, FX, verification, risk, and attestation outputs are schema-checked before any financial action."
  },
  {
    title: "Casper records the claim.",
    body: "Create, score, list, fund, repay, settle, and claim are explicit state transitions."
  },
  {
    title: "Dodo proves repayment.",
    body: "The redirect page stays pending until the signed webhook passes metadata, amount, and idempotency checks."
  }
];

export function LandingPage() {
  const rootRef = useRef<HTMLElement>(null);
  const [activeRole, setActiveRole] = useState<string>("Freelancers");

  useGSAP(
    () => {
      const ctx = gsap.context(() => {
        gsap.from("[data-hero-item]", {
          y: 28,
          opacity: 0,
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.08
        });

        gsap.utils.toArray<HTMLElement>("[data-scale-fade]").forEach((element) => {
          gsap.fromTo(
            element,
            { scale: 0.88, opacity: 0.45 },
            {
              scale: 1,
              opacity: 1,
              ease: "none",
              scrollTrigger: {
                trigger: element,
                start: "top 82%",
                end: "bottom 18%",
                scrub: true
              }
            }
          );
        });

        const words = gsap.utils.toArray<HTMLElement>("[data-scrub-word]");
        gsap.fromTo(
          words,
          { opacity: 0.14, y: 12 },
          {
            opacity: 1,
            y: 0,
            stagger: 0.04,
            ease: "none",
            scrollTrigger: {
              trigger: "[data-scrub-copy]",
              start: "top 72%",
              end: "bottom 42%",
              scrub: true
            }
          }
        );

        ScrollTrigger.create({
          trigger: "[data-pin-section]",
          start: "top top+=96",
          end: "bottom bottom-=180",
          pin: "[data-pin-title]",
          pinSpacing: false
        });

        gsap.utils.toArray<HTMLElement>("[data-stack-card]").forEach((card, index) => {
          gsap.fromTo(
            card,
            { y: 90 + index * 18, opacity: 0.35 },
            {
              y: index * -10,
              opacity: 1,
              ease: "power2.out",
              scrollTrigger: {
                trigger: card,
                start: "top 88%",
                end: "top 38%",
                scrub: true
              }
            }
          );
        });
      }, rootRef);

      return () => ctx.revert();
    },
    { scope: rootRef }
  );

  return (
    <main ref={rootRef} className="w-full max-w-full overflow-x-hidden">
      <section className="cortex-grain relative min-h-[100svh] overflow-hidden px-5 pb-24 pt-32 md:px-8 md:pb-32 md:pt-40">
        <div className="absolute inset-0 -z-10">
          <img
            src="https://picsum.photos/seed/cortex-receivable-market/2200/1300"
            alt=""
            className="size-full object-cover opacity-45 grayscale contrast-125 mix-blend-luminosity"
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(217,255,111,0.24),transparent_22rem),linear-gradient(90deg,rgba(7,10,14,0.94),rgba(7,10,14,0.78)_42%,rgba(7,10,14,0.96))]" />
        </div>

        <div className="mx-auto grid max-w-7xl items-end gap-14 md:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div className="flex flex-col items-start">
            <h1
              data-hero-item
              className="max-w-6xl text-5xl font-semibold leading-[0.9] tracking-normal text-foreground md:text-7xl xl:text-[6.6rem]"
            >
              Turn unpaid invoices into Casper receivables{" "}
              <span
                className="inline-block h-11 w-28 rounded-full bg-cover bg-center align-middle grayscale contrast-125 md:h-14 md:w-40"
                style={{ backgroundImage: "url(https://picsum.photos/seed/cortex-inline-credit/500/220)" }}
              />
            </h1>
            <p data-hero-item className="mt-8 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
              Cortex lets agents parse, verify, price, and attest invoice risk before one investor funds the receivable
              and Dodo webhook proof settles repayment back to Casper.
            </p>
            <div data-hero-item className="mt-9 flex flex-wrap gap-3">
              <a href="/seller/upload" className={cn(buttonVariants({ size: "lg" }), "h-11 px-4")}>
                Upload Invoice
                <ArrowRightIcon data-icon="inline-end" />
              </a>
              <a href="/investor" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 px-4 bg-background/50")}>
                Explore Receivables
              </a>
            </div>
          </div>

          <div data-hero-item className="cortex-float group relative min-h-[480px] overflow-hidden rounded-[28px] border border-white/10 bg-card/72 p-4 shadow-[0_40px_140px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <div className="cortex-scan absolute inset-4 overflow-hidden rounded-[22px]" />
            <img
              src="https://picsum.photos/seed/cortex-underwriting-desk/1200/1500"
              alt=""
              className="absolute inset-0 size-full object-cover opacity-55 grayscale contrast-125 transition-transform duration-700 ease-out group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,11,15,0.04),rgba(8,11,15,0.88))]" />
            <Card className="absolute inset-x-6 bottom-6 rounded-2xl border-white/10 bg-background/72 backdrop-blur-xl">
              <CardHeader>
                <CardTitle>Verified repayment path</CardTitle>
                <CardDescription>No success state from a return URL alone.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {["Evidence hash", "Agent attestation", "Investor funding", "Dodo webhook", "Casper settlement"].map((item, index) => (
                  <div key={item} className="flex items-center gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full border border-white/10 bg-primary/10 text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    <span className="text-sm text-foreground">{item}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="flow" className="px-5 py-32 md:px-8 md:py-48">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 flex flex-col gap-5 md:max-w-4xl">
            <h2 className="text-4xl font-semibold leading-[0.95] tracking-normal text-foreground md:text-6xl xl:text-[5.4rem]">
              The narrow workflow, made visibly rigorous.
            </h2>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
              Every screen has one job: prove the invoice moved through underwriting, Casper funding, verified Dodo
              repayment, and investor claim without trusting frontend-only state.
            </p>
          </div>

          <div className="grid grid-flow-dense auto-rows-[minmax(220px,auto)] grid-cols-1 gap-4 md:grid-cols-12">
            {bentoCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card
                  key={card.title}
                  data-scale-fade
                  className={cn("group overflow-hidden rounded-2xl border-white/10 bg-card/72 transition-colors hover:bg-card", card.className)}
                >
                  {card.image ? (
                    <div className="relative min-h-56 overflow-hidden">
                      <img
                        src={card.image}
                        alt=""
                        className="absolute inset-0 size-full object-cover opacity-75 grayscale contrast-125 transition-transform duration-700 ease-out group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(16,21,26,0.88))]" />
                    </div>
                  ) : null}
                  <CardHeader>
                    <div className="mb-4 grid size-10 place-items-center rounded-full border border-white/10 bg-primary/10 text-primary">
                      <Icon />
                    </div>
                    <CardTitle className="max-w-xl text-2xl leading-tight">{card.title}</CardTitle>
                    <CardDescription className="max-w-lg leading-6">{card.body}</CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
      <section id="roles" className="px-5 py-32 md:px-8 md:py-48">
        <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
          <div className="flex flex-col justify-center gap-8 min-w-0">
            <div className="flex flex-col gap-5">
              <h2 className="text-4xl font-semibold leading-[0.96] tracking-normal text-foreground md:text-6xl xl:text-[4.8rem]">
                Four roles, one state machine.
              </h2>
              <p className="text-base leading-7 text-muted-foreground">
                Cortex avoids generic dashboards. Each role gets the action it can actually perform in the lifecycle.
              </p>
            </div>
          </div>

          <div className="flex w-full min-h-[620px] gap-3 max-md:flex-col md:flex-row">
            {accordionItems.map((item) => {
              const isActive = activeRole === item.title;
              return (
                <article
                  key={item.title}
                  onMouseEnter={() => setActiveRole(item.title)}
                  onClick={() => setActiveRole(item.title)}
                  className={`group relative flex flex-col min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-card/70 transition-all duration-700 ease-out cursor-pointer ${
                    isActive ? "flex-[2.4]" : "flex-1"
                  }`}
                >
                  <img
                    src={item.image}
                    alt=""
                    className={`absolute inset-0 size-full object-cover grayscale contrast-125 transition-all duration-700 ease-out ${
                      isActive ? "scale-105 opacity-60" : "opacity-35"
                    }`}
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,11,15,0.05),rgba(8,11,15,0.9))]" />
                  <div className="relative flex min-h-[420px] flex-col justify-end p-6">
                    <h3 className="text-3xl font-semibold tracking-normal text-foreground">{item.title}</h3>
                    <div className={`grid transition-all duration-500 ease-in-out ${
                      isActive ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    }`}>
                      <div className="overflow-hidden">
                        <p className={`max-w-md text-sm leading-6 text-muted-foreground transition-opacity duration-500 ease-in-out pt-3 ${
                          isActive ? "opacity-100" : "opacity-0"
                        }`}>
                          {item.body}
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="mx-auto max-w-7xl mt-16 overflow-hidden rounded-full border border-white/10 bg-white/[0.035] py-3">
          <div className="cortex-marquee flex w-max items-center gap-8 px-4 text-sm font-medium text-muted-foreground">
            {[...trustLoop, ...trustLoop].map((item, index) => (
              <span key={`${item}-${index}`} className="flex items-center gap-8">
                {item}
                <span className="size-1.5 rounded-full bg-primary" />
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="settlement" data-pin-section className="px-5 py-32 md:px-8 md:py-48">
        <div className="mx-auto grid max-w-7xl gap-14 md:grid-cols-[0.8fr_1.2fr]">
          <div data-pin-title className="h-fit">
            <h2 className="text-4xl font-semibold leading-[0.96] tracking-normal text-foreground md:text-6xl xl:text-[5rem]">
              The redirect is theater. The webhook is evidence.
            </h2>
            <p data-scrub-copy className="mt-8 max-w-xl text-xl leading-9 text-muted-foreground">
              {"Dodo returns the buyer to Cortex, but the invoice stays pending until signature verification, metadata matching, amount validation, idempotency, and Casper repayment recording all complete."
                .split(" ")
                .map((word, index) => (
                  <span key={`${word}-${index}`} data-scrub-word className="mr-1.5 inline-block">
                    {word}
                  </span>
                ))}
            </p>
          </div>

          <div className="flex flex-col gap-6">
            {stackCards.map((card, index) => (
              <Card
                key={card.title}
                data-stack-card
                className="sticky rounded-2xl border-white/10 bg-card/88 shadow-[0_32px_100px_rgba(0,0,0,0.36)] backdrop-blur"
                style={{ top: `${112 + index * 24}px` }}
              >
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <Badge variant="outline">{String(index + 1).padStart(2, "0")}</Badge>
                    <BadgeCheckIcon className="text-primary" />
                  </div>
                  <CardTitle className="text-3xl tracking-normal">{card.title}</CardTitle>
                  <CardDescription className="max-w-2xl text-base leading-7">{card.body}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Progress value={(index + 1) * 24}>
                    <ProgressLabel>Lifecycle confidence</ProgressLabel>
                    <span className="ml-auto text-sm text-muted-foreground tabular-nums">{(index + 1) * 24}%</span>
                  </Progress>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-32 md:px-8 md:py-48">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-[1fr_0.86fr]">
          <Card className="rounded-2xl border-white/10 bg-primary text-primary-foreground">
            <CardHeader className="gap-6">
              <WalletCardsIcon />
              <CardTitle className="max-w-4xl text-4xl leading-[0.94] tracking-normal md:text-6xl xl:text-[5.2rem]">
                Bring one invoice all the way through the loop.
              </CardTitle>
              <CardDescription className="max-w-2xl text-base leading-7 text-primary-foreground/75">
                Start from a seller upload, then follow the exact path to investor funding, buyer checkout, verified
                webhook settlement, and investor claim.
              </CardDescription>
            </CardHeader>
            <CardFooter className="gap-3 border-primary-foreground/15 bg-primary-foreground/8">
              <a href="/seller/upload" className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "h-11 px-4")}>
                Start seller flow
              </a>
              <a href="/investor" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 border-primary-foreground/25 bg-transparent px-4 text-primary-foreground hover:bg-primary-foreground/12")}>
                View market
              </a>
            </CardFooter>
          </Card>

          <Card className="rounded-2xl border-white/10 bg-card/72">
            <CardHeader>
              <BrainCircuitIcon className="text-primary" />
              <CardTitle>Agent trace is product surface.</CardTitle>
              <CardDescription>
                Judges can see parser, FX, verification, risk pricing, Dodo webhook, and Casper deploy hashes instead of trusting a black box.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {trustLoop.map((item) => (
                <div key={item} className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2.5">
                  <span className="text-sm text-foreground">{item}</span>
                  <Badge variant="secondary">visible</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="onboarding" className="px-5 pb-32 md:px-8 md:pb-48">
        <div className="mx-auto max-w-7xl">
          <OnboardingPanel />
        </div>
      </section>

      <footer className="border-t border-white/10 px-5 py-12 md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground">
              <ReceiptTextIcon />
            </span>
            Cortex, AI-underwritten invoice financing on Casper.
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <a href="/buyer/pay/demo" className="hover:text-foreground">Buyer payment</a>
            <a href="/agent" className="hover:text-foreground">Agent trace</a>
            <a href="/admin" className="hover:text-foreground">Relayer ops</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
