# Cortex Contracts

Current implementation contains:

- `InvoiceRegistry` as canonical invoice metadata and lifecycle registry.
- `FundingVault` as investor-funded advance pool and seller cashout module.
- `RepaymentEscrow` as Dodo webhook settlement and investor claim module.
- `AgentReputation` as underwriting reputation ledger.
- A pure Rust state-machine core used for fast invariant-style tests.
- Duplicate invoice hash and gateway payment hash protection.
- Relayer-only repayment recording.
- Agent reputation updates on repayment/default.

## Strict MVP Flow

```txt
Seller creates invoice
Agent scores invoice
Seller lists invoice
Investor funds advance through FundingVault
Backend arms RepaymentEscrow position
Seller optionally cashes out advance
Invoice becomes RepaymentPending
Dodo signed webhook confirms buyer payment
RepaymentEscrow records payment
Investor claims repayment amount: principal + yield
AgentReputation updates after score/repayment/default
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

Build produces four wasm artifacts:

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

| Contract | Package hash | Explorer |
| --- | --- | --- |
| `InvoiceRegistry` | `hash-5fef146666891b7af8465e6030028f336aa2efe6e0e6d2ba520b5210877642c4` | [package](https://testnet.cspr.live/contract-package/5fef146666891b7af8465e6030028f336aa2efe6e0e6d2ba520b5210877642c4) |
| `FundingVault` | `hash-756757ea8d976f7cdfbae9852fc653f3e0cab00dacd729cc6564943f4584982c` | [package](https://testnet.cspr.live/contract-package/756757ea8d976f7cdfbae9852fc653f3e0cab00dacd729cc6564943f4584982c) |
| `RepaymentEscrow` | `hash-5ca1cb4499af61e4cec8e51ae105c005e1d11cc9ba5685e09c2c5d4c4dea448f` | [package](https://testnet.cspr.live/contract-package/5ca1cb4499af61e4cec8e51ae105c005e1d11cc9ba5685e09c2c5d4c4dea448f) |
| `AgentReputation` | `hash-1f17052480f6cc3e639eccfb8b5b8aafa600cda610ddcb977f0f10534863984e` | [package](https://testnet.cspr.live/contract-package/1f17052480f6cc3e639eccfb8b5b8aafa600cda610ddcb977f0f10534863984e) |

Deploy receipts:

| Contract | Deploy tx | Explorer |
| --- | --- | --- |
| `InvoiceRegistry` | `2f47bfdb3641d8a2ba125942db1fced3855999c14f12eb50e2a5e093eedb45ce` | [tx](https://testnet.cspr.live/transaction/2f47bfdb3641d8a2ba125942db1fced3855999c14f12eb50e2a5e093eedb45ce) |
| `FundingVault` | `41db2ddec6b90d30a0bf335ac74846ce4238e7f97a32fa2e5ed03d1049f4aaa7` | [tx](https://testnet.cspr.live/transaction/41db2ddec6b90d30a0bf335ac74846ce4238e7f97a32fa2e5ed03d1049f4aaa7) |
| `RepaymentEscrow` | `7c63c5bbcf956ae5e9f2f00d55f6ca79e1dcefe74e2e2746152e09460819cc21` | [tx](https://testnet.cspr.live/transaction/7c63c5bbcf956ae5e9f2f00d55f6ca79e1dcefe74e2e2746152e09460819cc21) |
| `AgentReputation` | `e87566ce909cfa039d0ece68d1f99db12ea2cb1c2e063499d58b44b89ae09076` | [tx](https://testnet.cspr.live/transaction/e87566ce909cfa039d0ece68d1f99db12ea2cb1c2e063499d58b44b89ae09076) |

Bootstrap receipts:

| Action | Tx |
| --- | --- |
| Register agent on `InvoiceRegistry` | [88c249c0d8b637b1f8c952bf4d1620322d6cfd191e3decbaa1e9b3aca0c54906](https://testnet.cspr.live/transaction/88c249c0d8b637b1f8c952bf4d1620322d6cfd191e3decbaa1e9b3aca0c54906) |
| Register agent on `AgentReputation` | [ea854a68785a1cdcc8d159fd09aae1115844710c843c84f98e3503fbd4d816bb](https://testnet.cspr.live/transaction/ea854a68785a1cdcc8d159fd09aae1115844710c843c84f98e3503fbd4d816bb) |
| Register relayer on `InvoiceRegistry` | [5b54c37e65516c7c2453d9ccc1ca05245a0f7fbe0921a3cfc9a040dfc82d2891](https://testnet.cspr.live/transaction/5b54c37e65516c7c2453d9ccc1ca05245a0f7fbe0921a3cfc9a040dfc82d2891) |
| Register relayer on `RepaymentEscrow` | [d0f3811c26f1419028bb96b0596ace91ff2f61e78df4e401e46fde0720595ec1](https://testnet.cspr.live/transaction/d0f3811c26f1419028bb96b0596ace91ff2f61e78df4e401e46fde0720595ec1) |

Notes:

- Odra 2.8.2 requires `nightly-2026-01-01`.
- `wasm32-unknown-unknown` must be installed for Casper backend builds.
- `contracts/.cargo/config.toml` disables wasm bulk memory for Casper VM compatibility.
- `cargo odra test -b casper` also expects `wasm-opt` from Binaryen unless using `-s` with an already generated wasm file.
