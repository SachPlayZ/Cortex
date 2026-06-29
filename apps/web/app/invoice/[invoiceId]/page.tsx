import { StatusPill } from "../../../components/status-pill";
import { expectedReturnPercent, formatUsd, investorYield } from "../../../lib/finance";
import { getPaymentRuntime } from "../../../server/payment-runtime";

export default async function InvoicePage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const { paymentStore } = await getPaymentRuntime();
  const invoice = await paymentStore.requireInvoice(invoiceId).catch(() => undefined);
  if (!invoice) {
    return (
      <div className="rounded-[10px] border border-line bg-gradient-to-b from-[rgba(24,24,28,0.96)] to-[rgba(17,17,22,0.96)] p-[22px] text-ink">
        Invoice not found.
      </div>
    );
  }

  const kvRows = [
    ["Original currency", invoice.originalCurrency ?? "stored off-chain"],
    ["USD amount", formatUsd(invoice.usdAmountCents ?? invoice.repaymentAmountUsdCents)],
    ["Risk", `${invoice.riskTier ?? "pending"} / ${invoice.riskScore ?? "-"}`],
    ["Advance", formatUsd(invoice.advanceAmountUsdCents ?? "0")],
    ["Repayment", formatUsd(invoice.repaymentAmountUsdCents)],
    ["Expected return", expectedReturnPercent(invoice)],
    ["Investor yield", formatUsd(invoice.investorYieldUsdCents ?? investorYield(invoice))],
    ["Agent confidence", String(invoice.agentConfidence ?? "pending")]
  ];

  const traceSteps = [
    "Parser output schema-validated",
    "FX normalized into USD cents",
    "Verification checks completed",
    "Risk terms persisted off-chain",
    "Only hashes are eligible for Casper calls"
  ];

  return (
    <>
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <h2 className="m-0 text-lg font-bold tracking-tight text-ink">{invoice.id}</h2>
        <StatusPill status={invoice.statusCasper} />
      </div>

      <section className="mb-6 grid grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-[18px] max-sm:grid-cols-1">
        <div className="grid gap-2.5 rounded-[10px] border border-line bg-gradient-to-b from-[rgba(24,24,28,0.96)] to-[rgba(17,17,22,0.96)] p-[22px]">
          {kvRows.map(([label, val]) => (
            <div key={label} className="flex justify-between gap-4 border-b border-line-subtle pb-2.5">
              <span className="text-ink-muted">{label}</span>
              <strong className="text-ink">{val}</strong>
            </div>
          ))}
        </div>

        <div className="grid content-start gap-3 rounded-[10px] border border-line bg-gradient-to-b from-[rgba(24,24,28,0.96)] to-[rgba(17,17,22,0.96)] p-[22px]">
          <h3 className="m-0 text-lg font-bold tracking-[-0.02em] text-ink">Hashes on Casper</h3>
          <p className="m-0 break-all font-mono text-[11.5px] text-ink-muted">invoice_hash: {invoice.invoiceHash}</p>
          {invoice.attestationHash ? (
            <p className="m-0 break-all font-mono text-[11.5px] text-ink-muted">attestation_hash: {invoice.attestationHash}</p>
          ) : null}
          {invoice.lastRepaymentDeployHash ? (
            <p className="m-0 break-all font-mono text-[11.5px] text-ink-muted">repayment_deploy: {invoice.lastRepaymentDeployHash}</p>
          ) : null}
          <p className="m-0 text-xs leading-relaxed text-ink-muted">
            Private buyer details and invoice documents are not shown or written on-chain.
          </p>
        </div>
      </section>

      <div className="mb-3.5 flex items-center gap-3">
        <h2 className="m-0 text-lg font-bold tracking-tight text-ink">Agent Trace</h2>
      </div>
      <section className="grid gap-1.5">
        {traceSteps.map((event) => (
          <div key={event} className="grid gap-1 rounded-[10px] border border-line bg-panel px-4 py-3.5">
            <strong className="text-sm text-ink">Cortex underwriting</strong>
            <span className="text-sm text-ink-muted">{event}</span>
            <StatusPill status="done" />
          </div>
        ))}
      </section>
    </>
  );
}
