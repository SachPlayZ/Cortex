export type ReceivableView = {
  id: string;
  title?: string | undefined;
  sellerAccount?: string | undefined;
  sellerPublicKey?: string | undefined;
  investorAccount?: string | undefined;
  investorPublicKey?: string | undefined;
  invoiceHash: `0x${string}`;
  casperInvoiceIdHash?: `0x${string}` | undefined;
  originalCurrency?: string | undefined;
  originalAmountMinor?: string | undefined;
  usdAmountCents?: string | undefined;
  advanceAmountUsdCents?: string | undefined;
  repaymentAmountUsdCents: string;
  investorYieldUsdCents?: string | undefined;
  riskTier?: string | undefined;
  riskScore?: number | undefined;
  discountBps?: number | undefined;
  dueDate?: string | undefined;
  statusCasper: string;
  attestationHash?: `0x${string}` | undefined;
  agentConfidence?: number | undefined;
  casperInvoiceExists?: boolean | undefined;
  createDeployHash?: string | undefined;
  scoreDeployHash?: string | undefined;
  listDeployHash?: string | undefined;
  fundDeployHash?: string | undefined;
  cashoutDeployHash?: string | undefined;
  claimDeployHash?: string | undefined;
  dodoCheckoutUrl?: string | undefined;
  lastRepaymentDeployHash?: string | undefined;
  statusLastSyncedAt?: string | undefined;
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
  const daysToDue = Math.ceil((dueTime - Date.now()) / 86_400_000);
  if (daysToDue < 1) return "Past due";
  const scaledBps = (BigInt(invoice.investorYieldUsdCents ?? "0") * 3_650_000n) / (advance * BigInt(daysToDue));
  return `${(Number(scaledBps) / 100).toFixed(2)}%`;
}

export function investorYield(invoice: { repaymentAmountUsdCents: string; advanceAmountUsdCents?: string | undefined }): string {
  const repayment = BigInt(invoice.repaymentAmountUsdCents);
  const advance = BigInt(invoice.advanceAmountUsdCents ?? "0");
  return repayment > advance ? (repayment - advance).toString() : "0";
}
