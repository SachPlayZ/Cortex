"use client";

import { useState } from "react";

export function LifecycleActions({ invoiceId }: { invoiceId: string }) {
  const [state, setState] = useState<"idle" | "loading">("idle");
  const [message, setMessage] = useState("");

  async function run(action: "claim") {
    setState("loading");
    setMessage("");
    try {
      const response = await fetch("/api/casper/demo/lifecycle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, invoice_id: invoiceId })
      });
      const body = (await response.json()) as { ok?: boolean; error?: string; txs?: Array<{ step: string; hash: string }> };
      if (!response.ok || !body.ok) throw new Error(body.error ?? "Casper action failed");
      setMessage(`${action}: ${body.txs?.map((tx) => tx.step).join(", ") ?? "submitted"}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Casper action failed");
    } finally {
      setState("idle");
    }
  }

  return (
    <div className="checkoutBox">
      <button className="secondary" disabled={state === "loading"} onClick={() => run("claim")}>
        Investor Claim After Repayment
      </button>
      {message ? <p className="fineprint">{message}</p> : null}
    </div>
  );
}
