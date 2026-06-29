use odra::{casper_types::U256, prelude::*};

pub type Hash32 = [u8; 32];

const BPS_DENOMINATOR: u32 = 10_000;
const INITIAL_REPUTATION: u32 = 500;
const MAX_REPUTATION: u32 = 1_000;

#[odra::odra_type]
pub enum InvoiceStatus {
    Created,
    Scored,
    Listed,
    Funded,
    RepaymentPending,
    Repaid,
    Settled,
    Defaulted,
    Cancelled,
    Rejected,
    Disputed,
}

#[odra::odra_type]
pub enum RiskTier {
    Low,
    MediumLow,
    Medium,
    High,
    Rejected,
}

#[odra::odra_type]
pub struct Invoice {
    pub invoice_id: Hash32,
    pub seller: Address,
    pub buyer_hash: Hash32,
    pub invoice_hash: Hash32,
    pub evidence_hash: Hash32,
    pub attestation_hash: Option<Hash32>,
    pub original_currency_hash: Hash32,
    pub invoice_amount_usd_cents: U256,
    pub advance_amount_usd_cents: U256,
    pub repayment_amount_usd_cents: U256,
    pub discount_bps: u32,
    pub advance_rate_bps: u32,
    pub risk_score: u8,
    pub risk_tier: RiskTier,
    pub due_timestamp: u64,
    pub investor: Option<Address>,
    pub status: InvoiceStatus,
    pub created_at: u64,
    pub funded_at: Option<u64>,
    pub seller_advance_claimed: bool,
    pub seller_advance_claimed_at: Option<u64>,
    pub repaid_at: Option<u64>,
    pub settled_at: Option<u64>,
}

#[odra::odra_type]
pub struct InvestorPosition {
    pub investor: Address,
    pub invoice_id: Hash32,
    pub funded_amount_usd_cents: U256,
    pub expected_repayment_usd_cents: U256,
    pub claimed: bool,
}

#[odra::odra_type]
pub struct RepaymentRecord {
    pub invoice_id: Hash32,
    pub gateway_payment_hash: Hash32,
    pub webhook_event_hash: Hash32,
    pub paid_amount_usd_cents: U256,
    pub required_amount_usd_cents: U256,
    pub recorded_by: Address,
    pub recorded_at: u64,
    pub claimed: bool,
}

#[odra::odra_type]
pub struct AgentProfile {
    pub agent: Address,
    pub reputation_score: u32,
    pub invoices_scored: u64,
    pub successful_repayments: u64,
    pub defaults: u64,
    pub low_risk_defaults: u64,
    pub last_updated: u64,
}

#[odra::odra_error]
pub enum CortexRevert {
    DuplicateInvoiceHash = 1000,
    InvalidAmount = 1001,
    InvalidDueDate = 1002,
    UnauthorizedAgent = 1003,
    UnauthorizedRelayer = 1004,
    UnauthorizedAdmin = 1005,
    InvalidStatus = 1006,
    InvalidRiskScore = 1007,
    InvalidBpsMath = 1008,
    SellerCannotFundOwnInvoice = 1009,
    InvoiceAlreadyFunded = 1010,
    InvoiceExpired = 1011,
    VaultInsufficientLiquidity = 1012,
    AdvanceAlreadyCashedOut = 1013,
    AdvanceNotAvailable = 1014,
    PaymentAlreadyUsed = 1015,
    Underpayment = 1016,
    ClaimNotAllowed = 1017,
    AlreadyClaimed = 1018,
    NotInvestor = 1019,
    EscrowInsufficientLiquidity = 1020,
    DefaultNotAllowed = 1021,
    UnknownInvoice = 1022,
}

#[odra::event]
pub struct InvoiceCreated {
    pub invoice_id: Hash32,
    pub seller: Address,
    pub invoice_hash: Hash32,
}

#[odra::event]
pub struct InvoiceScored {
    pub invoice_id: Hash32,
    pub agent: Address,
    pub risk_score: u8,
    pub risk_tier: RiskTier,
}

#[odra::event]
pub struct InvoiceListed {
    pub invoice_id: Hash32,
}

#[odra::event]
pub struct InvoiceFunded {
    pub invoice_id: Hash32,
    pub investor: Address,
    pub funded_amount_usd_cents: U256,
}

#[odra::event]
pub struct VaultLiquidityDeposited {
    pub funder: Address,
    pub amount_usd_cents: U256,
}

