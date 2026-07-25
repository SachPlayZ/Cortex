# Cortex Contracts

Current implementation contains:

- `InvoiceRegistry` as canonical invoice metadata and lifecycle registry.
- `FundingVault` as investor-funded advance pool and seller cashout module.
- `RepaymentEscrow` as Dodo webhook settlement and investor claim module.
- `AgentReputation` as underwriting reputation ledger.
- `MockUsd` as an admin-mintable, 6-decimal mock USDC token for Testnet demos.
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
InvoiceRegistry atomically locks approved mUSDC and arms RepaymentEscrow
Seller optionally cashes out advance
Invoice becomes RepaymentPending
Dodo signed webhook confirms buyer payment
RepaymentEscrow reserves pre-funded mUSDC after the verified payment
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

Build produces five wasm artifacts:

```txt
contracts/wasm/InvoiceRegistry.wasm
contracts/wasm/FundingVault.wasm
contracts/wasm/RepaymentEscrow.wasm
contracts/wasm/AgentReputation.wasm
contracts/wasm/MockUsd.wasm
```

## Latest Testnet Deployment

Network:

```txt
chain_name=casper-test
rpc=http://185.170.112.40:7777/rpc
events=http://185.170.112.40:9999/events
registry_admin=02027164c96d7810a067865fc1dccade50e8d4aa405a40f70ed258dbf6685af663f5
```

Package hashes:

| Contract | Package hash | Explorer |
| --- | --- | --- |
| `InvoiceRegistry` | `hash-e927cc878c81a521fc5e2bfc8dd163bf40071996703d656e1562fbe448f222b1` | [package](https://testnet.cspr.live/contract-package/e927cc878c81a521fc5e2bfc8dd163bf40071996703d656e1562fbe448f222b1) |
| `FundingVault` | `hash-9fabd34fa621fa2e8c8d701e7c144b3dc410437ff302122f0144221b46a73ca3` | [package](https://testnet.cspr.live/contract-package/9fabd34fa621fa2e8c8d701e7c144b3dc410437ff302122f0144221b46a73ca3) |
| `RepaymentEscrow` | `hash-115792ac89d97550d997761fac98106f27910657a55ea2ff26d0b9d70f4ced7f` | [package](https://testnet.cspr.live/contract-package/115792ac89d97550d997761fac98106f27910657a55ea2ff26d0b9d70f4ced7f) |
| `AgentReputation` | `hash-b68085517c629331fbd0291b4ef8b7a92366e9c037eab7895a8766b2c5c7086b` | [package](https://testnet.cspr.live/contract-package/b68085517c629331fbd0291b4ef8b7a92366e9c037eab7895a8766b2c5c7086b) |
| `MockUsd` | `hash-fe26bc8468bbed43d8b92e9d44d27fc93759a0ba4c65c60143cd8e0865a760bb` | [package](https://testnet.cspr.live/contract-package/fe26bc8468bbed43d8b92e9d44d27fc93759a0ba4c65c60143cd8e0865a760bb) |

Deploy receipts:

| Contract | Deploy tx | Explorer |
| --- | --- | --- |
| `InvoiceRegistry` | `e3633835e5578d34c3e1cfaa58e84d9210cff876941510175fd25b924f471919` | [tx](https://testnet.cspr.live/transaction/e3633835e5578d34c3e1cfaa58e84d9210cff876941510175fd25b924f471919) |
| `FundingVault` | `499eca7e4409ec649a4ba7e5e7f7a20633e3161ff1f092024b0efbf8304fc082` | [tx](https://testnet.cspr.live/transaction/499eca7e4409ec649a4ba7e5e7f7a20633e3161ff1f092024b0efbf8304fc082) |
| `RepaymentEscrow` | `d254f403fd369779a25473b56364d4304ae6c3d1b7a5d6dcfc6046c30d0e0cd6` | [tx](https://testnet.cspr.live/transaction/d254f403fd369779a25473b56364d4304ae6c3d1b7a5d6dcfc6046c30d0e0cd6) |
| `AgentReputation` | `d945e738ccaf5ab258e190c5b4e4a5dbb33d289d7f6340740e6d512af0eb9c98` | [tx](https://testnet.cspr.live/transaction/d945e738ccaf5ab258e190c5b4e4a5dbb33d289d7f6340740e6d512af0eb9c98) |
| `MockUsd` | `adf868d88765de9ccc4959e911954b9c99beb0a3f8b3e089383bf7f90f4eca5d` | [tx](https://testnet.cspr.live/transaction/adf868d88765de9ccc4959e911954b9c99beb0a3f8b3e089383bf7f90f4eca5d) |

Bootstrap receipts:

| Action | Tx |
| --- | --- |
| Link `FundingVault` to Registry | [f428e25b09dda86d0b4e4f07861ae4185a016ba9b1f630859f277062ab02771c](https://testnet.cspr.live/transaction/f428e25b09dda86d0b4e4f07861ae4185a016ba9b1f630859f277062ab02771c) |
| Link `RepaymentEscrow` to Registry | [4cbb3afe583c29637869d9de683cac16eb5fbe04374e78fc09a6bebdaebeec93](https://testnet.cspr.live/transaction/4cbb3afe583c29637869d9de683cac16eb5fbe04374e78fc09a6bebdaebeec93) |
| Link `AgentReputation` to Registry | [5a0bf70cc8f93de5709bc2488ec7ca8944ac967bad7c5607dfd3ac2635a4b436](https://testnet.cspr.live/transaction/5a0bf70cc8f93de5709bc2488ec7ca8944ac967bad7c5607dfd3ac2635a4b436) |
| Register agent | [4f3a16313e51efc6fe57866a6cd95815cf71bbd0c96c6301c2bb2d955eee6b70](https://testnet.cspr.live/transaction/4f3a16313e51efc6fe57866a6cd95815cf71bbd0c96c6301c2bb2d955eee6b70) |
| Register relayer | [0e1ee23b7ac6e59a171f65658ec6e63be562b327ffb68e41d030bdd4a8c5d7df](https://testnet.cspr.live/transaction/0e1ee23b7ac6e59a171f65658ec6e63be562b327ffb68e41d030bdd4a8c5d7df) |
| Mint 1,000,000 mUSDC | [85fdf0c2176f8a7b70e8be0fd6bfb18703d41a45b723fd71225314867e0587e8](https://testnet.cspr.live/transaction/85fdf0c2176f8a7b70e8be0fd6bfb18703d41a45b723fd71225314867e0587e8) |
| Fund 500,000 mUSDC repayment reserve | [5475615716f5426ec377b8c2c3eb5d4789c8856314e25edcb588786fadc7b9d7](https://testnet.cspr.live/transaction/5475615716f5426ec377b8c2c3eb5d4789c8856314e25edcb588786fadc7b9d7) |
| Fund demo investor with 100,000 mUSDC | [f374a6fb97a41ab5a3a93614e630d5beeb2ee53510c7b019f77f3ddec8a8bef8](https://testnet.cspr.live/transaction/f374a6fb97a41ab5a3a93614e630d5beeb2ee53510c7b019f77f3ddec8a8bef8) |

Notes:

- Odra 2.8.2 requires `nightly-2026-01-01`.
- `wasm32-unknown-unknown` must be installed for Casper backend builds.
- `contracts/.cargo/config.toml` disables wasm bulk memory for Casper VM compatibility.
- `cargo odra test -b casper` also expects `wasm-opt` from Binaryen unless using `-s` with an already generated wasm file.
