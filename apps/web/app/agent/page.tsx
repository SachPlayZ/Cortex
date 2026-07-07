import { BrainCircuitIcon, CableIcon, ShieldCheckIcon } from "lucide-react";
import { PageShell } from "../../components/page-shell";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

export const metadata = { title: "Agent operations | Cortex" };

const traces = [
  ["Parser Agent", "Extracts invoice number, buyer, amount, currency, due date, and terms."],
  ["FX Agent", "Normalizes original currency into USD cents using a timestamped quote."],
  ["Verification Agent", "Checks duplicates, due date, buyer shape, wallet, amount bounds, and schema completeness."],
  ["Risk Agent", "Assigns risk tier, discount bps, advance amount, repayment amount, and investor yield."],
  ["Settlement Monitor", "Waits for verified Dodo webhook and Casper repayment state."]
];

export default function AgentPage() {
  return (
    <PageShell
      eyebrow="Agent operations"
      title="Auditable underwriting, visible at every step."
      description="This dashboard is a product-facing trace of the agent pipeline. Raw model output is never treated as contract input."
    >
      <section className="grid gap-4 lg:grid-cols-[0.82fr_1.18fr]">
        <Card className="rounded-2xl border-white/10 bg-card/72">
          <CardHeader>
            <BrainCircuitIcon className="text-primary" />
            <CardTitle className="text-3xl tracking-normal">Validation boundary</CardTitle>
            <CardDescription>
              LLM/OCR output becomes schema-validated data, deterministic normalization, canonical JSON, and hashes.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {["Zod schemas", "Integer cents", "Basis points", "Canonical hashes", "Private data off-chain"].map((item) => (
              <div key={item} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.035] p-3">
                <span className="text-sm text-foreground">{item}</span>
                <Badge variant="secondary">enforced</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-3">
          {traces.map(([title, body], index) => (
            <Card key={title} className="rounded-2xl border-white/10 bg-background/54">
              <CardHeader className="md:grid-cols-[auto_1fr_auto] md:items-center">
                <span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">{index + 1}</span>
                <div>
                  <CardTitle className="text-xl tracking-normal">{title}</CardTitle>
                  <CardDescription>{body}</CardDescription>
                </div>
                {index === traces.length - 1 ? <CableIcon className="text-primary" /> : <ShieldCheckIcon className="text-primary" />}
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
