import { sha256Hex } from "@cortex/shared";

export type DemoInvoice = {
  id: string;
  title: string;
  sampleFile: string;
  seller: string;
  sellerAccount: string;
  buyerLabel: string;
  buyerHash: `0x${string}`;
  invoiceHash: `0x${string}`;
  originalAmount: string;
  originalCurrency: string;
  originalAmountMinor: string;
  usdAmountCents: string;
  fxRate: string;
  fxProvider: string;
  dueDate: string;
  riskTier: "Low" | "MediumLow" | "Medium" | "Rejected";
  riskScore: number;
  discountBps: number;
  advanceAmountUsdCents: string;
  repaymentAmountUsdCents: string;
  investorYieldUsdCents: string;
  statusCasper: string;
  statusLocal: string;
  agentConfidence: number;
  attestationHash: `0x${string}`;
  txHashes: Array<{ label: string; hash: string; note?: string }>;
  trace: Array<{ actor: string; event: string; status: "done" | "pending" | "blocked" }>;
};

export const demoInvoices: DemoInvoice[] = [
  {
    id: "crd-inr-live-001",
    title: "Low-risk INR invoice",
    sampleFile: "samples/invoices/low-risk-inr.txt",
    seller: "Asha Design Studio",
    sellerAccount: "casper-testnet-seller-01",
    buyerLabel: "buyer hash only",
    buyerHash: sha256Hex("Nexa Retail:nexa.example:live"),
    invoiceHash: sha256Hex("CM-INR-2026-LIVE-001"),
    originalAmount: "125000.00",
    originalCurrency: "INR",
    originalAmountMinor: "12500000",
    usdAmountCents: "132375",
    fxRate: "0.01059",
    fxProvider: "frankfurter",
    dueDate: "2026-09-15",
    riskTier: "Low",
    riskScore: 90,
    discountBps: 300,
    advanceAmountUsdCents: "128403",
    repaymentAmountUsdCents: "132375",
    investorYieldUsdCents: "3972",
    statusCasper: "RepaymentPending",
    statusLocal: "buyer_checkout_ready",
    agentConfidence: 0.94,
    attestationHash: sha256Hex("attestation-crd-inr-live-001"),
    txHashes: [
      { label: "Register agent", hash: "c62b6875db8722f008aea940308dae34012b955e67401f7c29a4f44ca681879b" },
      { label: "Register relayer", hash: "7ad6c44d716fc54451947ad14d54479befdf040cac097c832005ef63fd2e9fa0" },
      { label: "Create invoice", hash: "ef0619fa6dc67e0e3b1daad9c662a9be114b6641d084b378b2a872e72a150029" },
      { label: "Post risk", hash: "9aff741b3edc1933a690b4e5ada8430f865a65eabc664656e1c48e46b75586e7" },
      { label: "List", hash: "c483d6eeea0976f814a88f78a9d3e7cff81571dfd93bb8a7a0a3d9ad133335d4" },
      { label: "Fund", hash: "7dc999e2bf4da87efbd7dc3ab1d2b82586073d1b49673db5aa9e8ab87d5673ff" },
      { label: "Seller cash-out", hash: "54ec012862221554387e342cfbc12d831f1473a21b23c5b6d0f84ec2275a6fe2" }
    ],
    trace: [
      { actor: "Parser Agent", event: "Extracted amount INR 125000.00, due date, buyer domain.", status: "done" },
      { actor: "FX Agent", event: "Converted INR to USD cents with fixed-point rate 0.01059.", status: "done" },
      { actor: "Verification Agent", event: "Checked invoice hash uniqueness and future due date.", status: "done" },
      { actor: "Risk Agent", event: "Assigned Low risk, 300 bps discount.", status: "done" },
      { actor: "Dodo Webhook", event: "Waiting for signed payment.succeeded webhook.", status: "pending" },
      { actor: "Settlement Relayer", event: "Will submit record_gateway_repayment after webhook verification.", status: "pending" }
    ]
  },
  {
    id: "crd-usd-002",
    title: "Medium-risk USD invoice",
    sampleFile: "samples/invoices/medium-risk-usd.txt",
    seller: "Northwind Automation",
    sellerAccount: "casper-testnet-seller-02",
    buyerLabel: "buyer hash only",
    buyerHash: sha256Hex("Contoso Labs:contoso.example"),
    invoiceHash: sha256Hex("CM-USD-2026-002"),
    originalAmount: "4800.00",
    originalCurrency: "USD",
    originalAmountMinor: "480000",
    usdAmountCents: "480000",
    fxRate: "1",
    fxProvider: "manual-demo",
    dueDate: "2026-10-30",
    riskTier: "MediumLow",
    riskScore: 78,
    discountBps: 500,
    advanceAmountUsdCents: "456000",
    repaymentAmountUsdCents: "480000",
    investorYieldUsdCents: "24000",
    statusCasper: "Listed",
    statusLocal: "awaiting_investor",
    agentConfidence: 0.87,
    attestationHash: sha256Hex("attestation-crd-usd-002"),
    txHashes: [{ label: "Mint/list", hash: "casper-testnet-demo-mint-0002", note: "replace with deploy hash after live testnet run" }],
    trace: [
      { actor: "Parser Agent", event: "Extracted USD invoice with complete terms.", status: "done" },
      { actor: "FX Agent", event: "Normalized USD to USD cents.", status: "done" },
      { actor: "Verification Agent", event: "Buyer domain present, no duplicate hash.", status: "done" },
      { actor: "Risk Agent", event: "Assigned MediumLow risk, 500 bps discount.", status: "done" }
    ]
  },
  {
    id: "crd-fake-003",
    title: "Fake duplicate invoice",
    sampleFile: "samples/invoices/fake-duplicate.txt",
    seller: "Asha Design Studio",
    sellerAccount: "casper-testnet-seller-01",
    buyerLabel: "buyer hash only",
    buyerHash: sha256Hex("Nexa Retail:nexa.example"),
    invoiceHash: sha256Hex("CM-INR-2026-001"),
    originalAmount: "125000.00",
    originalCurrency: "INR",
    originalAmountMinor: "12500000",
    usdAmountCents: "132375",
    fxRate: "0.01059",
    fxProvider: "frankfurter",
    dueDate: "2026-09-15",
    riskTier: "Rejected",
    riskScore: 40,
    discountBps: 0,
    advanceAmountUsdCents: "0",
    repaymentAmountUsdCents: "132375",
    investorYieldUsdCents: "0",
    statusCasper: "Rejected",
    statusLocal: "duplicate_hash_blocked",
    agentConfidence: 0.91,
    attestationHash: sha256Hex("attestation-crd-fake-003"),
    txHashes: [],
    trace: [
      { actor: "Parser Agent", event: "Extracted invoice fields.", status: "done" },
      { actor: "Verification Agent", event: "Duplicate invoice hash detected.", status: "blocked" },
      { actor: "Risk Agent", event: "Rejected. No listing, no funding.", status: "blocked" }
    ]
  }
];

export function getDemoInvoice(invoiceId: string): DemoInvoice | undefined {
  return demoInvoices.find((invoice) => invoice.id === invoiceId);
}

export function formatUsd(cents: string): string {
  const amount = BigInt(cents);
  const dollars = amount / 100n;
  const remainder = amount % 100n;
  return `$${dollars.toString()}.${remainder.toString().padStart(2, "0")}`;
}

export function expectedReturnPercent(invoice: DemoInvoice): string {
  const advance = BigInt(invoice.advanceAmountUsdCents);
  if (advance === 0n) return "0.00%";
  const scaled = (BigInt(invoice.investorYieldUsdCents) * 10_000n) / advance;
  return `${(Number(scaled) / 100).toFixed(2)}%`;
}
