"use client";

import {
  ArrowRightIcon,
  BadgeCheckIcon,
  BanknoteIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  CircleAlertIcon,
  CircleDollarSignIcon,
  Clock3Icon,
  CopyIcon,
  FileCheck2Icon,
  FingerprintIcon,
  LandmarkIcon,
  LockKeyholeIcon,
  RadioTowerIcon,
  ReceiptTextIcon,
  SearchIcon,
  ShieldCheckIcon,
  UploadIcon,
  WalletCardsIcon
} from "lucide-react";
import { OnboardingPanel } from "./onboarding";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

const underwritingSteps = [
  { label: "Evidence hashed", detail: "SHA-256 digest of invoice.pdf", Icon: FingerprintIcon },
  { label: "INR normalized to USD cents", detail: "Fixed-point FX snapshot", Icon: BanknoteIcon },
  { label: "Risk terms validated", detail: "Score, discount, and advance", Icon: ShieldCheckIcon },
  { label: "Casper receivable ready", detail: "Typed calldata prepared", Icon: LandmarkIcon }
];

const marketRows = [
  { id: "INV-2026-018", risk: "Low · 86", due: "27 days", face: "$1,000.00", funding: "$965.00", returns: "3.63%", state: "Ready to fund", ready: true },
  { id: "INV-2026-021", risk: "MediumLow · 78", due: "42 days", face: "$2,400.00", funding: "$2,268.00", returns: "5.82%", state: "Scored", ready: false },
  { id: "INV-2026-024", risk: "Low · 91", due: "18 days", face: "$780.00", funding: "$756.60", returns: "3.09%", state: "Ready to fund", ready: true }
];

const settlementSteps = [
  { label: "Checkout completed", note: "untrusted", trusted: false },
  { label: "Signature verified", note: "signed event", trusted: true },
  { label: "Amount + metadata", note: "matched", trusted: true },
  { label: "Casper repayment", note: "recorded", trusted: true }
];

