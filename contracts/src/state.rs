use std::collections::{HashMap, HashSet};

use crate::types::{
    Account, AgentProfile, ContractError, CreateInvoiceInput, Hash32, InvestorPosition, Invoice,
    InvoiceStatus, RepaymentRecord, RiskScoreInput, RiskTier,
};

const BPS_DENOMINATOR: u16 = 10_000;
const INITIAL_REPUTATION: u32 = 500;
const MAX_REPUTATION: u32 = 1_000;

#[derive(Debug)]
pub struct CortexContracts {
    admin: Account,
    now: u64,
    minimum_due_window: u64,
    grace_period: u64,
    invoices: HashMap<Hash32, Invoice>,
    invoice_hash_used: HashSet<Hash32>,
    investor_positions: HashMap<Hash32, InvestorPosition>,
    vault_liquidity_usd_cents: u128,
    escrow_liquidity_usd_cents: u128,
    gateway_payment_used: HashSet<Hash32>,
    repayments: HashMap<Hash32, RepaymentRecord>,
    registered_agents: HashSet<Account>,
    settlement_relayers: HashSet<Account>,
    agent_profiles: HashMap<Account, AgentProfile>,
    invoice_agent: HashMap<Hash32, Account>,
}

impl CortexContracts {
    pub fn new(admin: Account, now: u64) -> Self {
        Self {
            admin,
            now,
            minimum_due_window: 1,
            grace_period: 86_400,
            invoices: HashMap::new(),
            invoice_hash_used: HashSet::new(),
            investor_positions: HashMap::new(),
            vault_liquidity_usd_cents: 0,
            escrow_liquidity_usd_cents: 0,
            gateway_payment_used: HashSet::new(),
            repayments: HashMap::new(),
            registered_agents: HashSet::new(),
            settlement_relayers: HashSet::new(),
            agent_profiles: HashMap::new(),
            invoice_agent: HashMap::new(),
        }
    }

    pub fn set_now(&mut self, now: u64) {
        self.now = now;
    }

    pub fn register_agent(
        &mut self,
        caller: &Account,
        agent: Account,
    ) -> Result<(), ContractError> {
        self.require_admin(caller)?;
        self.registered_agents.insert(agent.clone());
        self.agent_profiles
            .entry(agent.clone())
            .or_insert(AgentProfile {
                agent,
                reputation_score: INITIAL_REPUTATION,
                invoices_scored: 0,
                successful_repayments: 0,
                defaults: 0,
                low_risk_defaults: 0,
                last_updated: self.now,
            });
        Ok(())
    }

    pub fn register_settlement_relayer(
        &mut self,
        caller: &Account,
        relayer: Account,
    ) -> Result<(), ContractError> {
        self.require_admin(caller)?;
        self.settlement_relayers.insert(relayer);
        Ok(())
    }

    pub fn deposit_vault_liquidity(
        &mut self,
        caller: &Account,
        amount_usd_cents: u128,
    ) -> Result<(), ContractError> {
        self.require_admin(caller)?;
        if amount_usd_cents == 0 {
            return Err(ContractError::InvalidAmount);
        }
        self.vault_liquidity_usd_cents += amount_usd_cents;
        Ok(())
    }

    pub fn vault_liquidity_usd_cents(&self) -> u128 {
        self.vault_liquidity_usd_cents
    }

    pub fn escrow_liquidity_usd_cents(&self) -> u128 {
        self.escrow_liquidity_usd_cents
    }