#[odra::event]
pub struct SellerAdvanceCashedOut {
    pub invoice_id: Hash32,
    pub seller: Address,
    pub amount_usd_cents: U256,
}

#[odra::event]
pub struct GatewayRepaymentRecorded {
    pub invoice_id: Hash32,
    pub gateway_payment_hash: Hash32,
    pub paid_amount_usd_cents: U256,
}

#[odra::event]
pub struct InvoiceSettled {
    pub invoice_id: Hash32,
}

#[odra::event]
pub struct InvoiceDefaulted {
    pub invoice_id: Hash32,
}

#[odra::event]
pub struct InvestorClaimed {
    pub invoice_id: Hash32,
    pub investor: Address,
}

#[odra::event]
pub struct AgentReputationUpdated {
    pub agent: Address,
    pub reputation_score: u32,
}

#[odra::module]
pub struct InvoiceRegistry {
    admin: Var<Address>,
    minimum_due_window: Var<u64>,
    grace_period: Var<u64>,
    invoices: Mapping<Hash32, Invoice>,
    invoice_hash_used: Mapping<Hash32, bool>,
    registered_agents: Mapping<Address, bool>,
    settlement_relayers: Mapping<Address, bool>,
    vault_liquidity_usd_cents: Var<U256>,
    escrow_liquidity_usd_cents: Var<U256>,
    gateway_payment_used: Mapping<Hash32, bool>,
    investor_positions: Mapping<Hash32, InvestorPosition>,
    repayments: Mapping<Hash32, RepaymentRecord>,
    agent_profiles: Mapping<Address, AgentProfile>,
    invoice_agent: Mapping<Hash32, Address>,
}

#[odra::module]
impl InvoiceRegistry {
    pub fn init(&mut self) {
        self.admin.set(self.env().caller());
        self.minimum_due_window.set(1);
        self.grace_period.set(86_400);
        self.vault_liquidity_usd_cents.set(U256::from(0u8));
        self.escrow_liquidity_usd_cents.set(U256::from(0u8));
    }

    pub fn register_agent(&mut self, agent: Address) {
        self.require_admin();
        self.registered_agents.set(&agent, true);
        if self.agent_profiles.get(&agent).is_none() {
            self.agent_profiles.set(
                &agent,
                AgentProfile {
                    agent: agent.clone(),
                    reputation_score: INITIAL_REPUTATION,
                    invoices_scored: 0,
                    successful_repayments: 0,
                    defaults: 0,
                    low_risk_defaults: 0,
                    last_updated: self.now(),
                },
            );
        }
    }

    pub fn register_settlement_relayer(&mut self, relayer: Address) {
        self.require_admin();
        self.settlement_relayers.set(&relayer, true);
    }

    pub fn deposit_vault_liquidity(&mut self, amount_usd_cents: U256) {
        self.require_admin();
        if amount_usd_cents == U256::from(0u8) {
            self.revert(CortexRevert::InvalidAmount);
        }
        let next = self.vault_liquidity_usd_cents.get_or_default() + amount_usd_cents;
        self.vault_liquidity_usd_cents.set(next);
        self.env().emit_event(VaultLiquidityDeposited {
            funder: self.env().caller(),
            amount_usd_cents,
        });
    }

    pub fn create_invoice(
        &mut self,
        invoice_id: Hash32,
        invoice_hash: Hash32,
        evidence_hash: Hash32,
        buyer_hash: Hash32,
        original_currency_hash: Hash32,
        invoice_amount_usd_cents: U256,
        due_timestamp: u64,
    ) {
        if self.invoices.get(&invoice_id).is_some()
            || self.invoice_hash_used.get_or_default(&invoice_hash)
        {
            self.revert(CortexRevert::DuplicateInvoiceHash);
        }
        if invoice_amount_usd_cents == U256::from(0u8) {
            self.revert(CortexRevert::InvalidAmount);
        }
        if due_timestamp <= self.now() + self.minimum_due_window.get_or_default() {
            self.revert(CortexRevert::InvalidDueDate);
        }

        let seller = self.env().caller();
        self.invoice_hash_used.set(&invoice_hash, true);
        self.invoices.set(
            &invoice_id,
            Invoice {
                invoice_id,
                seller: seller.clone(),
                buyer_hash,
                invoice_hash,
                evidence_hash,
                attestation_hash: None,
                original_currency_hash,
                invoice_amount_usd_cents,
                advance_amount_usd_cents: U256::from(0u8),
                repayment_amount_usd_cents: U256::from(0u8),
                discount_bps: 0,
                advance_rate_bps: 0,
                risk_score: 0,
                risk_tier: RiskTier::Rejected,
                due_timestamp,
                investor: None,
                status: InvoiceStatus::Created,
                created_at: self.now(),
                funded_at: None,
                seller_advance_claimed: false,
                seller_advance_claimed_at: None,
                repaid_at: None,
                settled_at: None,
            },
        );
        self.env().emit_event(InvoiceCreated {
            invoice_id,
            seller,
            invoice_hash,
        });
    }

