"use client";

import { useState } from "react";
import { WalletGate, shortAccount, useCasperWallet } from "./casper-wallet";

type UnderwriteResponse = {
  invoiceId: string;
  invoiceHash: string;
  status: string;
  parsed: {
    invoice_number?: string;
    buyer_name?: string;
    buyer_email?: string;
    original_currency?: string;
    original_amount_decimal?: string;
    due_date?: string;
    payment_terms?: string;
    extraction_confidence?: number;
  };
  fx: {
    usd_amount_cents?: string;
    rate_decimal?: string;
    source?: string;
    fetched_at?: string;
  };
  pricing: {
    risk_tier?: string;
    risk_score?: number;
    discount_bps?: number;
    advance_amount_usd_cents?: string;
    repayment_amount_usd_cents?: string;
  };
  attestationHash: string;
  error?: string;
};

export function SellerUploadFlow() {
  return (
    <WalletGate role="seller" title="Connect the freelancer wallet before uploading invoices.">
      <ConnectedSellerUploadFlow />
    </WalletGate>
  );
}

function ConnectedSellerUploadFlow() {
  const wallet = useCasperWallet();
  const [clientEmail, setClientEmail] = useState("");
  const [invoiceText, setInvoiceText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<"idle" | "underwriting" | "ready" | "error">("idle");
  const [result, setResult] = useState<UnderwriteResponse | null>(null);
  const [error, setError] = useState("");

  async function submitInvoice() {
    setState("underwriting");
    setError("");
    setResult(null);

    if (!file && !invoiceText.trim()) {
      setError("Upload an invoice file or paste invoice text before underwriting.");
      setState("error");
      return;
    }

    const form = new FormData();
    const uploadFile = file ?? new File([invoiceText], "invoice.txt", { type: "text/plain" });
    form.set("file", uploadFile);
    form.set("sellerWallet", wallet.accountHash);
    if (clientEmail) form.set("buyerEmail", clientEmail);

    try {
      const response = await fetch("/api/underwrite", { method: "POST", body: form });
      const body = (await response.json()) as UnderwriteResponse;
      if (!response.ok) throw new Error(body.error ?? "Underwriting failed");
      setResult(body);
      setState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invoice upload failed");
      setState("error");
    }
  }

  return (
    <>
      <div className="sectionTitle">
        <h2>Upload invoice</h2>
        <span className="walletBadge">Seller wallet {shortAccount(wallet.accountHash)}</span>
      </div>
      <section className="detailGrid">
        <div className="panel uploadPanel">
          <span className="label">Invoice evidence</span>
          <h3>Only this connected wallet can own the receivable.</h3>
          <label className="field">
            <span>Invoice PDF, PNG, JPG, or text fixture</span>
            <input
              accept=".pdf,.png,.jpg,.jpeg,.txt,text/plain,application/pdf,image/png,image/jpeg"
              type="file"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <label className="field">
            <span>Paste invoice text if you do not have a file</span>
            <textarea
              placeholder="Paste the real invoice text here..."
              value={invoiceText}
              onChange={(event) => setInvoiceText(event.target.value)}
              rows={9}
            />
          </label>
          <div className="optionalBox">
            <span className="label">Optional client contact</span>
            <label className="field">
              <span>Client email for reminder only</span>
              <input
                placeholder="ap@client.com"
                type="email"
                value={clientEmail}
                onChange={(event) => setClientEmail(event.target.value)}
              />
            </label>
            <p className="fineprint">This email is off-chain reminder metadata. Cortex stores only hashes on Casper.</p>
          </div>
          <button className="primary" type="button" onClick={submitInvoice} disabled={state === "underwriting"}>
            {state === "underwriting" ? "Running agents..." : "Run underwriting"}
          </button>
          {error ? <p className="error">{error}</p> : null}
        </div>

        <div className="panel trace">
          {[
            "Wallet account bound as seller",
            "File uploaded and evidence hash generated",
            "Parser output schema validated",
            "FX conversion normalized to USD cents",
            "Duplicate and due-date checks complete",
            "Risk terms priced in basis points",
            "Seller can mint/list on Casper"
          ].map((step) => (
            <div className="traceItem" key={step}>{step}</div>
          ))}
        </div>
      </section>

      {result ? (
        <section className="panel underwritingResult">
          <div>
            <span className="label">Agent result</span>
            <h3>{result.status === "ready_to_mint" ? "Ready to mint/list" : result.status}</h3>
          </div>
          <div className="resultGrid">
            <ResultItem label="Invoice" value={result.parsed.invoice_number ?? result.invoiceId} />
            <ResultItem label="Buyer" value={result.parsed.buyer_name ?? "validated buyer"} />
            <ResultItem
              label="Original"
              value={`${result.parsed.original_currency ?? ""} ${result.parsed.original_amount_decimal ?? ""}`.trim()}
            />
            <ResultItem label="Due date" value={result.parsed.due_date ?? "parsed"} />
            <ResultItem label="USD cents" value={result.fx.usd_amount_cents ?? "normalized"} />
            <ResultItem label="Risk" value={`${result.pricing.risk_tier ?? "priced"} / ${result.pricing.risk_score ?? "-"}`} />
            <ResultItem label="Discount" value={`${result.pricing.discount_bps ?? 0} bps`} />
            <ResultItem label="Attestation" value={result.attestationHash} mono />
          </div>
          <div className="reminderActions">
            <a className="primary" href={`/invoice/${result.invoiceId}`}>Review receivable terms</a>
            <a className="secondary" href="/seller">Back to freelancer dashboard</a>
          </div>
          <p className="fineprint">
            {clientEmail ? `Client email saved for reminder flow: ${clientEmail}. ` : ""}
            Hosted Dodo payment links are generated only after investor funding moves the invoice to RepaymentPending.
          </p>
        </section>
      ) : null}
    </>
  );
}

function ResultItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="resultItem">
      <span className="label">{label}</span>
      <strong className={mono ? "mono" : undefined}>{value}</strong>
    </div>
  );
}