export function LandingPage() {
  return (
    <div className="w-full overflow-x-hidden bg-bg text-foreground">
      <HeroSection />
      <UnderwritingSection />
      <MarketplaceSection />
      <SettlementSection />
      <RolesSection />
      <ClosingSection />
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative isolate min-h-[48rem] overflow-hidden border-b border-border px-4 pb-16 pt-24 sm:px-6 md:min-h-[54rem] md:pb-20 md:pt-28 lg:px-8">
      <div className="relative mx-auto grid min-h-[42rem] max-w-[90rem] grid-cols-1 lg:grid-cols-12 lg:grid-rows-[1fr_auto]">
        <div className="relative z-0 min-h-[36rem] sm:min-h-[31rem] lg:col-span-9 lg:col-start-4 lg:row-span-2 lg:row-start-1 lg:min-h-0">
          <HeroDossier />
        </div>

        <div className="relative z-20 -mt-8 flex max-w-[48rem] flex-col items-start gap-6 self-end pb-5 lg:col-span-7 lg:col-start-1 lg:row-start-2 lg:mt-0 lg:pb-12">
          <div className="flex items-center gap-3 text-[0.7rem] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            <span className="h-px w-10 bg-primary" />
            The verified ledger
          </div>
          <h1 className="m-0 max-w-[12ch] text-[clamp(3.25rem,7.2vw,6rem)] font-medium leading-[0.92] tracking-[-0.04em] text-balance text-foreground">
            Finance the wait. Prove every handoff.
          </h1>
          <p className="m-0 max-w-xl text-base leading-7 text-pretty text-muted-foreground sm:text-lg sm:leading-8">
            Turn an unpaid invoice into a verified on-chain receivable. Cortex prices the risk, coordinates funding, and recognizes repayment only after proof.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" nativeButton={false} render={<a href="/seller/upload" />}>
              <UploadIcon data-icon="inline-start" />
              Upload an invoice
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
            <Button size="lg" variant="outline" nativeButton={false} render={<a href="/investor" />}>
              Inspect the market
            </Button>
          </div>
          <div className="grid w-full max-w-2xl gap-3 border-t border-border pt-5 text-sm text-muted-foreground sm:grid-cols-3">
            <ProofItem icon={CircleDollarSignIcon}>Integer cents</ProofItem>
            <ProofItem icon={LockKeyholeIcon}>Private evidence</ProofItem>
            <ProofItem icon={BadgeCheckIcon}>Webhook verified</ProofItem>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroDossier() {
  return (
    <div className="absolute inset-x-0 top-3 h-[31rem] lg:-right-20 lg:left-0 lg:top-2 lg:h-[42rem]">
      <div className="absolute left-[14%] top-3 w-[86%] overflow-hidden rounded-[0.4rem] border border-border bg-panel p-5 sm:p-7 lg:left-[26%] lg:w-[64%] lg:p-9">
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div>
            <p className="m-0 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">Receivable dossier</p>
            <strong className="mt-1 block text-xl tracking-[-0.03em] text-foreground sm:text-3xl">INV-2026-018</strong>
          </div>
          <Badge>Financed</Badge>
        </div>
        <div className="mt-5 grid grid-cols-[1fr_1.15fr] gap-5 sm:gap-8">
          <div className="space-y-4 text-[0.68rem] sm:text-xs">
            <PaperField label="Buyer" value="Northbridge Industrial" />
            <PaperField label="Terms" value="Net 30" />
            <PaperField label="Due date" value="02 Aug 2026" />
          </div>
          <div>
            <p className="m-0 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Settlement terms</p>
            <div className="mt-2 border-y border-border py-3">
              <strong className="block text-2xl tracking-[-0.04em] text-foreground sm:text-4xl">$965.00</strong>
              <span className="text-[0.65rem] text-muted-foreground sm:text-xs">funds today</span>
            </div>
            <div className="flex items-end justify-between pt-3">
              <span className="text-[0.65rem] text-muted-foreground sm:text-xs">repays at maturity</span>
              <strong className="text-base text-foreground sm:text-xl">$1,000.00</strong>
            </div>
          </div>
        </div>
        <div className="mt-6 hidden grid-cols-5 gap-2 border-t border-border pt-4 text-[0.55rem] uppercase tracking-[0.12em] text-muted-foreground sm:grid">
          {['Issued', 'Scored', 'Listed', 'Funded', 'Repaid'].map((state, index) => (
            <span key={state} className="flex items-center gap-1.5">
              <span className={`size-1.5 rounded-full ${index < 4 ? 'bg-primary' : 'bg-muted'}`} />
              {state}
            </span>
          ))}
        </div>
      </div>

      <div className="absolute -right-[18%] bottom-0 w-[82%] overflow-hidden rounded-xl border border-border bg-panel-elevated p-5 sm:right-[-5%] sm:w-[68%] sm:p-6 lg:right-[-8%] lg:w-[58%] lg:p-8">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <p className="m-0 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-muted-foreground">Marketplace / INV-2026-018</p>
            <strong className="mt-2 block text-lg text-foreground sm:text-2xl">Verified funding offer</strong>
          </div>
          <span className="hidden items-center gap-2 text-xs text-good sm:flex"><CheckCircle2Icon className="size-4" /> Casper state</span>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-4 text-xs sm:text-sm">
          <Metric label="Risk" value="Low · 86" accent />
          <Metric label="Tenor" value="27 days" />
          <Metric label="Advance" value="96.5%" />
        </div>
        <div className="mt-5 flex items-end justify-between border-t border-border pt-5">
          <div>
            <p className="m-0 text-xs text-muted-foreground">Funding amount</p>
            <strong className="mt-1 block text-2xl tracking-[-0.04em] tabular-nums text-foreground sm:text-4xl">$965.00</strong>
          </div>
          <Button size="sm" nativeButton={false} render={<a href="/invoice/INV-2026-018" />} className="hidden sm:inline-flex">
            Review offer <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function UnderwritingSection() {
  return (
    <section id="flow" className="border-b border-border px-4 py-24 sm:px-6 md:py-32 lg:px-8">
      <div className="mx-auto grid max-w-[90rem] gap-14 xl:grid-cols-[minmax(0,1.25fr)_minmax(23rem,0.75fr)] xl:items-center">
        <div className="relative min-h-[44rem]">
          <div className="absolute left-0 top-3 hidden h-[calc(100%-0.75rem)] w-20 border border-border bg-panel xl:flex xl:flex-col xl:items-center xl:justify-between xl:py-6">
            <span className="h-8 w-px bg-primary" />
            <span className="[writing-mode:vertical-rl] text-[0.62rem] uppercase tracking-[0.24em] text-muted-foreground">Private / off-chain</span>
            <img src="/cortex-logo.png" alt="" className="size-9 rounded-md object-cover" />
          </div>
          <div className="xl:pl-24">
            <InvoiceEvidence />
            <AgentTrace />
            <AttestationPanel />
          </div>
        </div>

        <div className="flex flex-col items-start gap-6 xl:pl-4">
          <h2 className="m-0 max-w-[13ch] text-4xl font-medium leading-[0.98] tracking-[-0.04em] text-balance sm:text-5xl lg:text-6xl">
            Evidence becomes capital. Private data stays private.
          </h2>
          <p className="m-0 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            Each agent performs one typed, auditable job. Only validated fields and hashes cross the contract boundary.
          </p>
          <div className="w-full border-y border-border">
            {underwritingSteps.map(({ label }, index) => (
              <div key={label} className="grid grid-cols-[2.6rem_1fr_auto] items-center gap-3 border-b border-border py-4 last:border-b-0">
                <span className="font-mono text-sm text-primary">0{index + 1}</span>
                <span className="text-sm text-foreground sm:text-base">{label}</span>
                <span className="flex items-center gap-2 text-xs text-good"><span className="size-1.5 rounded-full bg-good" /> validated</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 border border-border p-5">
            <LockKeyholeIcon className="mt-0.5 shrink-0 text-primary" />
            <p className="m-0 text-sm leading-6 text-muted-foreground">Buyer names, emails, line items, PDFs, OCR text, and model reasoning remain off-chain.</p>
          </div>
          <Button variant="link" className="px-0 text-base" nativeButton={false} render={<a href="/agent" />}>
            Inspect an attestation <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </section>
  );
}

function InvoiceEvidence() {
  return (
    <div className="relative mx-auto max-w-[46rem] border border-border bg-panel-elevated px-6 pb-8 pt-6 sm:px-9">
      <div className="flex items-start justify-between border-b border-border pb-4">
        <div>
          <p className="m-0 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">Private / redacted</p>
          <strong className="mt-1 block text-2xl tracking-[-0.02em] text-foreground">INVOICE</strong>
        </div>
        <span className="font-mono text-xs text-muted-foreground">INV-2026-018<br />18 JUL 2026</span>
      </div>
      <div className="mt-5 grid gap-6 sm:grid-cols-2">
        <div className="space-y-4">
          <RedactedField label="Buyer" width="w-36" />
          <RedactedField label="Email" width="w-44" />
          <RedactedField label="Supplier" width="w-32" />
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <PaperField label="Invoice amount" value="₹83,000.00" />
          <PaperField label="USD cents" value="100000" />
          <PaperField label="Payment terms" value="Net 30" />
          <PaperField label="Due date" value="02 Aug 2026" />
        </div>
      </div>
    </div>
  );
}

function AgentTrace() {
  return (
    <div className="mx-auto mt-4 max-w-[46rem] border border-border bg-panel px-5 py-4 sm:px-7">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">Agent trace — typed pipeline</span>
        <Badge variant="secondary">validated</Badge>
      </div>
      <div>
        {underwritingSteps.map(({ label, detail, Icon }, index) => (
          <div key={label} className="grid grid-cols-[2rem_auto_1fr_auto] items-center gap-3 border-b border-border py-3 last:border-0">
            <span className="font-mono text-xs text-primary">0{index + 1}</span>
            <Icon className="size-4 text-muted-foreground" />
            <div className="min-w-0">
              <span className="block truncate text-sm text-foreground">{label}</span>
              <span className="hidden truncate text-xs text-muted-foreground sm:block">{detail}</span>
            </div>
            <CheckCircle2Icon className="size-4 text-good" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AttestationPanel() {
  return (
    <div className="mx-auto mt-4 grid max-w-[46rem] gap-5 border border-border bg-panel p-5 sm:grid-cols-[1.2fr_0.8fr] sm:p-7">
      <div>
        <p className="m-0 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">Attestation / canonical JSON</p>
        <pre className="mt-4 overflow-hidden text-[0.64rem] leading-5 text-good/90 sm:text-xs">{`{
  "invoice_hash": "e3b0c442…",
  "usd_amount_cents": "100000",
  "risk_tier": "Low",
  "discount_bps": 350
}`}</pre>
      </div>
      <div className="border-t border-border pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
        <p className="m-0 text-xs text-muted-foreground">Attestation hash</p>
        <div className="mt-2 flex items-center justify-between border border-good/35 px-3 py-2 font-mono text-sm text-good">
          0x9c8f…31d2 <CopyIcon className="size-3.5" />
        </div>
        <p className="mb-0 mt-5 text-xs leading-5 text-muted-foreground">Schema<br /><span className="text-foreground">cortex.attestation.v1</span></p>
      </div>
    </div>
  );
}

function MarketplaceSection() {
  return (
    <section className="border-b border-border px-4 py-24 sm:px-6 md:py-32 lg:px-8" id="marketplace-preview">
      <div className="mx-auto max-w-[96rem]">
        <div className="mb-12 max-w-4xl">
          <h2 className="m-0 text-4xl font-medium leading-[0.98] tracking-[-0.04em] sm:text-5xl lg:text-6xl">See the math before capital moves.</h2>
          <p className="mb-0 mt-5 text-base text-muted-foreground sm:text-lg">One invoice. One investor. Every term visible before funding.</p>
        </div>

        <div className="overflow-hidden border border-border xl:grid xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="min-w-0">
            <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:p-5">
              <div className="flex h-10 min-w-0 flex-1 items-center gap-2 border border-border px-3 text-sm text-muted-foreground sm:max-w-sm">
                <SearchIcon className="size-4" /> Search invoice
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>All</Badge>
                <Badge variant="outline">Low risk</Badge>
                <Badge variant="outline">Due &lt; 30 days</Badge>
              </div>
              <Button size="sm" variant="outline" nativeButton={false} render={<a href="/agent" />} className="sm:ml-auto">
                How scoring works
              </Button>
            </div>

            <div className="hidden md:block">
              <div className="grid grid-cols-[1.1fr_0.9fr_0.75fr_0.9fr_1fr_0.8fr_1fr] gap-4 border-b border-border bg-panel px-5 py-4 text-xs text-muted-foreground">
                {['Invoice', 'Risk', 'Due in', 'Face value', 'Funding required', 'Return', 'State'].map((label) => <span key={label}>{label}</span>)}
              </div>
              {marketRows.map((row, index) => (
                <a href={`/invoice/${row.id}`} key={row.id} className={`grid grid-cols-[1.1fr_0.9fr_0.75fr_0.9fr_1fr_0.8fr_1fr] items-center gap-4 border-b border-border px-5 py-7 text-sm transition-colors last:border-b-0 hover:bg-panel ${index === 0 ? 'border-l-2 border-l-primary' : ''}`}>
                  <span className="font-mono text-foreground">{row.id}</span>
                  <span className="flex items-center gap-2"><ShieldCheckIcon className={`size-4 ${row.ready ? 'text-good' : 'text-warn'}`} />{row.risk}</span>
                  <span>{row.due}</span>
                  <span className="tabular-nums">{row.face}</span>
                  <span className="tabular-nums">{row.funding}</span>
                  <span className="tabular-nums">{row.returns}</span>
                  <span className={`flex items-center gap-2 ${row.ready ? 'text-primary' : 'text-muted-foreground'}`}><span className={`size-2 rounded-full ${row.ready ? 'bg-primary' : 'bg-muted-foreground'}`} />{row.state}</span>
                </a>
              ))}
            </div>

            <div className="divide-y divide-border md:hidden">
              {marketRows.map((row) => (
                <a href={`/invoice/${row.id}`} key={row.id} className="block p-5 hover:bg-panel">
                  <div className="flex items-center justify-between gap-4"><span className="font-mono text-sm">{row.id}</span><Badge variant={row.ready ? 'default' : 'outline'}>{row.state}</Badge></div>
                  <div className="mt-5 grid grid-cols-3 gap-3 text-sm"><Metric label="Risk" value={row.risk} /><Metric label="Funding" value={row.funding} /><Metric label="Return" value={row.returns} /></div>
                </a>
              ))}
            </div>
          </div>

          <aside className="border-t border-border bg-panel p-5 xl:border-l xl:border-t-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="m-0 font-mono text-lg">INV-2026-018</p>
                <span className="mt-2 flex items-center gap-2 text-sm text-good"><CheckCircle2Icon className="size-4" /> Ready to fund</span>
              </div>
              <ChevronRightIcon className="rotate-90 text-muted-foreground xl:rotate-0" />
            </div>
            <div className="mt-7 border-y border-border py-5">
              <p className="m-0 text-xs uppercase tracking-[0.14em] text-muted-foreground">Borrower</p>
              <strong className="mt-2 block">North Ridge Construction</strong>
              <span className="mt-2 flex items-center gap-2 text-xs text-good"><ShieldCheckIcon className="size-4" /> Casper state verified</span>
            </div>
            <div className="grid grid-cols-2 gap-y-3 border-b border-border py-5 text-sm">
              <span className="text-muted-foreground">Due date</span><span className="text-right">01 Jun 2026</span>
              <span className="text-muted-foreground">Face value</span><span className="text-right tabular-nums">$1,000.00</span>
              <span className="text-muted-foreground">Discount</span><span className="text-right tabular-nums">3.50%</span>
            </div>
            <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center border border-border px-4 py-5 text-center">
              <Metric label="Fund" value="$965.00" />
              <ArrowRightIcon className="size-4 text-muted-foreground" />
              <Metric label="Receive" value="$1,000.00" />
            </div>
            <div className="mt-3 flex items-center justify-between border border-border p-3 text-xs text-muted-foreground"><span className="flex items-center gap-2"><ShieldCheckIcon className="size-4 text-good" /> Chain verified</span><span>View proof ↗</span></div>
            <Button className="mt-4 w-full" nativeButton={false} render={<a href="/invoice/INV-2026-018" />}>Fund receivable <ArrowRightIcon data-icon="inline-end" /></Button>
          </aside>
        </div>
      </div>
    </section>
  );
}

function SettlementSection() {
  return (
    <section id="settlement" className="relative isolate overflow-hidden border-b border-border px-4 py-24 sm:px-6 md:py-32 lg:px-8">
      <div className="relative mx-auto min-h-[42rem] max-w-[96rem]">
        <div className="relative z-20 max-w-[42rem]">
          <h2 className="m-0 text-4xl font-medium leading-[0.98] tracking-[-0.04em] sm:text-5xl lg:text-6xl">A return URL is never proof.</h2>
          <p className="mb-0 mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">Cortex waits for a signed webhook, validates the payment, then records one idempotent repayment on Casper.</p>
          <Button variant="outline" size="lg" className="mt-7" nativeButton={false} render={<a href="/agent" />}>
            Read the settlement proof <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>

        <div className="relative mt-16 min-h-[21rem] lg:-mt-4 lg:ml-[31%]">
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">
            <span>return_url / untrusted</span><ArrowRightIcon className="size-3" /><span>signature / verified</span><ArrowRightIcon className="size-3" /><span>casper / recorded</span>
          </div>
          <div className="relative grid grid-cols-2 gap-3 pt-3 sm:grid-cols-4 sm:gap-4">
            {settlementSteps.map((step, index) => (
              <div key={step.label} className="relative flex min-h-40 flex-col justify-between border border-border bg-panel p-4 sm:min-h-48" style={{ transform: `translateY(${index * 20}px)` }}>
                <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
                <div className="relative z-10">
                  {step.trusted ? <CheckCircle2Icon className="mb-3 text-good" /> : <CircleAlertIcon className="mb-3 text-warn" />}
                  <strong className="block text-sm sm:text-base">{step.label}</strong>
                  <span className={`mt-1 block text-xs ${step.trusted ? 'text-good' : 'text-warn'}`}>{step.note}</span>
                </div>
                <span className="h-1 w-full bg-muted"><span className={`block h-full ${step.trusted ? 'w-full bg-good' : 'w-1/4 bg-warn'}`} /></span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-20 mt-14 ml-auto max-w-lg border border-border bg-panel p-5 sm:p-6 lg:-mt-4">
          <ProofRow icon={FingerprintIcon} label="Gateway payment hash" value="unique" />
          <ProofRow icon={CircleDollarSignIcon} label="Paid" value="USD 1,000.00" />
          <ProofRow icon={RadioTowerIcon} label="Deploy" value="9d32b43e…f00e9" mono />
          <ProofRow icon={LockKeyholeIcon} label="Claim" value="unlocked" />
        </div>
      </div>
    </section>
  );
}

function RolesSection() {
  return (
    <section id="roles" className="border-b border-border px-4 py-24 sm:px-6 md:py-32 lg:px-8">
      <div className="mx-auto max-w-[94rem]">
        <div className="max-w-3xl">
          <h2 className="m-0 max-w-[16ch] text-4xl font-medium leading-[0.98] tracking-[-0.04em] sm:text-5xl lg:text-6xl">One receivable. Four clear points of view.</h2>
          <p className="mb-0 mt-5 text-base text-muted-foreground sm:text-lg">Each participant sees only the evidence and action needed next.</p>
        </div>

        <div className="mt-14 grid overflow-hidden border border-border lg:grid-cols-[1.15fr_0.95fr_0.95fr_0.95fr]">
          <RolePanel title="Seller" index="01" featured>
            <div className="border border-dashed border-white/25 bg-panel p-5 text-center">
              <FileCheck2Icon className="mx-auto size-8 text-primary" />
              <strong className="mt-3 block text-sm">Upload evidence</strong>
              <span className="mt-1 block text-xs text-muted-foreground">PDF, PNG, JPG</span>
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <span className="text-xs text-muted-foreground">Offer summary</span>
              <strong className="mt-2 block text-2xl tabular-nums">$965.00 <small className="text-xs font-normal text-muted-foreground">today</small></strong>
              <Button className="mt-4 w-full" nativeButton={false} render={<a href="/seller/upload" />}>Create offer <ArrowRightIcon data-icon="inline-end" /></Button>
            </div>
          </RolePanel>

          <RolePanel title="Investor" index="02">
            <p className="m-0 text-xs text-muted-foreground">Funding terms</p>
            <div className="mt-5 space-y-3 text-sm">
              <KeyValue label="You fund" value="$965.00" />
              <KeyValue label="You receive" value="$1,000.00" />
              <KeyValue label="Return" value="3.63%" />
              <KeyValue label="Term" value="27 days" />
            </div>
            <Button variant="outline" className="mt-6 w-full text-primary" nativeButton={false} render={<a href="/investor" />}>Fund now <ArrowRightIcon data-icon="inline-end" /></Button>
          </RolePanel>

          <RolePanel title="Buyer" index="03">
            <p className="m-0 text-xs text-muted-foreground">Amount due</p>
            <strong className="mt-3 block text-3xl tabular-nums">$1,000.00</strong>
            <Button className="mt-6 w-full bg-foreground text-background hover:bg-foreground/80" nativeButton={false} render={<a href="/buyer/pay/INV-2026-018" />}>Pay with Dodo <ArrowRightIcon data-icon="inline-end" /></Button>
            <div className="mt-5 border border-border p-4">
              <span className="flex items-center gap-2 text-xs"><Clock3Icon className="size-4 text-muted-foreground" /> Payment pending confirmation</span>
              <p className="mb-0 mt-2 text-xs leading-5 text-muted-foreground">Awaiting verified webhook. The redirect cannot mark this paid.</p>
            </div>
          </RolePanel>

          <RolePanel title="Operator" index="04">
            <p className="m-0 text-xs text-muted-foreground">Agent trace</p>
            <div className="mt-5 space-y-4 border-l border-primary pl-4 text-sm">
              <TraceState label="Webhook verified" done />
              <TraceState label="Relayer confirmed" done />
              <TraceState label="Casper deploy" />
            </div>
            <div className="mt-6 border-t border-border pt-4">
              <span className="text-xs text-muted-foreground">Deploy hash</span>
              <strong className="mt-2 flex items-center justify-between font-mono text-sm text-primary">0x9d32…00e9 <CopyIcon className="size-3.5" /></strong>
            </div>
          </RolePanel>
        </div>

        <Button variant="link" className="mt-6 px-0 text-base" nativeButton={false} render={<a href="/seller/upload" />}>
          Open the product <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </div>
    </section>
  );
}

function ClosingSection() {
  return (
    <>
      <section id="onboarding" className="px-4 pb-24 pt-24 sm:px-6 md:pb-28 md:pt-32 lg:px-8">
        <div className="mx-auto max-w-[82rem] text-center">
          <h2 className="m-0 text-[clamp(3rem,6vw,6rem)] font-medium leading-[0.94] tracking-[-0.04em]">Put idle invoices to work.</h2>
          <p className="mx-auto mb-0 mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">Upload evidence as a seller, or inspect verified receivables as an investor.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" nativeButton={false} render={<a href="/seller/upload" />}>Upload an invoice <ArrowRightIcon data-icon="inline-end" /></Button>
            <Button size="lg" variant="outline" nativeButton={false} render={<a href="/investor" />}>Explore receivables</Button>
          </div>
          <Button variant="link" className="mt-3" nativeButton={false} render={<a href="#flow" />}>How it works <ArrowRightIcon data-icon="inline-end" /></Button>
          <div className="mt-12 text-left"><OnboardingPanel /></div>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-2"><LandmarkIcon className="size-4 text-primary" /> Casper testnet</span>
            <span className="flex items-center gap-2"><BadgeCheckIcon className="size-4 text-good" /> Dodo verified settlement</span>
            <span className="flex items-center gap-2"><CircleDollarSignIcon className="size-4 text-primary" /> Integer-cents accounting</span>
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[90rem] flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <a href="/" className="flex items-center gap-3 text-foreground" aria-label="Cortex home">
            <img src="/cortex-logo.png" alt="Cortex logo" className="size-10 rounded-lg object-cover" />
            <strong className="text-sm uppercase tracking-[0.3em]">Cortex</strong>
          </a>
          <nav className="flex flex-wrap gap-x-7 gap-y-3 text-sm text-muted-foreground" aria-label="Footer navigation">
            <a href="#flow" className="hover:text-foreground">Product</a>
            <a href="/investor" className="hover:text-foreground">Marketplace</a>
            <a href="/agent" className="hover:text-foreground">Agent operations</a>
            <a href="https://docs.casper.network/" className="hover:text-foreground">Documentation</a>
          </nav>
        </div>
      </footer>
    </>
  );
}

function ProofItem({ icon: Icon, children }: { icon: typeof ShieldCheckIcon; children: React.ReactNode }) {
  return <span className="flex items-center gap-2"><Icon className="size-4 text-primary" />{children}</span>;
}

function PaperField({ label, value }: { label: string; value: string }) {
  return <div><span className="block text-[0.55rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</span><strong className="mt-1 block border-b border-border pb-1 font-medium text-foreground">{value}</strong></div>;
}

function RedactedField({ label, width }: { label: string; width: string }) {
  return <div><span className="block text-[0.58rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</span><span className={`mt-2 block h-3 bg-muted ${width}`} /></div>;
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div><span className="block text-[0.68rem] text-muted-foreground">{label}</span><strong className={`mt-1 block font-medium tabular-nums ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</strong></div>;
}

function ProofRow({ icon: Icon, label, value, mono = false }: { icon: typeof WalletCardsIcon; label: string; value: string; mono?: boolean }) {
  return <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border py-3 first:pt-0 last:border-0 last:pb-0"><Icon className="size-4 text-muted-foreground" /><span className="text-sm">{label}</span><span className={`text-sm text-good ${mono ? 'font-mono' : ''}`}>{value}</span></div>;
}

function RolePanel({ title, index, featured = false, children }: { title: string; index: string; featured?: boolean; children: React.ReactNode }) {
  return <article className={`min-w-0 border-b border-border p-5 last:border-b-0 lg:min-h-[31rem] lg:border-b-0 lg:border-r lg:last:border-r-0 ${featured ? 'bg-panel' : 'bg-bg'}`}><header className="mb-7 flex items-center justify-between border-b border-border pb-4"><h3 className="m-0 text-xl font-medium"><span className="mr-3 text-primary">|</span>{title}</h3><span className="font-mono text-xs text-muted-foreground">{index}</span></header>{children}</article>;
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 border-b border-border pb-3"><span className="text-muted-foreground">{label}</span><strong className="font-medium tabular-nums">{value}</strong></div>;
}

function TraceState({ label, done = false }: { label: string; done?: boolean }) {
  return <div className="relative"><span className={`absolute -left-[1.29rem] top-1 size-2 rounded-full ${done ? 'bg-primary' : 'border border-primary bg-background'}`} /><strong className="block text-sm font-medium">{label}</strong><span className="mt-1 block text-xs text-muted-foreground">{done ? 'confirmed' : 'pending'}</span></div>;
}
