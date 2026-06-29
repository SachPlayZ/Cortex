"use client";

import { ConnectWalletButton, useCasperWallet } from "./casper-wallet";

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
    <nav className="nav">
      <a className="brand" href="/">
        <img src="/cortex-logo.png" alt="" className="brandLogo" />
        <span>Cortex</span>
      </a>
      {links.length > 0 ? (
        <div className="navLinks">
          {links.map(([href, label]) => (
            <a key={`${href}-${label}`} href={href}>{label}</a>
          ))}
        </div>
      ) : null}
      {wallet.isConnected ? <ConnectWalletButton compact /> : <a className="primary navCta" href="/#onboarding">Start onboarding</a>}
    </nav>
  );
}
