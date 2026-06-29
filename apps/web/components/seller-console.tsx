"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUsd, type ReceivableView } from "../lib/finance";
import { WalletGate, shortAccount, useCasperWallet } from "./casper-wallet";
import { HostedPaymentLinkActions } from "./hosted-payment-link-actions";
import { StatusPill } from "./status-pill";

export function SellerConsole() {
  return (
    <WalletGate role="seller" title="Connect the freelancer wallet to see your invoices.">
      <ConnectedSellerConsole />
    </WalletGate>
  );
}

function ConnectedSellerConsole() {
  const wallet = useCasperWallet();
  const { invoices, state, error } = useInvoices("seller", wallet.accountHash);
  const faceValue = useMemo(() => invoices.reduce((sum, invoice) => sum + BigInt(invoice.usdAmountCents ?? "0"), 0n), [invoices]);
  const advanced = useMemo(() => invoices.reduce((sum, invoice) => sum + BigInt(invoice.advanceAmountUsdCents ?? "0"), 0n), [invoices]);

  return (
    <>
      <div className="sectionTitle">
        <h2>Freelancer workspace</h2>
        <a className="primary" href="/seller/upload">Upload invoice</a>
      </div>

      <section className="grid">
        <div className="metric">
          <div className="label">Connected wallet</div>
          <div className="value compactValue">{shortAccount(wallet.accountHash)}</div>
          <div className="metric-sub">Seller identity for uploads and receivable listing</div>
        </div>
        <div className="metric">
          <div className="label">Face value</div>
          <div className="value">{formatUsd(faceValue.toString())}</div>
          <div className="metric-sub">Real invoices owned by this wallet</div>
        </div>
        <div className="metric">
          <div className="label">Advance available</div>
          <div className="value good">{formatUsd(advanced.toString())}</div>
          <div className="metric-sub">Unlocks after investor funding and Casper confirmation</div>
        </div>
      </section>

      <div className="sectionTitle"><h2>Freelancer actions</h2></div>
      <section className="roleGrid">
        <div className="roleCard">
          <span className="label">Upload</span>
          <h3>Submit a new invoice</h3>
          <p>Run parser, FX, verification, risk pricing, and prepare a receivable for Casper mint/list.</p>
          <a className="primary" href="/seller/upload">Upload invoice</a>
        </div>
        <div className="roleCard">
          <span className="label">Withdrawals</span>
          <h3>Advance withdrawal</h3>
          <p>After investor funding, withdraw the advanced amount tied to this wallet.</p>
          <button className="secondary" type="button" disabled>Awaiting funded invoices</button>
        </div>
        <div className="roleCard">
          <span className="label">Client reminders</span>
          <h3>Hosted Dodo links only</h3>
          <p>Generate a hosted checkout URL from a repayment-pending invoice and send that link to the client.</p>
        </div>
      </section>

      <div className="sectionTitle"><h2>Uploaded invoices</h2></div>
      {state === "loading" ? <section className="panel emptyState"><h3>Loading invoices...</h3></section> : null}
      {state === "error" ? <section className="panel emptyState"><h3>Could not load invoices</h3><p className="error">{error}</p></section> : null}
      {state === "ready" && invoices.length === 0 ? (
        <section className="panel emptyState">
          <h3>No invoices yet.</h3>
          <p className="fineprint">Clean slate. Upload a real invoice from this connected Casper account to begin.</p>
          <a className="primary" href="/seller/upload">Upload invoice</a>
        </section>
      ) : null}
      {invoices.length > 0 ? (
        <section className="invoiceList">
          {invoices.map((invoice) => (
            <article className="invoiceRow sellerInvoicesRow" key={invoice.id}>
              <div><strong>{invoice.title ?? invoice.id}</strong><br /><span className="fineprint">Due {invoice.dueDate ?? "not set"}</span></div>
              <div>{formatUsd(invoice.usdAmountCents ?? invoice.repaymentAmountUsdCents)}</div>
              <div>{formatUsd(invoice.advanceAmountUsdCents ?? "0")}</div>
              <div><StatusPill status={invoice.statusCasper} /></div>
              <div><a className="secondary" href={`/invoice/${invoice.id}`}>Review</a></div>
              {invoice.statusCasper === "RepaymentPending" ? (
                <div className="invoiceRowExpanded">
                  <HostedPaymentLinkActions invoiceId={invoice.id} />
                </div>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}
    </>
  );
}

export function useInvoices(role: "seller" | "investor", account: string) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [invoices, setInvoices] = useState<ReceivableView[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      setError("");
      try {
        const response = await fetch(`/api/invoices?role=${role}&account=${encodeURIComponent(account)}`, { cache: "no-store" });
        const body = (await response.json()) as { invoices?: ReceivableView[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? "Unable to load invoices");
        if (!cancelled) {
          setInvoices(body.invoices ?? []);
          setState("ready");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load invoices");
          setState("error");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [account, role]);

  return { invoices, state, error };
}
