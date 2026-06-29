#![cfg_attr(all(not(test), target_arch = "wasm32"), no_std)]
#![cfg_attr(all(not(test), target_arch = "wasm32"), no_main)]
extern crate alloc;

pub mod agent_reputation;
pub mod funding_vault;
pub mod invoice_registry;
pub mod repayment_escrow;
#[cfg(any(test, not(target_arch = "wasm32")))]
pub mod state;
#[cfg(any(test, not(target_arch = "wasm32")))]
pub mod types;

pub use agent_reputation::AgentReputation;
pub use funding_vault::FundingVault;
pub use invoice_registry::InvoiceRegistry;
pub use repayment_escrow::RepaymentEscrow;
#[cfg(any(test, not(target_arch = "wasm32")))]
pub use state::CortexContracts;
#[cfg(any(test, not(target_arch = "wasm32")))]
pub use types::*;