    pub fn post_risk_score(
        &mut self,
        invoice_id: Hash32,
        risk_score: u8,
        risk_tier: RiskTier,
        discount_bps: u32,
        advance_rate_bps: u32,
        advance_amount_usd_cents: U256,
        repayment_amount_usd_cents: U256,
        attestation_hash: Hash32,
    ) {
        let agent = self.env().caller();
        if !self.registered_agents.get_or_default(&agent) {
            self.revert(CortexRevert::UnauthorizedAgent);
        }
        if risk_score > 100 {
            self.revert(CortexRevert::InvalidRiskScore);
        }
        if discount_bps > 3_000 || advance_rate_bps + discount_bps != BPS_DENOMINATOR {
            self.revert(CortexRevert::InvalidBpsMath);
        }

        let mut invoice = self.invoice_or_revert(&invoice_id);
        if invoice.status != InvoiceStatus::Created {
            self.revert(CortexRevert::InvalidStatus);
        }
        if repayment_amount_usd_cents != invoice.invoice_amount_usd_cents {
            self.revert(CortexRevert::InvalidBpsMath);
        }
        let expected_advance = invoice.invoice_amount_usd_cents * U256::from(advance_rate_bps)
            / U256::from(BPS_DENOMINATOR);
        if advance_amount_usd_cents != expected_advance {
            self.revert(CortexRevert::InvalidBpsMath);
        }

        invoice.risk_score = risk_score;
        let is_rejected = risk_tier == RiskTier::Rejected;
        invoice.risk_tier = risk_tier.clone();
        invoice.discount_bps = discount_bps;
        invoice.advance_rate_bps = advance_rate_bps;
        invoice.advance_amount_usd_cents = advance_amount_usd_cents;
        invoice.repayment_amount_usd_cents = repayment_amount_usd_cents;
        invoice.attestation_hash = Some(attestation_hash);
        invoice.status = if is_rejected {
            InvoiceStatus::Rejected
        } else {
            InvoiceStatus::Scored
        };
        self.invoices.set(&invoice_id, invoice);
        self.invoice_agent.set(&invoice_id, agent.clone());
        self.bump_invoices_scored(&agent);
        self.env().emit_event(InvoiceScored {
            invoice_id,
            agent,
            risk_score,
            risk_tier,
        });
    }

    pub fn list_invoice(&mut self, invoice_id: Hash32) {
        let mut invoice = self.invoice_or_revert(&invoice_id);
        if invoice.seller != self.env().caller() {
            self.revert(CortexRevert::InvalidStatus);
        }
        if invoice.status != InvoiceStatus::Scored || invoice.risk_tier == RiskTier::Rejected {
            self.revert(CortexRevert::InvalidStatus);
        }
        if invoice.due_timestamp <= self.now() {
            self.revert(CortexRevert::InvoiceExpired);
        }

        invoice.status = InvoiceStatus::Listed;
        self.invoices.set(&invoice_id, invoice);
        self.env().emit_event(InvoiceListed { invoice_id });
    }

