import { KeyRoundIcon, RadioTowerIcon, RefreshCwIcon, ShieldAlertIcon } from "lucide-react";
import { PageShell } from "../../components/page-shell";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Separator } from "../../components/ui/separator";
import { CasperLifecycleService } from "../../server/integrations/casper-lifecycle";
import { getPaymentRuntime } from "../../server/payment-runtime";

export const metadata = { title: "Relayer ops | Cortex" };
export const dynamic = "force-dynamic";

const ops = [
  { title: "Casper bootstrap", body: "Registers the underwriting agent, settlement relayer, and optional vault liquidity.", Icon: KeyRoundIcon },
  { title: "Casper sync", body: "Reconciles contract-backed invoice state and drains retryable relayer jobs.", Icon: RefreshCwIcon },
  { title: "Webhook safety", body: "Requires raw-body signature verification, amount checks, metadata checks, and idempotency.", Icon: RadioTowerIcon },
  { title: "Production guard", body: "Fails closed when secrets, Postgres, or relayer configuration are missing.", Icon: ShieldAlertIcon }
];

export default async function AdminPage() {
  const health = await new CasperLifecycleService().getHealth().catch(() => undefined);
  const runtime = await getPaymentRuntime().catch(() => undefined);
  const retryableJobs = runtime ? await runtime.paymentStore.listRetryableRelayerJobs(10).catch(() => []) : [];
  const checks = [
    ["Lifecycle", health?.lifecycle_mode ?? "unavailable", health?.lifecycle_mode === "real"],
    ["Underwriting agent", health?.bootstrap.agentRegistered ? "registered" : "missing", Boolean(health?.bootstrap.agentRegistered)],
    ["Settlement relayer", health?.bootstrap.settlementRelayerRegistered ? "registered" : "missing", Boolean(health?.bootstrap.settlementRelayerRegistered)],
    ["Retry queue", `${retryableJobs.length} pending`, retryableJobs.length === 0]
  ] as const;

  return (
    <PageShell
      eyebrow="Relayer operations"
      title="Operate the bridge without weakening the trust boundary."
      description="Server-read readiness, replay-safe repayment jobs, and Casper reconciliation. Client assertions never count as financial proof."
    >
      <Alert>
        <ShieldAlertIcon />
        <AlertTitle>Server-only surface</AlertTitle>
        <AlertDescription>Sensitive actions stay behind authenticated routes. This page reports state; it does not expose relayer secrets or private keys.</AlertDescription>
      </Alert>

      <Card>
        <CardHeader><CardTitle>Live system state</CardTitle><CardDescription>Readiness derived from the server and contract configuration.</CardDescription></CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {checks.map(([label, value, ok]) => <HealthItem key={label} label={label} value={value} ok={ok} />)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Operational controls</CardTitle><CardDescription>Each control exists to preserve an explicit safety invariant.</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-0">
          {ops.map(({ title, body, Icon }, index) => (
            <div key={title}>
              <div className="grid gap-4 py-5 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                <div className="grid size-10 place-items-center rounded-lg bg-muted text-primary"><Icon /></div>
                <div><p className="m-0 font-medium text-foreground">{title}</p><p className="m-0 mt-1 text-sm text-muted-foreground">{body}</p></div>
                <Badge variant="secondary">server-only</Badge>
              </div>
              {index < ops.length - 1 ? <Separator /> : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </PageShell>
  );
}

function HealthItem({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return <div className="flex min-w-0 flex-col gap-3"><span className="text-sm text-muted-foreground">{label}</span><Badge variant={ok ? "default" : "destructive"} className="max-w-full">{value}</Badge></div>;
}
