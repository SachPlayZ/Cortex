"use client";

import { useState } from "react";
import { CopyIcon, MailIcon, SendIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Button } from "./ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "./ui/field";
import { Input } from "./ui/input";
import { Spinner } from "./ui/spinner";

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
    <div className="flex flex-col gap-4">
      <FieldGroup className="md:flex-row md:items-end">
        <Field className="min-w-[min(280px,100%)]">
          <FieldLabel htmlFor={`client-email-${invoiceId}`}>Client email</FieldLabel>
          <Input
            id={`client-email-${invoiceId}`}
            placeholder="client@company.com"
            type="email"
            value={clientEmail}
            onChange={(event) => setClientEmail(event.target.value)}
          />
          <FieldDescription>Optional. Used only to prepare a reminder email.</FieldDescription>
        </Field>
        <Button variant="outline" size="sm" type="button" onClick={generateLink} disabled={state === "loading"}>
          {state === "loading" ? <Spinner data-icon="inline-start" /> : <SendIcon data-icon="inline-start" />}
          {state === "loading" ? "Generating" : "Generate hosted Dodo link"}
        </Button>
      </FieldGroup>

      {checkoutUrl ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/50 p-3">
          <p className="m-0 break-all font-mono text-xs text-muted-foreground">{checkoutUrl}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" type="button" onClick={() => void navigator.clipboard.writeText(checkoutUrl)}>
              <CopyIcon data-icon="inline-start" />
              Copy link
            </Button>
            {clientEmail ? (
              <Button size="sm" nativeButton={false} render={<a href={reminderHref} />}>
                <MailIcon data-icon="inline-start" />
                Email link
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {state === "ready" ? (
        <Alert>
          <AlertTitle>Hosted checkout copied</AlertTitle>
          <AlertDescription>Send only this link to the client. Cortex still waits for the signed webhook.</AlertDescription>
        </Alert>
      ) : null}
      {state === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>Hosted link failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