    pub fn fund_invoice(&mut self, invoice_id: Hash32, funded_amount_usd_cents: U256) {
        let investor = self.env().caller();
        let mut invoice = self.invoice_or_revert(&invoice_id);
        if invoice.status != InvoiceStatus::Listed {
            self.revert(CortexRevert::InvalidStatus);
        }
        if investor == invoice.seller {
            self.revert(CortexRevert::SellerCannotFundOwnInvoice);
        }
        if invoice.investor.is_some() {
            self.revert(CortexRevert::InvoiceAlreadyFunded);
        }
        if invoice.due_timestamp <= self.now() {
            self.revert(CortexRevert::InvoiceExpired);
        }
        if funded_amount_usd_cents != invoice.advance_amount_usd_cents {
            self.revert(CortexRevert::InvalidAmount);
        }

        invoice.investor = Some(investor.clone());
        invoice.status = InvoiceStatus::Funded;
        invoice.funded_at = Some(self.now());
        let next_liquidity =
            self.vault_liquidity_usd_cents.get_or_default() + funded_amount_usd_cents;
        self.vault_liquidity_usd_cents.set(next_liquidity);
        self.investor_positions.set(
            &invoice_id,
            InvestorPosition {
                investor: investor.clone(),
                invoice_id,
                funded_amount_usd_cents,
                expected_repayment_usd_cents: invoice.repayment_amount_usd_cents,
                claimed: false,
            },
        );
        self.invoices.set(&invoice_id, invoice);
        self.env().emit_event(InvoiceFunded {
            invoice_id,
            investor,
            funded_amount_usd_cents,
        });
    }

    pub fn cash_out_advance(&mut self, invoice_id: Hash32) {
        let seller = self.env().caller();
        let mut invoice = self.invoice_or_revert(&invoice_id);
        if invoice.seller != seller {
            self.revert(CortexRevert::InvalidStatus);
        }
        if invoice.status != InvoiceStatus::Funded {
            self.revert(CortexRevert::AdvanceNotAvailable);
        }
        if invoice.seller_advance_claimed {
            self.revert(CortexRevert::AdvanceAlreadyCashedOut);
        }
        let available = self.vault_liquidity_usd_cents.get_or_default();
        if available < invoice.advance_amount_usd_cents {
            self.revert(CortexRevert::VaultInsufficientLiquidity);
        }

        self.vault_liquidity_usd_cents
            .set(available - invoice.advance_amount_usd_cents);
        invoice.seller_advance_claimed = true;
        invoice.seller_advance_claimed_at = Some(self.now());
        invoice.status = InvoiceStatus::RepaymentPending;
        let amount_usd_cents = invoice.advance_amount_usd_cents;
        self.invoices.set(&invoice_id, invoice);
        self.env().emit_event(SellerAdvanceCashedOut {
            invoice_id,
            seller,
            amount_usd_cents,
        });
    }

    pub fn record_gateway_repayment(
        &mut self,
        invoice_id: Hash32,
        gateway_payment_hash: Hash32,
        webhook_event_hash: Hash32,
        paid_amount_usd_cents: U256,
    ) {
        let relayer = self.env().caller();
        if !self.settlement_relayers.get_or_default(&relayer) {
            self.revert(CortexRevert::UnauthorizedRelayer);
        }
        if self
            .gateway_payment_used
            .get_or_default(&gateway_payment_hash)
        {
            self.revert(CortexRevert::PaymentAlreadyUsed);
        }
        let mut invoice = self.invoice_or_revert(&invoice_id);
        if invoice.status != InvoiceStatus::RepaymentPending {
            self.revert(CortexRevert::InvalidStatus);
        }
        if paid_amount_usd_cents < invoice.repayment_amount_usd_cents {
            self.revert(CortexRevert::Underpayment);
        }

        invoice.status = InvoiceStatus::Repaid;
        invoice.repaid_at = Some(self.now());
        self.escrow_liquidity_usd_cents.set(
            self.escrow_liquidity_usd_cents.get_or_default() + paid_amount_usd_cents,
        );
        self.gateway_payment_used.set(&gateway_payment_hash, true);
        self.repayments.set(
            &invoice_id,
            RepaymentRecord {
                invoice_id,
                gateway_payment_hash,
                webhook_event_hash,
                paid_amount_usd_cents,
                required_amount_usd_cents: invoice.repayment_amount_usd_cents,
                recorded_by: relayer.clone(),
                recorded_at: self.now(),
                claimed: false,
            },
        );
        self.invoices.set(&invoice_id, invoice);
        self.update_agent_reputation(&invoice_id, true);
        self.env().emit_event(GatewayRepaymentRecorded {
            invoice_id,
            gateway_payment_hash,
            paid_amount_usd_cents,
        });
    }

