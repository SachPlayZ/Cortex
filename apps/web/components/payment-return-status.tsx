"use client";

import { useEffect, useState } from "react";

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
      <section className="paymentResult">
        <div className="statusIcon failed">×</div>
        <h1>Payment status unavailable</h1>
        <p>{error}</p>
        <a className="primary" href={`/buyer/pay/${invoiceId}`}>Retry paying</a>
      </section>
    );
  }

  if (status?.payment_status === "succeeded") {
    return (
      <section className="paymentResult">
        <div className="statusIcon success">✓</div>
        <h1>Payment successful</h1>
        <p>You can close this page now. Cortex has received webhook-confirmed payment settlement.</p>
        {status.casper_deploy_hash ? <p className="mono">Casper deploy: {status.casper_deploy_hash}</p> : null}
      </section>
    );
  }

  return (
    <section className="paymentResult">
      <div className="statusIcon spinner" />
      <h1>Waiting for payment confirmation</h1>
      <p>
        Dodo returned you to Cortex. We are waiting for the signed webhook and Casper settlement before marking this
        invoice paid.
      </p>
      <p className="fineprint">Current on-chain status: {status?.on_chain_status ?? "checking..."}</p>
    </section>
  );
}
