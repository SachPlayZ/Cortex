use odra::{casper_types::U256, prelude::*};

pub type Hash32 = [u8; 32];

#[odra::odra_type]
pub struct VaultFunding {
    pub invoice_id: Hash32,
    pub seller: Address,
    pub investor: Address,
    pub advance_amount_usd_cents: U256,
    pub expected_repayment_usd_cents: U256,
    pub seller_advance_claimed: bool,
    pub created_at: u64,
    pub claimed_at: Option<u64>,
}

#[odra::odra_error]
pub enum FundingVaultRevert {
    UnauthorizedAdmin = 2000,
    InvalidAmount = 2001,
    FundingAlreadyRegistered = 2002,
    UnknownFunding = 2003,
    NotSeller = 2004,
    AdvanceAlreadyClaimed = 2005,
    InsufficientLiquidity = 2006,
}

#[odra::event]
pub struct VaultLiquidityDeposited {
    pub funder: Address,
    pub amount_usd_cents: U256,
}

#[odra::event]
pub struct InvoiceFundingRegistered {
    pub invoice_id: Hash32,
    pub seller: Address,
    pub investor: Address,
    pub advance_amount_usd_cents: U256,
}

#[odra::event]
pub struct SellerAdvanceCashedOut {
    pub invoice_id: Hash32,
    pub seller: Address,
    pub amount_usd_cents: U256,
}

#[odra::module]
pub struct FundingVault {
    admin: Var<Address>,
    liquidity_usd_cents: Var<U256>,
    fundings: Mapping<Hash32, VaultFunding>,
}

#[odra::module]
impl FundingVault {
    pub fn init(&mut self) {
        self.admin.set(self.env().caller());
        self.liquidity_usd_cents.set(U256::from(0u8));
    }

    pub fn deposit_liquidity(&mut self, amount_usd_cents: U256) {
        self.require_admin();
        if amount_usd_cents == U256::from(0u8) {
            self.revert(FundingVaultRevert::InvalidAmount);
        }
        let next = self.liquidity_usd_cents.get_or_default() + amount_usd_cents;
        self.liquidity_usd_cents.set(next);
        self.env().emit_event(VaultLiquidityDeposited {
            funder: self.env().caller(),
            amount_usd_cents,
        });
    }

    pub fn register_funding(
        &mut self,
        invoice_id: Hash32,
        seller: Address,
        investor: Address,
        advance_amount_usd_cents: U256,
        expected_repayment_usd_cents: U256,
    ) {
        self.require_admin();
        if advance_amount_usd_cents == U256::from(0u8)
            || expected_repayment_usd_cents == U256::from(0u8)
        {
            self.revert(FundingVaultRevert::InvalidAmount);
        }
        if self.fundings.get(&invoice_id).is_some() {
            self.revert(FundingVaultRevert::FundingAlreadyRegistered);
        }

        let next = self.liquidity_usd_cents.get_or_default() + advance_amount_usd_cents;
        self.liquidity_usd_cents.set(next);
        self.fundings.set(
            &invoice_id,
            VaultFunding {
                invoice_id,
                seller: seller.clone(),
                investor: investor.clone(),
                advance_amount_usd_cents,
                expected_repayment_usd_cents,
                seller_advance_claimed: false,
                created_at: self.env().get_block_time_secs(),
                claimed_at: None,
            },
        );
        self.env().emit_event(InvoiceFundingRegistered {
            invoice_id,
            seller,
            investor,
            advance_amount_usd_cents,
        });
    }

    pub fn cash_out_advance(&mut self, invoice_id: Hash32) {
        let caller = self.env().caller();
        let mut funding = self
            .fundings
            .get(&invoice_id)
            .unwrap_or_revert_with(self, FundingVaultRevert::UnknownFunding);
        if funding.seller != caller {
            self.revert(FundingVaultRevert::NotSeller);
        }
        if funding.seller_advance_claimed {
            self.revert(FundingVaultRevert::AdvanceAlreadyClaimed);
        }
        let liquidity = self.liquidity_usd_cents.get_or_default();
        if liquidity < funding.advance_amount_usd_cents {
            self.revert(FundingVaultRevert::InsufficientLiquidity);
        }

        self.liquidity_usd_cents
            .set(liquidity - funding.advance_amount_usd_cents);
        funding.seller_advance_claimed = true;
        funding.claimed_at = Some(self.env().get_block_time_secs());
        let amount_usd_cents = funding.advance_amount_usd_cents;
        self.fundings.set(&invoice_id, funding);
        self.env().emit_event(SellerAdvanceCashedOut {
            invoice_id,
            seller: caller,
            amount_usd_cents,
        });
    }

    pub fn get_liquidity_usd_cents(&self) -> U256 {
        self.liquidity_usd_cents.get_or_default()
    }

    pub fn get_funding(&self, invoice_id: Hash32) -> Option<VaultFunding> {
        self.fundings.get(&invoice_id)
    }

    fn require_admin(&self) {
        if self.env().caller()
            != self
                .admin
                .get_or_revert_with(FundingVaultRevert::UnauthorizedAdmin)
        {
            self.revert(FundingVaultRevert::UnauthorizedAdmin);
        }
    }
}