    pub fn claim_repayment(&mut self, invoice_id: Hash32) {
        let claimant = self.env().caller();
        let mut invoice = self.invoice_or_revert(&invoice_id);
        if invoice.status != InvoiceStatus::Repaid {
            self.revert(CortexRevert::ClaimNotAllowed);
        }
        if invoice.investor != Some(claimant.clone()) {
            self.revert(CortexRevert::NotInvestor);
        }
        let mut repayment = self
            .repayments
            .get(&invoice_id)
            .unwrap_or_revert_with(self, CortexRevert::ClaimNotAllowed);
        if repayment.claimed {
            self.revert(CortexRevert::AlreadyClaimed);
        }
        let mut position = self
            .investor_positions
            .get(&invoice_id)
            .unwrap_or_revert_with(self, CortexRevert::ClaimNotAllowed);
        if self.escrow_liquidity_usd_cents.get_or_default()
            < position.expected_repayment_usd_cents
        {
            self.revert(CortexRevert::EscrowInsufficientLiquidity);
        }
        self.escrow_liquidity_usd_cents.set(
            self.escrow_liquidity_usd_cents.get_or_default()
                - position.expected_repayment_usd_cents,
        );
        repayment.claimed = true;
        position.claimed = true;
        invoice.status = InvoiceStatus::Settled;
        invoice.settled_at = Some(self.now());
        self.repayments.set(&invoice_id, repayment);
        self.investor_positions.set(&invoice_id, position);
        self.invoices.set(&invoice_id, invoice);
        self.env().emit_event(InvestorClaimed {
            invoice_id,
            investor: claimant,
        });
        self.env().emit_event(InvoiceSettled { invoice_id });
    }

    pub fn mark_default_after_due(&mut self, invoice_id: Hash32) {
        let mut invoice = self.invoice_or_revert(&invoice_id);
        if invoice.status != InvoiceStatus::RepaymentPending {
            self.revert(CortexRevert::DefaultNotAllowed);
        }
        if self.now() <= invoice.due_timestamp + self.grace_period.get_or_default() {
            self.revert(CortexRevert::DefaultNotAllowed);
        }
        invoice.status = InvoiceStatus::Defaulted;
        self.invoices.set(&invoice_id, invoice);
        self.update_agent_reputation(&invoice_id, false);
        self.env().emit_event(InvoiceDefaulted { invoice_id });
    }

    pub fn get_invoice(&self, invoice_id: Hash32) -> Option<Invoice> {
        self.invoices.get(&invoice_id)
    }

    pub fn get_investor_position(&self, invoice_id: Hash32) -> Option<InvestorPosition> {
        self.investor_positions.get(&invoice_id)
    }

    pub fn get_agent_profile(&self, agent: Address) -> Option<AgentProfile> {
        self.agent_profiles.get(&agent)
    }

    pub fn get_vault_liquidity_usd_cents(&self) -> U256 {
        self.vault_liquidity_usd_cents.get_or_default()
    }

    pub fn get_escrow_liquidity_usd_cents(&self) -> U256 {
        self.escrow_liquidity_usd_cents.get_or_default()
    }

    fn require_admin(&self) {
        if self.env().caller()
            != self
                .admin
                .get_or_revert_with(CortexRevert::UnauthorizedAdmin)
        {
            self.revert(CortexRevert::UnauthorizedAdmin);
        }
    }

    fn invoice_or_revert(&self, invoice_id: &Hash32) -> Invoice {
        self.invoices
            .get(invoice_id)
            .unwrap_or_revert_with(self, CortexRevert::UnknownInvoice)
    }

    fn bump_invoices_scored(&mut self, agent: &Address) {
        let mut profile = self
            .agent_profiles
            .get(agent)
            .unwrap_or_revert_with(self, CortexRevert::UnauthorizedAgent);
        profile.invoices_scored += 1;
        profile.last_updated = self.now();
        self.agent_profiles.set(agent, profile);
    }

    fn update_agent_reputation(&mut self, invoice_id: &Hash32, success: bool) {
        let agent = self
            .invoice_agent
            .get(invoice_id)
            .unwrap_or_revert_with(self, CortexRevert::UnauthorizedAgent);
        let invoice = self.invoice_or_revert(invoice_id);
        let mut profile = self
            .agent_profiles
            .get(&agent)
            .unwrap_or_revert_with(self, CortexRevert::UnauthorizedAgent);
        if success {
            profile.successful_repayments += 1;
            profile.reputation_score = (profile.reputation_score + 20).min(MAX_REPUTATION);
        } else {
            profile.defaults += 1;
            let slash = if invoice.risk_tier == RiskTier::Low {
                profile.low_risk_defaults += 1;
                60
            } else {
                15
            };
            profile.reputation_score = profile.reputation_score.saturating_sub(slash);
        }
        profile.last_updated = self.now();
        let reputation_score = profile.reputation_score;
        self.agent_profiles.set(&agent, profile);
        self.env().emit_event(AgentReputationUpdated {
            agent,
            reputation_score,
        });
    }

