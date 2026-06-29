const invoices = [
  ["crd-inr-001", "samples/invoices/low-risk-inr.txt", "RepaymentPending"],
  ["crd-usd-002", "samples/invoices/medium-risk-usd.txt", "Listed"],
  ["crd-fake-003", "samples/invoices/fake-duplicate.txt", "Rejected"]
];

console.log("Cortex demo seed");
for (const [id, file, status] of invoices) {
  console.log(`${id}\t${status}\t${file}`);
}
console.log("Start UI: pnpm dev");
