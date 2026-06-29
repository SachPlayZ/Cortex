"use client";

import { useEffect, useState } from "react";
import { buttonVariants } from "./ui/button";
import { cn } from "@/lib/utils";

type PaymentStatus = {
  payment_status: "pending_webhook" | "succeeded";
  on_chain_status: string;
  casper_deploy_hash?: string | null;
  checkout_url?: string | null;
};

export function PaymentReturnStatus({ invoiceId }: { invoiceId: string }) {
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch(`/api/payments/status/${invoiceId}`, { cache: "no-store" });
        const body = (await response.json()) as PaymentStatus | { error?: string };
        if (!response.ok) throw new Error("error" in body ? body.error : "Payment status unavailable");
        if (!cancelled) setStatus(body as PaymentStatus);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Payment status unavailable");
      }
    }

    void poll();
    const interval = window.setInterval(() => void poll(), 3_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [invoiceId]);

  if (error) {
    return (
      <PaymentResultLayout>
        <div className="grid size-[76px] place-items-center rounded-full bg-bad text-[44px] font-extrabold text-[#160606] shadow-[0_0_80px_rgba(248,113,113,0.25)]">
          ×
        </div>
        <h1 className="m-0 text-[clamp(34px,5vw,64px)] font-extrabold leading-[0.98] tracking-[-0.055em] text-ink">
          Payment status unavailable
        </h1>
        <p className="m-0 leading-relaxed text-ink-muted">{error}</p>
        <a href={`/buyer/pay/${invoiceId}`} className={cn(buttonVariants())}>Retry paying</a>
      </PaymentResultLayout>
    );
  }

  if (status?.payment_status === "succeeded") {
    return (
      <PaymentResultLayout>
        <div className="grid size-[76px] place-items-center rounded-full bg-good text-[44px] font-extrabold text-[#061007] shadow-[0_0_80px_rgba(74,222,128,0.28)]">
          ✓
        </div>
        <h1 className="m-0 text-[clamp(34px,5vw,64px)] font-extrabold leading-[0.98] tracking-[-0.055em] text-ink">
          Payment successful
        </h1>
        <p className="m-0 leading-relaxed text-ink-muted">
          You can close this page now. Cortex has received webhook-confirmed payment settlement.
        </p>
        {status.casper_deploy_hash ? (
          <p className="m-0 break-all font-mono text-[11.5px] text-ink-muted">Casper deploy: {status.casper_deploy_hash}</p>
        ) : null}
      </PaymentResultLayout>
    );
  }

  return (
    <PaymentResultLayout>
      <div
        className="size-[76px] rounded-full"
        style={{
          border: "3px solid rgba(255,255,255,0.12)",
          borderTopColor: "var(--c-accent-2)",
          animation: "spin 0.8s linear infinite"
        }}
      />
      <h1 className="m-0 text-[clamp(34px,5vw,64px)] font-extrabold leading-[0.98] tracking-[-0.055em] text-ink">
        Waiting for payment confirmation
      </h1>
      <p className="m-0 leading-relaxed text-ink-muted">
        Dodo returned you to Cortex. We are waiting for the signed webhook and Casper settlement before marking this
        invoice paid.
      </p>
      <p className="m-0 text-xs leading-relaxed text-ink-muted">
        Current on-chain status: {status?.on_chain_status ?? "checking..."}
      </p>
    </PaymentResultLayout>
  );
}

function PaymentResultLayout({ children }: { children: React.ReactNode }) {
  return (
    <section className="mx-auto grid max-w-[640px] place-items-center content-center gap-4 text-center" style={{ minHeight: "58dvh" }}>
      {children}
    </section>
  );
}