    pub fn create_invoice(
        &mut self,
        seller: Account,
        input: CreateInvoiceInput,
    ) -> Result<(), ContractError> {
        if self.invoices.contains_key(&input.invoice_id) {
            return Err(ContractError::DuplicateInvoiceHash);
        }

        if self.invoice_hash_used.contains(&input.invoice_hash) {
            return Err(ContractError::DuplicateInvoiceHash);
        }

        if input.invoice_amount_usd_cents == 0 {
            return Err(ContractError::InvalidAmount);
        }

        if input.due_timestamp <= self.now + self.minimum_due_window {
            return Err(ContractError::InvalidDueDate);
        }

        self.invoice_hash_used.insert(input.invoice_hash);
        self.invoices.insert(
            input.invoice_id,
            Invoice {
                invoice_id: input.invoice_id,
                seller,
                buyer_hash: input.buyer_hash,
                invoice_hash: input.invoice_hash,
                evidence_hash: input.evidence_hash,
                attestation_hash: None,
                original_currency_hash: input.original_currency_hash,
                invoice_amount_usd_cents: input.invoice_amount_usd_cents,
                advance_amount_usd_cents: 0,
                repayment_amount_usd_cents: 0,
                discount_bps: 0,
                advance_rate_bps: 0,
                risk_score: 0,
                risk_tier: RiskTier::Rejected,
                due_timestamp: input.due_timestamp,
                investor: None,
                status: InvoiceStatus::Created,
                created_at: self.now,
                funded_at: None,
                seller_advance_claimed: false,
                seller_advance_claimed_at: None,
                repaid_at: None,
                settled_at: None,
            },
        );

        Ok(())
    }

    pub fn post_risk_score(
        &mut self,
        caller: &Account,
        input: RiskScoreInput,
    ) -> Result<(), ContractError> {
        if !self.registered_agents.contains(caller) {
            return Err(ContractError::UnauthorizedAgent);
        }

        let invoice = self.invoice_mut(&input.invoice_id)?;

        if invoice.status != InvoiceStatus::Created {
            return Err(ContractError::InvalidStatus);
        }

        if input.risk_score > 100 {
            return Err(ContractError::InvalidRiskScore);
        }

        if input.discount_bps > 3_000
            || input.advance_rate_bps + input.discount_bps != BPS_DENOMINATOR
        {
            return Err(ContractError::InvalidBpsMath);
        }

        if input.repayment_amount_usd_cents != invoice.invoice_amount_usd_cents {
            return Err(ContractError::InvalidBpsMath);
        }

        let expected_advance = invoice.invoice_amount_usd_cents
            * u128::from(input.advance_rate_bps)
            / u128::from(BPS_DENOMINATOR);

        if input.advance_amount_usd_cents != expected_advance {
            return Err(ContractError::InvalidBpsMath);
        }

        invoice.risk_score = input.risk_score;
        invoice.risk_tier = input.risk_tier;
        invoice.discount_bps = input.discount_bps;
        invoice.advance_rate_bps = input.advance_rate_bps;
        invoice.advance_amount_usd_cents = input.advance_amount_usd_cents;
        invoice.repayment_amount_usd_cents = input.repayment_amount_usd_cents;
        invoice.attestation_hash = Some(input.attestation_hash);
        invoice.status = if input.risk_tier == RiskTier::Rejected {
            InvoiceStatus::Rejected
        } else {
            InvoiceStatus::Scored
        };

        self.invoice_agent.insert(input.invoice_id, caller.clone());
        let profile = self
            .agent_profiles
            .get_mut(caller)
            .ok_or(ContractError::UnauthorizedAgent)?;
        profile.invoices_scored += 1;
        profile.last_updated = self.now;

        Ok(())
    }

    pub fn list_invoice(
        &mut self,
        caller: &Account,
        invoice_id: &Hash32,
    ) -> Result<(), ContractError> {
        let now = self.now;
        let invoice = self.invoice_mut(invoice_id)?;

        if &invoice.seller != caller {
            return Err(ContractError::InvalidStatus);
        }

        if invoice.status != InvoiceStatus::Scored || invoice.risk_tier == RiskTier::Rejected {
            return Err(ContractError::InvalidStatus);
        }

        if invoice.due_timestamp <= now {
            return Err(ContractError::InvoiceExpired);
        }

        invoice.status = InvoiceStatus::Listed;
        Ok(())
    }

