"use client";

import { useState } from "react";
import { ArrowUpRightIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Button } from "./ui/button";
import { Spinner } from "./ui/spinner";

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
    <div className="flex flex-col gap-4">
      <Button type="button" onClick={createHostedCheckout} disabled={state === "loading"} className="w-fit">
        {state === "loading" ? <Spinner data-icon="inline-start" /> : <ArrowUpRightIcon data-icon="inline-start" />}
        {state === "loading" ? "Creating checkout" : "Continue to hosted Dodo checkout"}
      </Button>
      {state === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>Checkout failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <p className="m-0 max-w-xl text-sm leading-6 text-muted-foreground">
        You will leave Cortex for Dodo. When you return, Cortex still waits for the signed webhook before showing paid.
      </p>
    </div>
  );
}
