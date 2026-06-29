export function StatusPill({ status }: { status: string }) {
  const tone = status.includes("Rejected") || status.includes("blocked") ? "bad" : status.includes("Pending") ? "warn" : "good";
  return <span className={`pill ${tone}`}>{status}</span>;
}
