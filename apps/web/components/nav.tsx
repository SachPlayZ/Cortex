"use client";

import { ArrowUpRightIcon, LandmarkIcon, MenuIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { ConnectWalletButton, useCasperWallet } from "./casper-wallet";
import { Button } from "./ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList
} from "./ui/navigation-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "./ui/sheet";
import { Separator } from "./ui/separator";

export function Nav() {
  const wallet = useCasperWallet();
  const pathname = usePathname();
  const links: Array<[string, string]> =
    wallet.role === "seller"
      ? [
          ["/seller", "Dashboard"],
          ["/seller/upload", "Upload"],
          ["/seller/invoices", "Invoices"]
        ]
      : wallet.role === "investor"
        ? [
            ["/investor", "Portfolio"],
            ["/investor#marketplace", "Marketplace"]
          ]
        : [
            ["/#flow", "How it works"],
            ["/#roles", "For every side"],
            ["/#settlement", "Settlement"],
            ["/investor", "Market"]
          ];

  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-border bg-background">
      <nav className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8" aria-label="Primary navigation">
        <Button variant="ghost" nativeButton={false} render={<a href="/" aria-label="Cortex home" />} className="mr-auto px-1.5">
          <img src="/android-chrome-512x512.png" alt="" className="size-8 rounded-lg" />
          <span className="text-base font-semibold tracking-tight">Cortex</span>
        </Button>

        <NavigationMenu className="hidden md:flex">
          <NavigationMenuList>
            {links.map(([href, label]) => (
              <NavigationMenuItem key={`${href}-${label}`}>
                <NavigationMenuLink render={<a href={href} />} data-active={isActivePath(pathname, href) || undefined}>
                  {label}
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>

        <div className="hidden items-center gap-2 md:flex">
          {wallet.isConnected ? (
            <ConnectWalletButton compact />
          ) : (
            <>
              <Button variant="ghost" size="sm" nativeButton={false} render={<a href="/investor" />}>
                <LandmarkIcon data-icon="inline-start" />
                Investor
              </Button>
              <Button size="sm" nativeButton={false} render={<a href="/#onboarding" />}>
                Start
                <ArrowUpRightIcon data-icon="inline-end" />
              </Button>
            </>
          )}
        </div>

        <div className="md:hidden">
          <Sheet>
            <SheetTrigger render={<Button variant="outline" size="icon" aria-label="Open navigation" />}>
              <MenuIcon />
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Cortex navigation</SheetTitle>
                <SheetDescription>Open the workspace for the account that owns the next action.</SheetDescription>
              </SheetHeader>
              <Separator />
              <div className="flex flex-col gap-2 px-4">
                {links.map(([href, label]) => (
                  <Button
                    key={`${href}-${label}-mobile`}
                    variant={isActivePath(pathname, href) ? "secondary" : "ghost"}
                    nativeButton={false}
                    render={<a href={href} />}
                    className="justify-start"
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <Separator />
              <div className="px-4">
                {wallet.isConnected ? (
                  <ConnectWalletButton compact />
                ) : (
                  <Button nativeButton={false} render={<a href="/#onboarding" />} className="w-full">
                    Connect wallet
                    <ArrowUpRightIcon data-icon="inline-end" />
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}

function isActivePath(pathname: string, href: string) {
  if (href.includes("#")) return false;
  const path = href.split("#")[0];
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}
