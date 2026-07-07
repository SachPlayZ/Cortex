import { cn } from "@/lib/utils";

export function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const isBad = normalized.includes("rejected") || normalized.includes("blocked") || normalized.includes("defaulted");
  const isWarn = normalized.includes("pending");
  const isNeutral = normalized.includes("skipped");
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
        isBad && "bg-bad-dim text-bad",
        isWarn && !isBad && "bg-warn-dim text-warn",
        isNeutral && !isBad && !isWarn && "bg-panel-elevated text-ink-muted",
        !isBad && !isWarn && !isNeutral && "bg-good-dim text-good"
      )}
    >
      {status}
    </span>
  );
}
