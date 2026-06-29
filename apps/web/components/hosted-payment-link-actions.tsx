"use client";

import { useState } from "react";

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
    <div className="hostedLinkBox">
      <label className="field">
        <span>Optional client email</span>
        <input
          placeholder="client@company.com"
          type="email"
          value={clientEmail}
          onChange={(event) => setClientEmail(event.target.value)}
        />
      </label>
      <button className="secondary" type="button" onClick={generateLink} disabled={state === "loading"}>
        {state === "loading" ? "Generating..." : "Generate hosted Dodo link"}
      </button>
      {checkoutUrl ? (
        <>
          <p className="mono">{checkoutUrl}</p>
          <button className="secondary" type="button" onClick={() => void navigator.clipboard.writeText(checkoutUrl)}>
            Copy hosted link
          </button>
          {clientEmail ? <a className="primary" href={reminderHref}>Email hosted link</a> : null}
        </>
      ) : null}
      {state === "ready" ? <p className="fineprint">Hosted checkout link copied. Send only this link to the client.</p> : null}
      {state === "error" ? <p className="error">{error}</p> : null}
    </div>
  );
}
