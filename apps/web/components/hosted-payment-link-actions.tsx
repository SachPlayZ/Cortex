"use client";

import { useState } from "react";
import { Button, buttonVariants } from "./ui/button";
import { cn } from "@/lib/utils";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

export function HostedPaymentLinkActions({ invoiceId }: { invoiceId: string }) {
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");

  async function generateLink() {
    setState("loading");
    setError("");
    try {
      const response = await fetch("/api/payments/dodo/create-checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          invoice_id: invoiceId,
          ...(clientEmail ? { buyer_email: clientEmail } : {})
        })
      });
      const body = (await response.json()) as { checkout_url?: string; error?: string };
      if (!response.ok || !body.checkout_url) throw new Error(body.error ?? "Hosted link failed");
      setCheckoutUrl(body.checkout_url);
      await navigator.clipboard.writeText(body.checkout_url);
      setState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hosted link failed");
      setState("error");
    }
  }

  const reminderHref = checkoutUrl
    ? `mailto:${clientEmail}?subject=${encodeURIComponent("Invoice payment link")}&body=${encodeURIComponent(
        `Hi, please pay this invoice using the secure Dodo hosted checkout link: ${checkoutUrl}`
      )}`
    : "";

  return (
    <div className="flex flex-wrap items-end gap-2.5">
      <div className="grid min-w-[min(260px,100%)] gap-1.5">
        <Label className="text-xs font-semibold text-ink-muted">Optional client email</Label>
        <Input
          placeholder="client@company.com"
          type="email"
          value={clientEmail}
          onChange={(event) => setClientEmail(event.target.value)}
          className="border-line bg-[#0b0d10] text-ink focus-visible:border-accent-2/50"
        />
      </div>
      <Button variant="outline" size="sm" type="button" onClick={generateLink} disabled={state === "loading"}>
        {state === "loading" ? "Generating..." : "Generate hosted Dodo link"}
      </Button>
      {checkoutUrl ? (
        <>
          <p className="w-full break-all font-mono text-[11.5px] text-ink-muted">{checkoutUrl}</p>
          <Button variant="outline" size="sm" type="button" onClick={() => void navigator.clipboard.writeText(checkoutUrl)}>
            Copy hosted link
          </Button>
          {clientEmail ? (
            <a href={reminderHref} className={cn(buttonVariants({ size: "sm" }))}>Email hosted link</a>
          ) : null}
        </>
      ) : null}
      {state === "ready" ? (
        <p className="m-0 w-full text-xs leading-relaxed text-ink-muted">
          Hosted checkout link copied. Send only this link to the client.
        </p>
      ) : null}
      {state === "error" ? <p className="m-0 text-xs text-bad">{error}</p> : null}
    </div>
  );
}
