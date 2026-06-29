use cortex_contracts::{
    agent_reputation::AgentReputation, funding_vault::FundingVault,
    invoice_registry::InvoiceRegistry, repayment_escrow::RepaymentEscrow,
};
use odra::host::{HostEnv, NoArgs};
use odra_cli::{deploy::DeployScript, DeployedContractsContainer, DeployerExt, OdraCli};

pub struct CortexDeployScript;

impl DeployScript for CortexDeployScript {
    fn deploy(
        &self,
        env: &HostEnv,
        container: &mut DeployedContractsContainer,
    ) -> Result<(), odra_cli::deploy::Error> {
        let _registry = InvoiceRegistry::load_or_deploy(env, NoArgs, container, 650_000_000_000)?;
        let _vault = FundingVault::load_or_deploy(env, NoArgs, container, 450_000_000_000)?;
        let _escrow = RepaymentEscrow::load_or_deploy(env, NoArgs, container, 450_000_000_000)?;
        let _reputation =
            AgentReputation::load_or_deploy(env, NoArgs, container, 350_000_000_000)?;
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
        .build()
        .run();
}
