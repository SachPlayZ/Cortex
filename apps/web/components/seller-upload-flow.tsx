"use client";

import { useState } from "react";
import { ArrowRightIcon, FileTextIcon, FingerprintIcon, ShieldCheckIcon, SparklesIcon, WalletIcon } from "lucide-react";
import { WalletGate, shortAccount, useCasperWallet } from "./casper-wallet";
import { InvoiceLifecyclePanel } from "./invoice-lifecycle-panel";
import { PageShell } from "./page-shell";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSet, FieldLegend } from "./ui/field";
import { Input } from "./ui/input";
import { Progress, ProgressLabel } from "./ui/progress";
import { Spinner } from "./ui/spinner";
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

const stages = [
  "Evidence hash",
  "Parser schema",
  "FX cents",
  "Verification",
  "Risk terms",
  "Casper ready"
];

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
    if (!file && !invoiceText.trim()) {
      setResult(null);
      setError("Upload an invoice file or paste invoice text before underwriting.");
      setState("error");
      return;
    }
    setState("underwriting");
    setError("");
    setResult(null);

    const form = new FormData();
    const uploadFile = file ?? new File([invoiceText], "invoice.txt", { type: "text/plain" });
    form.set("file", uploadFile);
    form.set("sellerWallet", wallet.accountHash);
    form.set("sellerPublicKey", wallet.publicKeyHex);
    if (invoiceText.trim()) form.set("invoiceTextFallback", invoiceText.trim());
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

  const progress = state === "ready" ? 100 : state === "underwriting" ? 64 : state === "error" ? 18 : 8;

  return (
    <PageShell
      eyebrow={`Seller wallet ${shortAccount(wallet.accountHash)}`}
      title="Upload evidence, then let agents price it."
      description="The upload flow shows every proof point: invoice hash, parser output, FX normalization, verification checks, risk terms, and the Casper mint/list handoff."
    >
      <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <Card>
          <CardHeader>
            <div className="mb-3 grid size-11 place-items-center rounded-lg bg-muted text-primary">
              <FileTextIcon />
            </div>
            <CardTitle className="text-3xl tracking-normal">Invoice evidence</CardTitle>
            <CardDescription>PDF, image, or text fixture. Private invoice data stays off-chain.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldSet>
              <FieldLegend>Upload package</FieldLegend>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="invoice-file">Invoice PDF, PNG, JPG, WEBP, or text fixture</FieldLabel>
                  <Input
                    id="invoice-file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,text/plain,application/pdf,image/png,image/jpeg,image/webp"
                    type="file"
                    className="cursor-pointer"
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  />
                  <FieldDescription>Maximum demo upload is handled server-side. Hashes are generated before Casper calls.</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="invoice-text">Paste invoice text if OCR misses</FieldLabel>
                  <Textarea
                    id="invoice-text"
                    placeholder="Paste invoice text here"
                    value={invoiceText}
                    onChange={(event) => setInvoiceText(event.target.value)}
                    rows={9}
                    className="resize-y leading-6"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="client-email">Client email for reminder only</FieldLabel>
                  <Input
                    id="client-email"
                    placeholder="ap@client.com"
                    type="email"
                    value={clientEmail}
                    onChange={(event) => setClientEmail(event.target.value)}
                  />
                  <FieldDescription>This remains off-chain reminder metadata.</FieldDescription>
                </Field>
              </FieldGroup>
            </FieldSet>
          </CardContent>
          <CardFooter className="flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <Button type="button" onClick={submitInvoice} disabled={state === "underwriting"}>
              {state === "underwriting" ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
              {state === "underwriting" ? "Running agents" : "Run underwriting"}
            </Button>
            <Badge variant="secondary">{file ? file.name : "No file selected"}</Badge>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <div className="mb-3 grid size-11 place-items-center rounded-lg bg-muted text-primary">
              <ShieldCheckIcon />
            </div>
            <CardTitle className="text-3xl tracking-normal">Agent pipeline</CardTitle>
            <CardDescription>Concrete checks, not decorative AI copy.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <Progress value={progress}>
              <ProgressLabel>Underwriting progress</ProgressLabel>
              <span className="ml-auto text-sm text-muted-foreground tabular-nums">{progress}%</span>
            </Progress>
            <div className="grid gap-3">
              {stages.map((stage, index) => {
                const complete = state === "ready" || (state === "underwriting" && index < 4);
                return (
                  <div key={stage} className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/50 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Badge variant={complete ? "default" : "outline"}>{index + 1}</Badge>
                      <span className="truncate text-sm text-foreground">{stage}</span>
                    </div>
                    <Badge variant={complete ? "default" : "outline"}>{complete ? "done" : "pending"}</Badge>
                  </div>
                );
              })}
            </div>
            <Alert>
              <FingerprintIcon />
              <AlertTitle>On-chain privacy boundary</AlertTitle>
              <AlertDescription>
                Buyer names, emails, raw OCR, invoice PDFs, and model reasoning are not written to Casper.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </section>

      {state === "error" && error ? (
        <Alert variant="destructive">
          <AlertTitle>Underwriting failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {result ? (
        <section className="grid gap-6">
          <Card>
            <CardHeader className="md:grid-cols-[1fr_auto]">
              <div>
                <Badge variant={result.status === "ready_to_mint" ? "default" : "secondary"}>{result.status}</Badge>
                <CardTitle className="mt-4 text-3xl tracking-normal">
                  {result.status === "ready_to_mint" ? "Ready to mint and list" : result.status}
                </CardTitle>
                <CardDescription>
                  Hosted Dodo payment links unlock only after investor funding moves the invoice to RepaymentPending.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button size="sm" nativeButton={false} render={<a href={`/invoice/${result.invoiceId}`} />}>
                  Review receivable
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
                <Button variant="outline" size="sm" nativeButton={false} render={<a href="/seller" />}>Dashboard</Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <ResultItem label="Invoice" value={result.parsed.invoice_number ?? result.invoiceId} />
              <ResultItem label="Buyer" value={result.parsed.buyer_name ?? "validated buyer"} />
              <ResultItem label="Original" value={`${result.parsed.original_currency ?? ""} ${result.parsed.original_amount_decimal ?? ""}`.trim()} />
              <ResultItem label="Due date" value={result.parsed.due_date ?? "parsed"} />
              <ResultItem label="USD cents" value={result.fx.usd_amount_cents ?? "normalized"} />
              <ResultItem label="Risk" value={`${result.pricing.risk_tier ?? "priced"} / ${result.pricing.risk_score ?? "-"}`} />
              <ResultItem label="Discount" value={`${result.pricing.discount_bps ?? 0} bps`} />
              <ResultItem label="Attestation" value={result.attestationHash} mono />
            </CardContent>
          </Card>

          <InvoiceLifecyclePanel
            compact
            invoice={{
              id: result.invoiceId,
              title: result.parsed.invoice_number,
              sellerAccount: wallet.accountHash,
              sellerPublicKey: wallet.publicKeyHex,
              invoiceHash: result.invoiceHash as `0x${string}`,
              originalCurrency: result.parsed.original_currency,
              usdAmountCents: result.fx.usd_amount_cents,
              advanceAmountUsdCents: result.pricing.advance_amount_usd_cents,
              repaymentAmountUsdCents: result.pricing.repayment_amount_usd_cents ?? "0",
              riskTier: result.pricing.risk_tier,
              riskScore: result.pricing.risk_score,
              discountBps: result.pricing.discount_bps,
              dueDate: result.parsed.due_date,
              statusCasper: result.status === "rejected" ? "Rejected" : "Scored",
              attestationHash: result.attestationHash as `0x${string}`,
              agentConfidence: result.parsed.extraction_confidence,
              casperInvoiceExists: false
            }}
          />
        </section>
      ) : null}
    </PageShell>
  );
}

function ResultItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid min-w-0 gap-2 rounded-lg border border-border bg-muted/50 p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <strong className={mono ? "break-all font-mono text-xs text-muted-foreground" : "truncate font-semibold text-foreground"}>
        {value}
      </strong>
    </div>
  );
}
