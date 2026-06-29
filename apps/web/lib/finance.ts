export type ReceivableView = {
  id: string;
  title?: string;
  sellerAccount?: string;
  investorAccount?: string;
  invoiceHash: `0x${string}`;
  originalCurrency?: string;
  originalAmountMinor?: string;
  usdAmountCents?: string;
  advanceAmountUsdCents?: string;
  repaymentAmountUsdCents: string;
  investorYieldUsdCents?: string;
  riskTier?: string;
  riskScore?: number;
  discountBps?: number;
  dueDate?: string;
  statusCasper: string;
  attestationHash?: `0x${string}`;
  agentConfidence?: number;
  lastRepaymentDeployHash?: string;
};

export function formatUsd(cents: string): string {
  const amount = BigInt(cents);
  const dollars = amount / 100n;
  const remainder = amount % 100n;
  return `$${dollars.toString()}.${remainder.toString().padStart(2, "0")}`;
}

export function expectedReturnPercent(invoice: { advanceAmountUsdCents?: string | undefined; investorYieldUsdCents?: string | undefined }): string {
  const advance = BigInt(invoice.advanceAmountUsdCents ?? "0");
  if (advance === 0n) return "0.00%";
  const scaled = (BigInt(invoice.investorYieldUsdCents ?? "0") * 10_000n) / advance;
  return `${(Number(scaled) / 100).toFixed(2)}%`;
}

export function aprEquivalent(invoice: {
  advanceAmountUsdCents?: string | undefined;
  investorYieldUsdCents?: string | undefined;
  dueDate?: string | undefined;
}): string {
  const advance = BigInt(invoice.advanceAmountUsdCents ?? "0");
  if (advance === 0n || !invoice.dueDate) return "0.00%";
  const dueTime = new Date(`${invoice.dueDate}T00:00:00.000Z`).getTime();
  const daysToDue = Math.max(1, Math.ceil((dueTime - Date.now()) / 86_400_000));
  const scaledBps = (BigInt(invoice.investorYieldUsdCents ?? "0") * 3_650_000n) / (advance * BigInt(daysToDue));
  return `${(Number(scaledBps) / 100).toFixed(2)}%`;
}

export function investorYield(invoice: { repaymentAmountUsdCents: string; advanceAmountUsdCents?: string | undefined }): string {
  const repayment = BigInt(invoice.repaymentAmountUsdCents);
  const advance = BigInt(invoice.advanceAmountUsdCents ?? "0");
  return repayment > advance ? (repayment - advance).toString() : "0";
}
