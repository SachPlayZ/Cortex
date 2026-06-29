import { OnboardingPanel } from "../components/onboarding";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <p className="hero-eyebrow">AI-underwritten receivables on Casper</p>
          <h1>Get paid early. Let agents underwrite the invoice.</h1>
          <p className="lead">
            Cortex turns a freelancer invoice into a wallet-bound Casper receivable, lets one investor
            fund it, and settles only after a verified Dodo webhook proves the client paid in fiat.
          </p>
          <div className="heroActions">
            <a className="primary" href="#onboarding">Start onboarding</a>
            <a className="secondary" href="#how-it-works">How it works</a>
          </div>
          <div className="hero-chips">
            <span className="chip"><span className="chip-dot" />Freelancer wallet gates uploads</span>
            <span className="chip"><span className="chip-dot" />Investor wallet signs funding</span>
            <span className="chip"><span className="chip-dot" />Client pays without a wallet</span>
          </div>
        </div>

        <div className="panel live-card">
          <div className="live-card-header">
            <span className="label">Onboarding model</span>
            <span className="pill good">Wallet gated</span>
          </div>
          <div className="live-card-meta">
            <span className="label">Public surface</span>
            <p className="live-card-title">No dashboards until the wallet tells Cortex who you are.</p>
          </div>
          <hr className="live-card-divider" />
          <div className="live-card-grid">
            <div className="live-card-stat">
              <span className="label">Freelancer</span>
              <span className="live-card-value">Upload</span>
            </div>
            <div className="live-card-stat">
              <span className="label">Investor</span>
              <span className="live-card-value">Fund</span>
            </div>
            <div className="live-card-stat">
              <span className="label">Client</span>
              <span className="live-card-value good">Pay link</span>
            </div>
            <div className="live-card-stat">
              <span className="label">Settlement</span>
              <span className="live-card-value">Webhook</span>
            </div>
          </div>
          <p className="fineprint">
            Clients only receive hosted Dodo checkout links. Agent and admin routes stay out of public navigation.
          </p>
        </div>
      </section>

      <OnboardingPanel />

      <div className="grid" id="how-it-works">
        <div className="metric">
          <div className="label">Freelancer</div>
          <div className="value compactValue">Submit invoice</div>
          <div className="metric-sub">Wallet-bound uploads, optional client email, reminders, listing, and withdrawal state.</div>
        </div>
        <div className="metric">
          <div className="label">Investor</div>
          <div className="value compactValue">Fund receivable</div>
          <div className="metric-sub">Marketplace, yield math, crypto funding, portfolio, and claim actions.</div>
        </div>
        <div className="metric">
          <div className="label">Client</div>
          <div className="value compactValue good">Hosted checkout</div>
          <div className="metric-sub">No wallet. They only get a Dodo link and a payment status page.</div>
        </div>
      </div>
    </>
  );
}