    pub fn fund_invoice(
        &mut self,
        investor: Account,
        invoice_id: &Hash32,
        funded_amount_usd_cents: u128,
    ) -> Result<(), ContractError> {
        let now = self.now;
        let expected_repayment_usd_cents = {
            let invoice = self.invoice_mut(invoice_id)?;

            if invoice.status != InvoiceStatus::Listed {
                return Err(ContractError::InvalidStatus);
            }

            if investor == invoice.seller {
                return Err(ContractError::SellerCannotFundOwnInvoice);
            }

            if invoice.investor.is_some() {
                return Err(ContractError::InvoiceAlreadyFunded);
            }

            if invoice.due_timestamp <= now {
                return Err(ContractError::InvoiceExpired);
            }

            if funded_amount_usd_cents != invoice.advance_amount_usd_cents {
                return Err(ContractError::InvalidAmount);
            }

            invoice.investor = Some(investor.clone());
            invoice.status = InvoiceStatus::Funded;
            invoice.funded_at = Some(now);
            invoice.repayment_amount_usd_cents
        };

        self.vault_liquidity_usd_cents += funded_amount_usd_cents;

        self.investor_positions.insert(
            *invoice_id,
            InvestorPosition {
                investor,
                invoice_id: *invoice_id,
                funded_amount_usd_cents,
                expected_repayment_usd_cents,
                claimed: false,
            },
        );

        Ok(())
    }

    pub fn cash_out_advance(
        &mut self,
        seller: &Account,
        invoice_id: &Hash32,
    ) -> Result<(), ContractError> {
        let now = self.now;
        let advance_amount_usd_cents = {
            let invoice = self.invoice_mut(invoice_id)?;

            if &invoice.seller != seller {
                return Err(ContractError::InvalidStatus);
            }

            if invoice.status != InvoiceStatus::Funded {
                return Err(ContractError::AdvanceNotAvailable);
            }

            if invoice.seller_advance_claimed {
                return Err(ContractError::AdvanceAlreadyCashedOut);
            }

            invoice.advance_amount_usd_cents
        };

        if self.vault_liquidity_usd_cents < advance_amount_usd_cents {
            return Err(ContractError::VaultInsufficientLiquidity);
        }

        self.vault_liquidity_usd_cents -= advance_amount_usd_cents;
        let invoice = self.invoice_mut(invoice_id)?;
        invoice.seller_advance_claimed = true;
        invoice.seller_advance_claimed_at = Some(now);
        invoice.status = InvoiceStatus::RepaymentPending;

        Ok(())
    }

    pub fn record_gateway_repayment(
        &mut self,
        caller: &Account,
        invoice_id: &Hash32,
        gateway_payment_hash: Hash32,
        webhook_event_hash: Hash32,
        paid_amount_usd_cents: u128,
    ) -> Result<(), ContractError> {
        if !self.settlement_relayers.contains(caller) {
            return Err(ContractError::UnauthorizedRelayer);
        }

        if self.gateway_payment_used.contains(&gateway_payment_hash) {
            return Err(ContractError::PaymentAlreadyUsed);
        }

        let now = self.now;
        let required_amount_usd_cents = {
            let invoice = self.invoice_mut(invoice_id)?;

            if invoice.status != InvoiceStatus::RepaymentPending {
                return Err(ContractError::InvalidStatus);
            }

            if paid_amount_usd_cents < invoice.repayment_amount_usd_cents {
                return Err(ContractError::Underpayment);
            }

            invoice.status = InvoiceStatus::Repaid;
            invoice.repaid_at = Some(now);
            invoice.repayment_amount_usd_cents
        };

        self.gateway_payment_used.insert(gateway_payment_hash);
        self.escrow_liquidity_usd_cents += paid_amount_usd_cents;
        self.repayments.insert(
            *invoice_id,
            RepaymentRecord {
                invoice_id: *invoice_id,
                gateway_payment_hash,
                webhook_event_hash,
                paid_amount_usd_cents,
                required_amount_usd_cents,
                recorded_by: caller.clone(),
                recorded_at: now,
                claimed: false,
            },
        );
        self.update_agent_reputation(invoice_id, true)?;

        Ok(())
    }

