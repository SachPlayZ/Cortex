"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCasperWallet } from "./casper-wallet";
import { Button } from "./ui/button";

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
    <section
      id="onboarding"
      className="mb-10 grid grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-6 rounded-[10px] border border-[rgba(183,255,90,0.16)] bg-gradient-to-b from-[rgba(24,24,28,0.96)] to-[rgba(11,13,16,0.96)] p-6 max-sm:grid-cols-1"
    >
      <div className="grid content-center gap-3">
        <span className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">Start onboarding</span>
        <h2 className="m-0 text-[clamp(28px,3.4vw,44px)] font-bold leading-none tracking-[-0.045em] text-ink">
          Connect once. Cortex opens the right workspace.
        </h2>
        <p className="m-0 text-[13px] leading-relaxed text-ink-muted">
          Freelancers get invoice upload, client reminder links, mint/list, withdrawal, and repayment status.
          Investors get marketplace, funding math, portfolio, and claim actions.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <article className="grid content-start gap-3 rounded-[10px] border border-line bg-[rgba(9,9,11,0.38)] p-[18px]">
          <span className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">Freelancer</span>
          <h3 className="m-0 text-xl font-bold tracking-tight text-ink">Upload invoices and get funded.</h3>
          <p className="m-0 text-[13px] leading-relaxed text-ink-muted">
            Your connected Casper wallet owns invoice submissions, receivable listings, and withdrawal state.
          </p>
          <Button
            type="button"
            onClick={() => void start("seller")}
            disabled={pendingRole !== null}
            className="w-fit"
          >
            {pendingRole === "seller" ? "Connecting..." : "Connect as freelancer"}
          </Button>
        </article>

        <article className="grid content-start gap-3 rounded-[10px] border border-line bg-[rgba(9,9,11,0.38)] p-[18px]">
          <span className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">Investor</span>
          <h3 className="m-0 text-xl font-bold tracking-tight text-ink">Fund receivables and track yield.</h3>
          <p className="m-0 text-[13px] leading-relaxed text-ink-muted">
            Your connected Casper wallet funds invoices, receives the claim, and unlocks repayment collection.
          </p>
          <Button
            type="button"
            onClick={() => void start("investor")}
            disabled={pendingRole !== null}
            className="w-fit"
          >
            {pendingRole === "investor" ? "Connecting..." : "Connect as investor"}
          </Button>
        </article>
      </div>

      {error ? <p className="col-span-full m-0 text-xs text-bad">{error}</p> : null}
    </section>
  );
}
