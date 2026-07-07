import { KeyRoundIcon, RadioTowerIcon, RefreshCwIcon, ShieldAlertIcon } from "lucide-react";
import { PageShell } from "../../components/page-shell";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

export const metadata = { title: "Relayer ops | Cortex" };

const ops = [
  {
    title: "Casper bootstrap",
    body: "Registers the underwriting agent, settlement relayer, and optional vault liquidity.",
    Icon: KeyRoundIcon
  },
  {
    title: "Casper sync",
    body: "Reconciles contract-backed invoice state and drains retryable relayer jobs.",
    Icon: RefreshCwIcon
  },
  {
    title: "Webhook safety",
    body: "Requires raw-body signature verification, amount checks, metadata checks, and idempotency.",
    Icon: RadioTowerIcon
  },
  {
    title: "Production guard",
    body: "Fails closed when secrets, Postgres, or relayer configuration are missing.",
    Icon: ShieldAlertIcon
  }
];

export default function AdminPage() {
  return (
    <PageShell
      eyebrow="Relayer operations"
      title="Admin controls are explicit and safety-first."
      description="This page documents the operational surface. Sensitive actions remain behind server routes and admin authentication."
    >
      <section className="grid gap-4 md:grid-cols-2">
        {ops.map(({ title, body, Icon }) => {
          return (
            <Card key={title} className="rounded-2xl border-white/10 bg-card/72">
              <CardHeader>
                <div className="mb-4 grid size-11 place-items-center rounded-full border border-white/10 bg-primary/10 text-primary">
                  <Icon />
                </div>
                <CardTitle className="text-2xl tracking-normal">{title}</CardTitle>
                <CardDescription className="leading-6">{body}</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary">server-only</Badge>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </PageShell>
  );
}