    pub fn claim_repayment(
        &mut self,
        caller: &Account,
        invoice_id: &Hash32,
    ) -> Result<(), ContractError> {
        let invoice = self.invoice(invoice_id)?;

        if invoice.status != InvoiceStatus::Repaid {
            return Err(ContractError::ClaimNotAllowed);
        }

        if invoice.investor.as_ref() != Some(caller) {
            return Err(ContractError::NotInvestor);
        }

        let repayment = self
            .repayments
            .get_mut(invoice_id)
            .ok_or(ContractError::ClaimNotAllowed)?;

        if repayment.claimed {
            return Err(ContractError::AlreadyClaimed);
        }

        let position = self
            .investor_positions
            .get(invoice_id)
            .ok_or(ContractError::ClaimNotAllowed)?;
        if self.escrow_liquidity_usd_cents < position.expected_repayment_usd_cents {
            return Err(ContractError::EscrowInsufficientLiquidity);
        }

        repayment.claimed = true;
        let position = self
            .investor_positions
            .get_mut(invoice_id)
            .ok_or(ContractError::ClaimNotAllowed)?;
        self.escrow_liquidity_usd_cents -= position.expected_repayment_usd_cents;
        position.claimed = true;
        let now = self.now;
        let invoice = self.invoice_mut(invoice_id)?;
        invoice.status = InvoiceStatus::Settled;
        invoice.settled_at = Some(now);

        Ok(())
    }

    pub fn mark_default_after_due(&mut self, invoice_id: &Hash32) -> Result<(), ContractError> {
        let now = self.now;
        let grace_period = self.grace_period;
        let invoice = self.invoice_mut(invoice_id)?;

        if invoice.status != InvoiceStatus::RepaymentPending {
            return Err(ContractError::DefaultNotAllowed);
        }

        if now <= invoice.due_timestamp + grace_period {
            return Err(ContractError::DefaultNotAllowed);
        }

        invoice.status = InvoiceStatus::Defaulted;
        self.update_agent_reputation(invoice_id, false)?;

        Ok(())
    }

    pub fn invoice(&self, invoice_id: &Hash32) -> Result<&Invoice, ContractError> {
        self.invoices
            .get(invoice_id)
            .ok_or(ContractError::UnknownInvoice)
    }

    pub fn investor_position(&self, invoice_id: &Hash32) -> Option<&InvestorPosition> {
        self.investor_positions.get(invoice_id)
    }

    pub fn agent_profile(&self, agent: &Account) -> Option<&AgentProfile> {
        self.agent_profiles.get(agent)
    }

    fn require_admin(&self, caller: &Account) -> Result<(), ContractError> {
        if caller == &self.admin {
            Ok(())
        } else {
            Err(ContractError::UnauthorizedAdmin)
        }
    }

    fn invoice_mut(&mut self, invoice_id: &Hash32) -> Result<&mut Invoice, ContractError> {
        self.invoices
            .get_mut(invoice_id)
            .ok_or(ContractError::UnknownInvoice)
    }

    fn update_agent_reputation(
        &mut self,
        invoice_id: &Hash32,
        success: bool,
    ) -> Result<(), ContractError> {
        let agent = self
            .invoice_agent
            .get(invoice_id)
            .ok_or(ContractError::UnauthorizedAgent)?
            .clone();
        let risk_tier = self.invoice(invoice_id)?.risk_tier;
        let profile = self
            .agent_profiles
            .get_mut(&agent)
            .ok_or(ContractError::UnauthorizedAgent)?;

        if success {
            profile.successful_repayments += 1;
            profile.reputation_score = (profile.reputation_score + 20).min(MAX_REPUTATION);
        } else {
            profile.defaults += 1;
            let slash = if risk_tier == RiskTier::Low {
                profile.low_risk_defaults += 1;
                60
            } else {
                15
            };
            profile.reputation_score = profile.reputation_score.saturating_sub(slash);
        }

        profile.last_updated = self.now;
        Ok(())
    }
}
