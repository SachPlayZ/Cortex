"use client";

import { useState } from "react";
import { WalletGate, shortAccount, useCasperWallet } from "./casper-wallet";
import { Button, buttonVariants } from "./ui/button";
import { cn } from "@/lib/utils";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

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
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <h2 className="m-0 text-lg font-bold tracking-tight text-ink">Upload invoice</h2>
        <span className="rounded-full border border-line bg-[rgba(24,24,28,0.88)] px-2.5 py-1.5 text-xs font-semibold text-ink">
          Seller wallet {shortAccount(wallet.accountHash)}
        </span>
      </div>

      <section className="grid grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-[18px] max-sm:grid-cols-1">
        <div className="grid gap-4 rounded-[10px] border border-line bg-gradient-to-b from-[rgba(24,24,28,0.96)] to-[rgba(17,17,22,0.96)] p-[22px]">
          <span className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">Invoice evidence</span>
          <h3 className="m-0 text-lg font-bold tracking-[-0.02em] text-ink">Only this connected wallet can own the receivable.</h3>

          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold text-ink-muted">Invoice PDF, PNG, JPG, or text fixture</Label>
            <Input
              accept=".pdf,.png,.jpg,.jpeg,.txt,text/plain,application/pdf,image/png,image/jpeg"
              type="file"
              className="cursor-pointer border-line bg-[#0b0d10] text-ink file:text-ink-muted focus-visible:border-accent-2/50"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs font-semibold text-ink-muted">Paste invoice text if you do not have a file</Label>
            <Textarea
              placeholder="Paste the real invoice text here..."
              value={invoiceText}
              onChange={(event) => setInvoiceText(event.target.value)}
              rows={9}
              className="resize-y border-line bg-[#0b0d10] text-ink leading-[1.55] focus-visible:border-accent-2/50"
            />
          </div>

          <div className="grid gap-2.5 rounded-[10px] border border-dashed border-line p-3.5">
            <span className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">Optional client contact</span>
            <div className="grid gap-1.5">
              <Label className="text-xs font-semibold text-ink-muted">Client email for reminder only</Label>
              <Input
                placeholder="ap@client.com"
                type="email"
                value={clientEmail}
                onChange={(event) => setClientEmail(event.target.value)}
                className="border-line bg-[#0b0d10] text-ink focus-visible:border-accent-2/50"
              />
            </div>
            <p className="m-0 text-xs leading-relaxed text-ink-muted">
              This email is off-chain reminder metadata. Cortex stores only hashes on Casper.
            </p>
          </div>

          <Button type="button" onClick={submitInvoice} disabled={state === "underwriting"} className="w-fit">
            {state === "underwriting" ? "Running agents..." : "Run underwriting"}
          </Button>
          {error ? <p className="m-0 text-xs text-bad">{error}</p> : null}
        </div>

        <div className="grid gap-1.5 rounded-[10px] border border-line bg-gradient-to-b from-[rgba(24,24,28,0.96)] to-[rgba(17,17,22,0.96)] p-[22px]">
          {[
            "Wallet account bound as seller",
            "File uploaded and evidence hash generated",
            "Parser output schema validated",
            "FX conversion normalized to USD cents",
            "Duplicate and due-date checks complete",
            "Risk terms priced in basis points",
            "Seller can mint/list on Casper"
          ].map((step) => (
            <div
              key={step}
              className="grid gap-1 rounded-[10px] border border-line bg-panel px-4 py-3.5"
            >
              {step}
            </div>
          ))}
        </div>
      </section>

      {result ? (
        <section className="mt-4 grid gap-4 rounded-[10px] border border-line bg-gradient-to-b from-[rgba(24,24,28,0.96)] to-[rgba(17,17,22,0.96)] p-[22px]">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">Agent result</span>
            <h3 className="m-0 text-lg font-bold tracking-[-0.02em] text-ink">
              {result.status === "ready_to_mint" ? "Ready to mint/list" : result.status}
            </h3>
          </div>
          <div className="grid grid-cols-4 gap-2.5 max-sm:grid-cols-1">
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
          <div className="flex flex-wrap gap-2.5">
            <a href={`/invoice/${result.invoiceId}`} className={cn(buttonVariants({ size: "sm" }))}>Review receivable terms</a>
            <a href="/seller" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>Back to freelancer dashboard</a>
          </div>
          <p className="m-0 text-xs leading-relaxed text-ink-muted">
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
    <div className="grid min-w-0 gap-1 rounded-lg border border-line-subtle bg-[rgba(9,9,11,0.36)] p-3">
      <span className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">{label}</span>
      <strong className={mono ? "break-all font-mono text-[11.5px] text-ink-muted" : "overflow-anywhere font-semibold text-ink"}>
        {value}
      </strong>
    </div>
  );
}
