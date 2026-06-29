"use client";

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
            ["/investor", "Marketplace"]
          ]
        : [];

  return (
    <nav className="sticky top-0 z-10 flex h-[60px] items-center justify-between gap-6 border-b border-line bg-[rgba(9,9,11,0.85)] px-7 backdrop-blur-md max-sm:h-auto max-sm:flex-col max-sm:items-start max-sm:gap-3 max-sm:px-4 max-sm:py-3.5">
      <a className="inline-flex items-center gap-2 text-[15px] font-bold tracking-tight text-ink" href="/">
        <img src="/cortex-logo.png" alt="" className="size-[26px] rounded-[6px] object-contain" />
        <span>Cortex</span>
      </a>
      {links.length > 0 ? (
        <div className="ml-auto flex flex-wrap gap-0.5 text-[13.5px] text-ink-muted max-sm:ml-0">
          {links.map(([href, label]) => (
            <a
              key={`${href}-${label}`}
              href={href}
              className="rounded-md px-2.5 py-1 transition-colors hover:bg-panel-elevated hover:text-ink"
            >
              {label}
            </a>
          ))}
        </div>
      ) : null}
      {wallet.isConnected ? (
        <ConnectWalletButton compact />
      ) : (
        <a href="/#onboarding" className={cn(buttonVariants({ size: "sm" }), "ml-auto")}>
          Start onboarding
        </a>
      )}
    </nav>
  );
}
