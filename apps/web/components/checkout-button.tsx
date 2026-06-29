"use client";

import { useRef, useState } from "react";
import type { CheckoutEvent } from "dodopayments-checkout";

type DodoPaymentsSdk = typeof import("dodopayments-checkout").DodoPayments;

export function CheckoutButton({ invoiceId }: { invoiceId: string }) {
  const initializedRef = useRef(false);
  const sdkRef = useRef<DodoPaymentsSdk | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "opening" | "ready" | "error">("idle");
  const [checkoutUrl, setCheckoutUrl] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [lastEvent, setLastEvent] = useState<string>("");

  async function createCheckout() {
    setState("loading");
    setError("");
    setLastEvent("");
    try {
      const response = await fetch("/api/payments/dodo/create-checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invoice_id: invoiceId })
      });
      const body = (await response.json()) as { checkout_url?: string; error?: string };
      if (!response.ok || !body.checkout_url) {
        setError(body.error ?? "Checkout creation failed");
        setState("error");
        return;
      }
      setCheckoutUrl(body.checkout_url);
      setState("opening");
      const dodoPayments = await loadDodoOverlay();
      dodoPayments.Checkout.open({
        checkoutUrl: body.checkout_url,
        options: {
          showTimer: true,
          showSecurityBadge: true
        }
      });
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Overlay checkout failed");
      setState("error");
    }
  }

  async function loadDodoOverlay(): Promise<DodoPaymentsSdk> {
    if (sdkRef.current) {
      return sdkRef.current;
    }
    const { DodoPayments } = await import("dodopayments-checkout");
    sdkRef.current = DodoPayments;
    if (!initializedRef.current) {
      DodoPayments.Initialize({
        mode: process.env.NEXT_PUBLIC_DODO_CHECKOUT_MODE === "live" ? "live" : "test",
        displayType: "overlay",
        onEvent: (event: CheckoutEvent) => {
          setLastEvent(event.event_type);
          if (event.event_type === "checkout.opened" || event.event_type === "checkout.closed") {
            setState("ready");
          }
          if (event.event_type === "checkout.error") {
            setError(readEventMessage(event) ?? "Dodo overlay checkout error");
            setState("error");
          }
        }
      });
      initializedRef.current = true;
    }
    return DodoPayments;
  }

  return (
    <div className="checkoutBox">
      <button className="primary" type="button" onClick={createCheckout} disabled={state === "loading"}>
        {state === "loading" ? "Creating checkout..." : state === "opening" ? "Opening overlay..." : "Open Dodo Overlay Checkout"}
      </button>
      {checkoutUrl ? <a className="checkoutLink" href={checkoutUrl}>Fallback hosted checkout link</a> : null}
      {lastEvent ? <p className="fineprint">Overlay event: {lastEvent}</p> : null}
      {state === "error" ? <p className="error">{error}</p> : null}
      <p className="fineprint">Payment completes only after signed Dodo webhook verifies and Casper relayer records repayment.</p>
    </div>
  );
}

function readEventMessage(event: CheckoutEvent): string | undefined {
  const message = event.data?.message;
  return typeof message === "string" ? message : undefined;
}
