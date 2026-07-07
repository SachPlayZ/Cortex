"use client";

import { ArrowUpRightIcon, LandmarkIcon, ReceiptTextIcon } from "lucide-react";
import { ConnectWalletButton, useCasperWallet } from "./casper-wallet";
import { buttonVariants } from "./ui/button";
import { cn } from "@/lib/utils";

export function Nav() {
  const wallet = useCasperWallet();
  const links =
    wallet.role === "seller"
      ? [
          ["/seller", "Dashboard"],
          ["/seller/upload", "Upload"],
          ["/seller/invoices", "Invoices"]
        ]
      : wallet.role === "investor"
        ? [
            ["/investor", "Dashboard"],
            ["/investor#marketplace", "Marketplace"]
          ]
        : [
            ["/#flow", "Flow"],
            ["/#roles", "Roles"],
            ["/#settlement", "Settlement"]
          ];

  return (
    <header className="pointer-events-none fixed inset-x-0 top-4 z-30 px-4">
      <nav className="pointer-events-auto mx-auto flex min-h-14 w-full max-w-6xl items-center justify-between gap-4 rounded-full border border-white/10 bg-background/72 px-3 py-2 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl max-md:rounded-2xl">
        <a className="inline-flex min-w-fit items-center gap-2 rounded-full px-2 text-sm font-semibold tracking-tight text-foreground" href="/">
          <span className="grid size-8 place-items-center overflow-hidden rounded-full border border-white/10 bg-primary text-primary-foreground">
            <ReceiptTextIcon />
          </span>
          <span>Cortex</span>
        </a>

        <div className="hidden items-center gap-1 rounded-full border border-white/8 bg-white/[0.035] p-1 text-sm text-muted-foreground md:flex">
          {links.map(([href, label]) => (
            <a
              key={`${href}-${label}`}
              href={href}
              className="rounded-full px-3 py-1.5 transition-colors hover:bg-white/8 hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </div>

        <div className="flex min-w-fit items-center gap-2">
          {wallet.isConnected ? (
            <ConnectWalletButton compact />
          ) : (
            <>
              <a href="/investor" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden md:inline-flex")}>
                <LandmarkIcon data-icon="inline-start" />
                Investor
              </a>
              <a href="/#onboarding" className={cn(buttonVariants({ size: "sm" }))}>
                Start
                <ArrowUpRightIcon data-icon="inline-end" />
              </a>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
