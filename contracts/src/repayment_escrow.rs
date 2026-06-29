use odra::{casper_types::U256, prelude::*};

pub type Hash32 = [u8; 32];

#[odra::odra_type]
pub struct EscrowPosition {
    pub invoice_id: Hash32,
    pub investor: Address,
    pub expected_repayment_usd_cents: U256,
    pub paid_amount_usd_cents: U256,
    pub gateway_payment_hash: Option<Hash32>,
    pub claimed: bool,
}

#[odra::odra_error]
pub enum RepaymentEscrowRevert {
    UnauthorizedAdmin = 3000,
    UnauthorizedRelayer = 3001,
    InvalidAmount = 3002,
    PositionAlreadyArmed = 3003,
    UnknownPosition = 3004,
    PaymentAlreadyUsed = 3005,
    InvalidStatus = 3006,
    Underpayment = 3007,
    NotInvestor = 3008,
    AlreadyClaimed = 3009,
    InsufficientLiquidity = 3010,
}

#[odra::event]
pub struct EscrowPositionArmed {
    pub invoice_id: Hash32,
    pub investor: Address,
    pub expected_repayment_usd_cents: U256,
}

#[odra::event]
pub struct GatewayRepaymentRecorded {
    pub invoice_id: Hash32,
    pub gateway_payment_hash: Hash32,
    pub paid_amount_usd_cents: U256,
}

#[odra::event]
pub struct InvestorRepaymentClaimed {
    pub invoice_id: Hash32,
    pub investor: Address,
    pub amount_usd_cents: U256,
}

#[odra::module]
pub struct RepaymentEscrow {
    admin: Var<Address>,
    liquidity_usd_cents: Var<U256>,
    settlement_relayers: Mapping<Address, bool>,
    gateway_payment_used: Mapping<Hash32, bool>,
    positions: Mapping<Hash32, EscrowPosition>,
}

#[odra::module]
impl RepaymentEscrow {
    pub fn init(&mut self) {
        self.admin.set(self.env().caller());
        self.liquidity_usd_cents.set(U256::from(0u8));
    }

    pub fn register_settlement_relayer(&mut self, relayer: Address) {
        self.require_admin();
        self.settlement_relayers.set(&relayer, true);
    }

    pub fn arm_position(
        &mut self,
        invoice_id: Hash32,
        investor: Address,
        expected_repayment_usd_cents: U256,
    ) {
        self.require_admin();
        if expected_repayment_usd_cents == U256::from(0u8) {
            self.revert(RepaymentEscrowRevert::InvalidAmount);
        }
        if self.positions.get(&invoice_id).is_some() {
            self.revert(RepaymentEscrowRevert::PositionAlreadyArmed);
        }
        self.positions.set(
            &invoice_id,
            EscrowPosition {
                invoice_id,
                investor: investor.clone(),
                expected_repayment_usd_cents,
                paid_amount_usd_cents: U256::from(0u8),
                gateway_payment_hash: None,
                claimed: false,
            },
        );
        self.env().emit_event(EscrowPositionArmed {
            invoice_id,
            investor,
            expected_repayment_usd_cents,
        });
    }

    pub fn record_gateway_repayment(
        &mut self,
        invoice_id: Hash32,
        gateway_payment_hash: Hash32,
        paid_amount_usd_cents: U256,
    ) {
        let relayer = self.env().caller();
        if !self.settlement_relayers.get_or_default(&relayer) {
            self.revert(RepaymentEscrowRevert::UnauthorizedRelayer);
        }
        if self
            .gateway_payment_used
            .get_or_default(&gateway_payment_hash)
        {
            self.revert(RepaymentEscrowRevert::PaymentAlreadyUsed);
        }
        let mut position = self
            .positions
            .get(&invoice_id)
            .unwrap_or_revert_with(self, RepaymentEscrowRevert::UnknownPosition);
        if position.gateway_payment_hash.is_some() {
            self.revert(RepaymentEscrowRevert::InvalidStatus);
        }
        if paid_amount_usd_cents < position.expected_repayment_usd_cents {
            self.revert(RepaymentEscrowRevert::Underpayment);
        }

        position.paid_amount_usd_cents = paid_amount_usd_cents;
        position.gateway_payment_hash = Some(gateway_payment_hash);
        self.gateway_payment_used.set(&gateway_payment_hash, true);
        self.liquidity_usd_cents
            .set(self.liquidity_usd_cents.get_or_default() + paid_amount_usd_cents);
        self.positions.set(&invoice_id, position);
        self.env().emit_event(GatewayRepaymentRecorded {
            invoice_id,
            gateway_payment_hash,
            paid_amount_usd_cents,
        });
    }

    pub fn claim_repayment(&mut self, invoice_id: Hash32) {
        let investor = self.env().caller();
        let mut position = self
            .positions
            .get(&invoice_id)
            .unwrap_or_revert_with(self, RepaymentEscrowRevert::UnknownPosition);
        if position.investor != investor {
            self.revert(RepaymentEscrowRevert::NotInvestor);
        }
        if position.claimed {
            self.revert(RepaymentEscrowRevert::AlreadyClaimed);
        }
        if position.gateway_payment_hash.is_none() {
            self.revert(RepaymentEscrowRevert::InvalidStatus);
        }
        if self.liquidity_usd_cents.get_or_default() < position.expected_repayment_usd_cents {
            self.revert(RepaymentEscrowRevert::InsufficientLiquidity);
        }
        self.liquidity_usd_cents.set(
            self.liquidity_usd_cents.get_or_default() - position.expected_repayment_usd_cents,
        );
        position.claimed = true;
        let amount_usd_cents = position.expected_repayment_usd_cents;
        self.positions.set(&invoice_id, position);
        self.env().emit_event(InvestorRepaymentClaimed {
            invoice_id,
            investor,
            amount_usd_cents,
        });
    }

    pub fn get_position(&self, invoice_id: Hash32) -> Option<EscrowPosition> {
        self.positions.get(&invoice_id)
    }

    pub fn get_liquidity_usd_cents(&self) -> U256 {
        self.liquidity_usd_cents.get_or_default()
    }

    fn require_admin(&self) {
        if self.env().caller()
            != self
                .admin
                .get_or_revert_with(RepaymentEscrowRevert::UnauthorizedAdmin)
        {
            self.revert(RepaymentEscrowRevert::UnauthorizedAdmin);
        }
    }
}
