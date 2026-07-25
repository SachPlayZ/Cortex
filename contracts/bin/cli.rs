use cortex_contracts::{
    agent_reputation::AgentReputation,
    funding_vault::{FundingVault, FundingVaultInitArgs},
    invoice_registry::{InvoiceRegistry, InvoiceRegistryInitArgs},
    mock_usd::MockUsd,
    repayment_escrow::{RepaymentEscrow, RepaymentEscrowInitArgs},
};
use odra::host::{HostEnv, NoArgs};
use odra::prelude::Addressable;
use odra_cli::{deploy::DeployScript, DeployedContractsContainer, DeployerExt, OdraCli};

pub struct CortexDeployScript;

impl DeployScript for CortexDeployScript {
    fn deploy(
        &self,
        env: &HostEnv,
        container: &mut DeployedContractsContainer,
    ) -> Result<(), odra_cli::deploy::Error> {
        let mock_usd = MockUsd::load_or_deploy(env, NoArgs, container, 350_000_000_000)?;
        let mut vault = FundingVault::load_or_deploy(
            env,
            FundingVaultInitArgs {
                mock_usd: mock_usd.address(),
            },
            container,
            450_000_000_000,
        )?;
        let mut escrow = RepaymentEscrow::load_or_deploy(
            env,
            RepaymentEscrowInitArgs {
                mock_usd: mock_usd.address(),
            },
            container,
            450_000_000_000,
        )?;
        let mut reputation =
            AgentReputation::load_or_deploy(env, NoArgs, container, 350_000_000_000)?;
        let registry = InvoiceRegistry::load_or_deploy(
            env,
            InvoiceRegistryInitArgs {
                funding_vault: vault.address(),
                repayment_escrow: escrow.address(),
                agent_reputation: reputation.address(),
            },
            container,
            500_000_000_000,
        )?;
        if vault.get_registry().is_none() {
            env.set_gas(5_000_000_000);
            vault.set_registry(registry.address());
        }
        if escrow.get_registry().is_none() {
            env.set_gas(5_000_000_000);
            escrow.set_registry(registry.address());
        }
        if reputation.get_registry().is_none() {
            env.set_gas(5_000_000_000);
            reputation.set_registry(registry.address());
        }
        Ok(())
    }
}

pub fn main() {
    OdraCli::new()
        .about("Cortex contract CLI")
        .deploy(CortexDeployScript)
        .contract::<InvoiceRegistry>()
        .contract::<FundingVault>()
        .contract::<RepaymentEscrow>()
        .contract::<AgentReputation>()
        .contract::<MockUsd>()
        .build()
        .run();
}
