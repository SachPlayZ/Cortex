use crate::mock_usd::{usd_cents_to_token_units, MockUsdContractRef};
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
    pub released: bool,
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
    UnauthorizedRegistry = 3011,
    RegistryAlreadyConfigured = 3012,
}

#[odra::event]
pub struct EscrowLiquidityDeposited {
    pub funder: Address,
    pub amount_usd_cents: U256,
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
    registry: Var<Address>,
    mock_usd: External<MockUsdContractRef>,
    available_liquidity_usd_cents: Var<U256>,
    reserved_liquidity_usd_cents: Var<U256>,
    gateway_payment_used: Mapping<Hash32, bool>,
    positions: Mapping<Hash32, EscrowPosition>,
}

#[odra::module]
impl RepaymentEscrow {
    pub fn init(&mut self, mock_usd: Address) {
        self.admin.set(self.env().caller());
        self.mock_usd.set(mock_usd);
        self.available_liquidity_usd_cents.set(U256::from(0u8));
        self.reserved_liquidity_usd_cents.set(U256::from(0u8));
    }

    pub fn set_registry(&mut self, registry: Address) {
        self.require_admin();
        if self.registry.get().is_some() {
            self.revert(RepaymentEscrowRevert::RegistryAlreadyConfigured);
        }
        self.registry.set(registry);
    }

    pub fn deposit_liquidity(&mut self, amount_usd_cents: U256) {
        self.require_admin();
        self.require_positive(amount_usd_cents);
        let funder = self.env().caller();
        let escrow = self.env().self_address();
        self.mock_usd.transfer_from(
            funder.clone(),
            escrow,
            usd_cents_to_token_units(amount_usd_cents),
        );
        self.available_liquidity_usd_cents
            .add(amount_usd_cents);
        self.env().emit_event(EscrowLiquidityDeposited {
            funder,
            amount_usd_cents,
        });
    }

    pub fn arm_position(
        &mut self,
        invoice_id: Hash32,
        investor: Address,
        expected_repayment_usd_cents: U256,
    ) {
        self.require_registry();
        self.require_positive(expected_repayment_usd_cents);
        if self.positions.get(&invoice_id).is_some() {
            self.revert(RepaymentEscrowRevert::PositionAlreadyArmed);
        }
        let available = self.available_liquidity_usd_cents.get_or_default();
        if available < expected_repayment_usd_cents {
            self.revert(RepaymentEscrowRevert::InsufficientLiquidity);
        }
        self.available_liquidity_usd_cents
            .set(available - expected_repayment_usd_cents);
        self.reserved_liquidity_usd_cents
            .add(expected_repayment_usd_cents);
        self.positions.set(
            &invoice_id,
            EscrowPosition {
                invoice_id,
                investor: investor.clone(),
                expected_repayment_usd_cents,
                paid_amount_usd_cents: U256::from(0u8),
                gateway_payment_hash: None,
                claimed: false,
                released: false,
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
        self.require_registry();
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
        if position.gateway_payment_hash.is_some() || position.released {
            self.revert(RepaymentEscrowRevert::InvalidStatus);
        }
        if paid_amount_usd_cents < position.expected_repayment_usd_cents {
            self.revert(RepaymentEscrowRevert::Underpayment);
        }
        position.paid_amount_usd_cents = paid_amount_usd_cents;
        position.gateway_payment_hash = Some(gateway_payment_hash);
        self.gateway_payment_used.set(&gateway_payment_hash, true);
        self.positions.set(&invoice_id, position);
        self.env().emit_event(GatewayRepaymentRecorded {
            invoice_id,
            gateway_payment_hash,
            paid_amount_usd_cents,
        });
    }

    pub fn claim_repayment(&mut self, invoice_id: Hash32, investor: Address) {
        self.require_registry();
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
        if position.released {
            self.revert(RepaymentEscrowRevert::InvalidStatus);
        }
        if position.gateway_payment_hash.is_none() {
            self.revert(RepaymentEscrowRevert::InvalidStatus);
        }
        let reserved = self.reserved_liquidity_usd_cents.get_or_default();
        if reserved < position.expected_repayment_usd_cents {
            self.revert(RepaymentEscrowRevert::InsufficientLiquidity);
        }

        self.mock_usd.transfer(
            investor.clone(),
            usd_cents_to_token_units(position.expected_repayment_usd_cents),
        );
        self.reserved_liquidity_usd_cents
            .set(reserved - position.expected_repayment_usd_cents);
        position.claimed = true;
        let amount_usd_cents = position.expected_repayment_usd_cents;
        self.positions.set(&invoice_id, position);
        self.env().emit_event(InvestorRepaymentClaimed {
            invoice_id,
            investor,
            amount_usd_cents,
        });
    }

    pub fn release_defaulted_position(&mut self, invoice_id: Hash32) {
        self.require_registry();
        let mut position = self
            .positions
            .get(&invoice_id)
            .unwrap_or_revert_with(self, RepaymentEscrowRevert::UnknownPosition);
        if position.claimed || position.released || position.gateway_payment_hash.is_some() {
            self.revert(RepaymentEscrowRevert::InvalidStatus);
        }
        let reserved = self.reserved_liquidity_usd_cents.get_or_default();
        if reserved < position.expected_repayment_usd_cents {
            self.revert(RepaymentEscrowRevert::InsufficientLiquidity);
        }
        self.reserved_liquidity_usd_cents
            .set(reserved - position.expected_repayment_usd_cents);
        self.available_liquidity_usd_cents
            .add(position.expected_repayment_usd_cents);
        position.released = true;
        self.positions.set(&invoice_id, position);
    }

    pub fn get_position(&self, invoice_id: Hash32) -> Option<EscrowPosition> {
        self.positions.get(&invoice_id)
    }

    pub fn get_liquidity_usd_cents(&self) -> U256 {
        self.available_liquidity_usd_cents.get_or_default()
    }

    pub fn get_reserved_liquidity_usd_cents(&self) -> U256 {
        self.reserved_liquidity_usd_cents.get_or_default()
    }

    pub fn get_registry(&self) -> Option<Address> {
        self.registry.get()
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

    fn require_registry(&self) {
        if self.env().caller()
            != self
                .registry
                .get_or_revert_with(RepaymentEscrowRevert::UnauthorizedRegistry)
        {
            self.revert(RepaymentEscrowRevert::UnauthorizedRegistry);
        }
    }

    fn require_positive(&self, amount: U256) {
        if amount == U256::from(0u8) {
            self.revert(RepaymentEscrowRevert::InvalidAmount);
        }
    }
}
