import { OnboardingPanel } from "../components/onboarding";

export default function HomePage() {
  return (
    <>
      <section className="mb-9 grid min-h-[560px] grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)] items-center gap-9 border-b border-line py-9 pb-[46px] max-sm:grid-cols-1 max-sm:min-h-0 max-sm:pt-4">
        <div className="flex flex-col">
          <p className="mb-[22px] inline-flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-cortex-accent before:inline-block before:h-px before:w-[18px] before:shrink-0 before:bg-current before:content-['']">
            AI-underwritten receivables on Casper
          </p>
          <h1 className="mb-5 max-w-[780px] text-[clamp(42px,6.6vw,86px)] font-extrabold leading-[0.96] tracking-[-0.055em] text-ink">
            Get paid early. Let agents underwrite the invoice.
          </h1>
          <p className="mb-7 max-w-[620px] text-[15.5px] leading-[1.65] text-ink-muted">
            Cortex turns a freelancer invoice into a wallet-bound Casper receivable, lets one investor
            fund it, and settles only after a verified Dodo webhook proves the client paid in fiat.
          </p>
          <div className="mb-[18px] flex flex-wrap gap-2.5">
            <a
              className="inline-flex items-center justify-center rounded-lg border border-primary bg-primary px-4 py-2 text-[13.5px] font-semibold text-primary-foreground transition-opacity hover:opacity-88"
              href="#onboarding"
            >
              Start onboarding
            </a>
            <a
              className="inline-flex items-center justify-center rounded-lg border border-line px-4 py-2 text-[13px] font-semibold text-ink-muted transition-colors hover:bg-panel-elevated hover:text-ink"
              href="#how-it-works"
            >
              How it works
            </a>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              "Freelancer wallet gates uploads",
              "Investor wallet signs funding",
              "Client pays without a wallet"
            ].map((text) => (
              <span
                key={text}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-[rgba(17,17,22,0.72)] px-3 py-1 text-xs font-medium text-ink-muted"
              >
                <span className="size-1.5 shrink-0 rounded-full bg-cortex-accent" />
                {text}
              </span>
            ))}
          </div>
        </div>

        {/* Live card */}
        <div className="relative flex flex-col gap-[18px] overflow-hidden rounded-[10px] border border-line bg-gradient-to-b from-[rgba(24,24,28,0.96)] to-[rgba(17,17,22,0.96)] p-[22px] shadow-[0_24px_80px_rgba(0,0,0,0.34)]">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-accent-2 via-cortex-accent to-transparent" />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">Onboarding model</span>
            <span className="inline-flex w-fit items-center rounded-full bg-good-dim px-2.5 py-0.5 text-[11px] font-semibold text-good">
              Wallet gated
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">Public surface</span>
            <p className="m-0 text-[15px] font-semibold leading-[1.3] tracking-tight text-ink">
              No dashboards until the wallet tells Cortex who you are.
            </p>
          </div>
          <hr className="m-0 h-px border-0 bg-line" />
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Freelancer", value: "Upload", good: false },
              { label: "Investor", value: "Fund", good: false },
              { label: "Client", value: "Pay link", good: true },
              { label: "Settlement", value: "Webhook", good: false }
            ].map(({ label, value, good }) => (
              <div key={label} className="flex flex-col gap-1">
                <span className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">{label}</span>
                <span className={`text-[19px] font-bold tracking-[-0.025em] tabular-nums ${good ? "text-good" : "text-ink"}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
          <p className="m-0 text-xs leading-relaxed text-ink-muted">
            Clients only receive hosted Dodo checkout links. Agent and admin routes stay out of public navigation.
          </p>
        </div>
      </section>

      <OnboardingPanel />

      <div id="how-it-works" className="mb-10 grid grid-cols-3 gap-3 max-sm:grid-cols-1">
        {[
          {
            role: "Freelancer",
            value: "Submit invoice",
            sub: "Wallet-bound uploads, optional client email, reminders, listing, and withdrawal state.",
            good: false
          },
          {
            role: "Investor",
            value: "Fund receivable",
            sub: "Marketplace, yield math, crypto funding, portfolio, and claim actions.",
            good: false
          },
          {
            role: "Client",
            value: "Hosted checkout",
            sub: "No wallet. They only get a Dodo link and a payment status page.",
            good: true
          }
        ].map(({ role, value, sub, good }) => (
          <div key={role} className="flex flex-col gap-1.5 rounded-[10px] border border-line bg-panel px-6 py-[22px]">
            <div className="text-[11px] font-medium uppercase tracking-widest text-ink-muted">{role}</div>
            <div className={`text-lg font-extrabold tracking-[-0.03em] tabular-nums ${good ? "text-good" : "text-ink"}`}>
              {value}
            </div>
            <div className="mt-0.5 text-xs text-ink-muted-2">{sub}</div>
          </div>
        ))}
      </div>
    </>
  );
}
