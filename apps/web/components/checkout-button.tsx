"use client";

import { useState } from "react";
import { Button } from "./ui/button";

export function CheckoutButton({ invoiceId }: { invoiceId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  async function createHostedCheckout() {
    setState("loading");
    setError("");
    try {
      const response = await fetch("/api/payments/dodo/create-checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invoice_id: invoiceId })
      });
      const body = (await response.json()) as { checkout_url?: string; error?: string };
      if (!response.ok || !body.checkout_url) {
        throw new Error(body.error ?? "Checkout creation failed");
      }
      window.location.assign(body.checkout_url);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Hosted checkout failed");
      setState("error");
    }
  }

  return (
    <div className="grid gap-3">
      <Button type="button" onClick={createHostedCheckout} disabled={state === "loading"} className="w-fit">
        {state === "loading" ? "Creating hosted checkout..." : "Continue to hosted Dodo checkout"}
      </Button>
      {state === "error" ? <p className="m-0 text-xs text-bad">{error}</p> : null}
      <p className="m-0 text-xs leading-relaxed text-ink-muted">
        You will leave Cortex for the hosted Dodo payment page. Cortex waits for the signed webhook before showing success.
      </p>
    </div>
  );
}