    fn now(&self) -> u64 {
        self.env().get_block_time_secs()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use odra::host::{Deployer, NoArgs};

    fn h(value: u8) -> Hash32 {
        [value; 32]
    }

    fn deploy() -> (odra::host::HostEnv, InvoiceRegistryHostRef) {
        let env = odra_test::env();
        let contract = InvoiceRegistry::deploy(&env, NoArgs);
        (env, contract)
    }

    fn score(contract: &mut InvoiceRegistryHostRef, invoice_id: Hash32) {
        contract.post_risk_score(
            invoice_id,
            92,
            RiskTier::Low,
            300,
            9_700,
            U256::from(97_000u64),
            U256::from(100_000u64),
            h(6),
        );
    }

    #[test]
    fn odra_lifecycle_happy_path() {
        let (env, mut contract) = deploy();
        let admin = env.get_account(0);
        let seller = env.get_account(1);
        let agent = env.get_account(2);
        let investor = env.get_account(3);
        let relayer = env.get_account(4);

        env.set_caller(admin.clone());
        contract.register_agent(agent.clone());
        contract.register_settlement_relayer(relayer.clone());

        env.set_caller(seller.clone());
        contract.create_invoice(
            h(1),
            h(2),
            h(3),
            h(4),
            h(5),
            U256::from(100_000u64),
            100_000,
        );

        env.set_caller(agent.clone());
        score(&mut contract, h(1));

        env.set_caller(seller.clone());
        contract.list_invoice(h(1));

        env.set_caller(investor.clone());
        contract.fund_invoice(h(1), U256::from(97_000u64));
        env.set_caller(seller.clone());
        contract.cash_out_advance(h(1));

        env.set_caller(relayer.clone());
        contract.record_gateway_repayment(h(1), h(10), h(11), U256::from(100_000u64));

        env.set_caller(investor.clone());
        contract.claim_repayment(h(1));

        assert_eq!(
            contract.get_invoice(h(1)).unwrap().status,
            InvoiceStatus::Settled
        );
        assert_eq!(
            contract.get_agent_profile(agent).unwrap().reputation_score,
            520
        );
    }

    #[test]
    fn odra_rejects_duplicate_payment_hash() {
        let (env, mut contract) = deploy();
        let admin = env.get_account(0);
        let seller = env.get_account(1);
        let agent = env.get_account(2);
        let investor = env.get_account(3);
        let relayer = env.get_account(4);

        env.set_caller(admin.clone());
        contract.register_agent(agent.clone());
        contract.register_settlement_relayer(relayer.clone());

        env.set_caller(seller.clone());
        contract.create_invoice(
            h(1),
            h(2),
            h(3),
            h(4),
            h(5),
            U256::from(100_000u64),
            100_000,
        );
        env.set_caller(agent.clone());
        score(&mut contract, h(1));
        env.set_caller(seller.clone());
        contract.list_invoice(h(1));
        env.set_caller(investor.clone());
        contract.fund_invoice(h(1), U256::from(97_000u64));
        env.set_caller(seller.clone());
        contract.cash_out_advance(h(1));
        env.set_caller(relayer.clone());
        contract.record_gateway_repayment(h(1), h(10), h(11), U256::from(100_000u64));

        env.set_caller(seller.clone());
        contract.create_invoice(
            h(21),
            h(22),
            h(3),
            h(4),
            h(5),
            U256::from(100_000u64),
            100_000,
        );
        env.set_caller(agent.clone());
        score(&mut contract, h(21));
        env.set_caller(seller.clone());
        contract.list_invoice(h(21));
        env.set_caller(investor.clone());
        contract.fund_invoice(h(21), U256::from(97_000u64));
        env.set_caller(seller.clone());
        contract.cash_out_advance(h(21));
        env.set_caller(relayer.clone());
        assert!(contract
            .try_record_gateway_repayment(h(21), h(10), h(12), U256::from(100_000u64))
            .is_err());
    }
}
