import { CheckCircle2Icon, CircleDashedIcon, Clock3Icon, XCircleIcon } from "lucide-react";
import { Badge } from "./ui/badge";

export function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const isBad = normalized.includes("rejected") || normalized.includes("blocked") || normalized.includes("defaulted") || normalized.includes("failed");
  const isPending = normalized.includes("pending") || normalized.includes("queued") || normalized.includes("waiting");
  const isGood = ["done", "created", "scored", "listed", "funded", "repaid", "settled", "confirmed", "registered", "verified", "real"]
    .some((value) => normalized.includes(value));
  const Icon = isBad ? XCircleIcon : isPending ? Clock3Icon : isGood ? CheckCircle2Icon : CircleDashedIcon;
  const variant = isBad ? "destructive" : isGood ? "default" : isPending ? "secondary" : "outline";

  return (
    <Badge variant={variant} role="status" aria-live="polite">
      <Icon data-icon="inline-start" />
      {status}
    </Badge>
  );
}
