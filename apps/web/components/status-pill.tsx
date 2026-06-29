import { cn } from "@/lib/utils";

export function StatusPill({ status }: { status: string }) {
  const isBad = status.includes("Rejected") || status.includes("blocked");
  const isWarn = status.includes("Pending");
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
        isBad && "bg-bad-dim text-bad",
        isWarn && !isBad && "bg-warn-dim text-warn",
        !isBad && !isWarn && "bg-good-dim text-good"
      )}
    >
      {status}
    </span>
  );
}
