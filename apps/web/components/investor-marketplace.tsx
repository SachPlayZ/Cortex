"use client";

import { useEffect, useMemo, useState } from "react";
import { aprEquivalent, expectedReturnPercent, formatUsd, investorYield, type ReceivableView } from "../lib/finance";
import { WalletGate, shortAccount, useCasperWallet } from "./casper-wallet";
import { StatusPill } from "./status-pill";

export function InvestorMarketplace() {
  return (
    <WalletGate role="investor" title="Connect the investor wallet before funding receivables.">
      <ConnectedInvestorMarketplace />
    </WalletGate>
  );
}

function ConnectedInvestorMarketplace() {
  const wallet = useCasperWallet();
  const marketplace = useReceivables({ status: "Listed" });
  const portfolio = useReceivables({ role: "investor", account: wallet.accountHash });
  const committed = useMemo(
    () => portfolio.invoices.reduce((sum, invoice) => sum + BigInt(invoice.advanceAmountUsdCents ?? "0"), 0n),
    [portfolio.invoices]
  );
  const expectedYield = useMemo(
    () => portfolio.invoices.reduce((sum, invoice) => sum + BigInt(invoice.investorYieldUsdCents ?? investorYield(invoice)), 0n),
    [portfolio.invoices]
  );

  return (
    <>
      <div className="sectionTitle">
        <h2>Investor marketplace</h2>
        <span className="walletBadge">Investor wallet {shortAccount(wallet.accountHash)}</span>
      </div>

      <section className="grid">
        <div className="metric">
          <div className="label">Portfolio committed</div>
          <div className="value">{formatUsd(committed.toString())}</div>
          <div className="metric-sub">Crypto-funded receivable positions for this wallet</div>
        </div>
        <div className="metric">
          <div className="label">Expected yield</div>
          <div className="value good">{formatUsd(expectedYield.toString())}</div>
          <div className="metric-sub">Claims unlock after Dodo webhook settlement</div>
        </div>
        <div className="metric">
          <div className="label">Open listings</div>
          <div className="value">{marketplace.invoices.length}</div>
          <div className="metric-sub">Live receivables listed from real uploads</div>
        </div>
      </section>

      <div className="sectionTitle"><h2>Available receivables</h2></div>
      {marketplace.state === "loading" ? <section className="panel emptyState"><h3>Loading marketplace...</h3></section> : null}
      {marketplace.state === "error" ? <section className="panel emptyState"><h3>Marketplace unavailable</h3><p className="error">{marketplace.error}</p></section> : null}
      {marketplace.state === "ready" && marketplace.invoices.length === 0 ? (
        <section className="panel emptyState">
          <h3>No listed receivables yet.</h3>
          <p className="fineprint">Clean slate. Invoices appear here only after real seller underwriting and Casper listing.</p>
        </section>
      ) : null}
      {marketplace.invoices.length > 0 ? (
        <section className="marketGrid">
          {marketplace.invoices.map((invoice) => (
            <article className="marketCard" key={invoice.id}>
              <div className="marketCardTop">
                <div>
                  <span className="label">{invoice.id}</span>
                  <h3>{invoice.title ?? "Receivable"}</h3>
                </div>
                <StatusPill status={invoice.statusCasper} />
              </div>
              <div className="marketNumbers">
                <Result label="Fund" value={formatUsd(invoice.advanceAmountUsdCents ?? "0")} />
                <Result label="Receive" value={formatUsd(invoice.repaymentAmountUsdCents)} />
                <Result label="Yield" value={`${formatUsd(invoice.investorYieldUsdCents ?? investorYield(invoice))} / ${expectedReturnPercent(invoice)}`} />
                <Result label="APR display" value={aprEquivalent(invoice)} />
              </div>
              <p className="fineprint">
                Risk {invoice.riskTier ?? "pending"} / {invoice.riskScore ?? "-"}.
                {invoice.dueDate ? ` Due ${invoice.dueDate}.` : ""} Agent confidence{" "}
                {invoice.agentConfidence ? `${(invoice.agentConfidence * 100).toFixed(0)}%` : "pending"}.
              </p>
              <a className="primary" href={`/invoice/${invoice.id}`}>Inspect and fund</a>
            </article>
          ))}
        </section>
      ) : null}

      <div className="sectionTitle"><h2>Current portfolio</h2></div>
      {portfolio.state === "ready" && portfolio.invoices.length === 0 ? (
        <section className="panel emptyState">
          <h3>No funded invoices for this wallet yet.</h3>
          <p className="fineprint">Fund a listed receivable to add it to this connected wallet’s portfolio.</p>
        </section>
      ) : null}
      {portfolio.invoices.length > 0 ? (
        <section className="invoiceList">
          {portfolio.invoices.map((invoice) => (
            <a className="invoiceRow portfolioRow" href={`/invoice/${invoice.id}`} key={invoice.id}>
              <div><strong>{invoice.id}</strong><br /><span className="fineprint">Due {invoice.dueDate ?? "not set"}</span></div>
              <div>{formatUsd(invoice.advanceAmountUsdCents ?? "0")} funded</div>
              <div>{formatUsd(invoice.investorYieldUsdCents ?? investorYield(invoice))} yield</div>
              <div><StatusPill status={invoice.statusCasper} /></div>
              <div>Claim</div>
            </a>
          ))}
        </section>
      ) : null}
    </>
  );
}

function useReceivables(filter: { role?: "investor"; account?: string; status?: string }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [invoices, setInvoices] = useState<ReceivableView[]>([]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (filter.role) params.set("role", filter.role);
    if (filter.account) params.set("account", filter.account);
    if (filter.status) params.set("status", filter.status);

    async function load() {
      setState("loading");
      setError("");
      try {
        const response = await fetch(`/api/invoices?${params.toString()}`, { cache: "no-store" });
        const body = (await response.json()) as { invoices?: ReceivableView[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? "Unable to load receivables");
        if (!cancelled) {
          setInvoices(body.invoices ?? []);
          setState("ready");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load receivables");
          setState("error");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [filter.account, filter.role, filter.status]);

  return { invoices, state, error };
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
