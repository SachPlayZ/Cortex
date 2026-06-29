# Cortex Contracts

Phase 2 target: Casper/Odra contracts for invoice registry, funding vault, repayment escrow, and agent reputation.

Current implementation contains:

- `InvoiceRegistry` as the lifecycle/source-of-truth registry.
- `FundingVault` as the owner/investor funded advance pool. It records investor funding and lets the seller cash out the advance.
- `RepaymentEscrow` as the Dodo webhook settlement escrow. It enforces gateway payment hash idempotency, underpayment rejection, and investor repayment claim.
- `AgentReputation` as the separate underwriting reputation ledger.
- A pure Rust state-machine core used for fast invariant-style tests.
- Duplicate invoice hash and gateway payment hash protection.
- Relayer-only repayment recording.
- Agent reputation updates on repayment/default.

## Strict MVP Flow

```txt
Seller creates invoice
Agent scores invoice
Seller lists invoice
Investor funds advance
FundingVault credits liquidity
Seller cashes out advance
Invoice becomes RepaymentPending
Dodo signed webhook confirms buyer payment
RepaymentEscrow records payment
Investor claims repayment amount: principal + yield
Agent reputation updates
```

Status path:

```txt
Created -> Scored -> Listed -> Funded -> RepaymentPending -> Repaid -> Settled
```

## Commands

```bash
cargo +nightly-2026-01-01 test
cargo +nightly-2026-01-01 check
cargo odra test
```

Casper backend tests:

```bash
cargo odra test -b casper -s
```

Builds four wasm artifacts:

```txt
contracts/wasm/InvoiceRegistry.wasm
contracts/wasm/FundingVault.wasm
contracts/wasm/RepaymentEscrow.wasm
contracts/wasm/AgentReputation.wasm
```

## Latest Testnet Deployment

Network:

```txt
chain_name=casper-test
rpc=http://185.170.112.40:7777/rpc
events=http://185.170.112.40:9999/events
deployer=02027164c96d7810a067865fc1dccade50e8d4aa405a40f70ed258dbf6685af663f5
```

Package hashes:

```txt
INVOICE_REGISTRY_PACKAGE_HASH=hash-67bbcb0eb017298988c3cad287e402c07b64ff21d5134ecbcdc154a716c764e2
FUNDING_VAULT_PACKAGE_HASH=hash-d52144504c35abf1d73a8f6b3c33cb46bf2a01cf1d7be4a3de819368381039cd
REPAYMENT_ESCROW_PACKAGE_HASH=hash-12770f581c0cd7d0a22daf776ef0ca232661878e08897e370b96657a9dfd1b98
AGENT_REPUTATION_PACKAGE_HASH=hash-6ec5e1b71ac41e14e773132e6d6764dfed3682eba40dae47d58546ffe9889b8a
```

Deploy receipts:

```txt
InvoiceRegistry=071cf3287f67e86aff4ca0ba3e10b4e48db2fa58088afc3c3ca6cbb68577d370
FundingVault=f33e071f5d6b4b991110fc6d8e7f6352a4597cf09c262bc97ef94deeafbdb6de
RepaymentEscrow=a68eacaac47aadcb27a3e2fb7fe33f130cf36707112fe170284e27a4c691bfe6
AgentReputation=ab388c4fed6f1495c375102c4f32dff5ed751143a01e1008071604859983d3bf
```

Notes:

- Odra 2.8.2 requires `nightly-2026-01-01`.
- `wasm32-unknown-unknown` must be installed for Casper backend builds.
- `contracts/.cargo/config.toml` disables wasm bulk memory for Casper VM compatibility.
- `cargo odra test -b casper` also expects `wasm-opt` from Binaryen unless using `-s` with an already generated wasm file.
