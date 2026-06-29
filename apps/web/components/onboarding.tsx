"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCasperWallet } from "./casper-wallet";

type OnboardingRole = "seller" | "investor";

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
    <section className="onboardingPanel" id="onboarding">
      <div className="onboardingIntro">
        <span className="label">Start onboarding</span>
        <h2>Connect once. Cortex opens the right workspace.</h2>
        <p>
          Freelancers get invoice upload, client reminder links, mint/list, withdrawal, and repayment status.
          Investors get marketplace, funding math, portfolio, and claim actions.
        </p>
      </div>

      <div className="onboardingChoices">
        <article className="onboardingCard">
          <span className="label">Freelancer</span>
          <h3>Upload invoices and get funded.</h3>
          <p>Your connected Casper wallet owns invoice submissions, receivable listings, and withdrawal state.</p>
          <button className="primary" type="button" onClick={() => void start("seller")} disabled={pendingRole !== null}>
            {pendingRole === "seller" ? "Connecting..." : "Connect as freelancer"}
          </button>
        </article>

        <article className="onboardingCard">
          <span className="label">Investor</span>
          <h3>Fund receivables and track yield.</h3>
          <p>Your connected Casper wallet funds invoices, receives the claim, and unlocks repayment collection.</p>
          <button className="primary" type="button" onClick={() => void start("investor")} disabled={pendingRole !== null}>
            {pendingRole === "investor" ? "Connecting..." : "Connect as investor"}
          </button>
        </article>
      </div>

      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
