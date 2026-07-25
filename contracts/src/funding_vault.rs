use crate::mock_usd::{usd_cents_to_token_units, MockUsdContractRef};
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
    UnauthorizedRegistry = 2007,
    RegistryAlreadyConfigured = 2008,
}

#[odra::event]
pub struct VaultLiquidityDeposited {
    pub funder: Address,
    pub amount_usd_cents: U256,
}

#[odra::event]
pub struct VaultInvoiceFunded {
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
    registry: Var<Address>,
    mock_usd: External<MockUsdContractRef>,
    liquidity_usd_cents: Var<U256>,
    fundings: Mapping<Hash32, VaultFunding>,
}

#[odra::module]
impl FundingVault {
    pub fn init(&mut self, mock_usd: Address) {
        self.admin.set(self.env().caller());
        self.mock_usd.set(mock_usd);
        self.liquidity_usd_cents.set(U256::from(0u8));
    }

    pub fn set_registry(&mut self, registry: Address) {
        self.require_admin();
        if self.registry.get().is_some() {
            self.revert(FundingVaultRevert::RegistryAlreadyConfigured);
        }
        self.registry.set(registry);
    }

    pub fn deposit_liquidity(&mut self, amount_usd_cents: U256) {
        self.require_admin();
        self.require_positive(amount_usd_cents);
        let funder = self.env().caller();
        let vault = self.env().self_address();
        self.mock_usd.transfer_from(
            funder.clone(),
            vault,
            usd_cents_to_token_units(amount_usd_cents),
        );
        self.liquidity_usd_cents.add(amount_usd_cents);
        self.env().emit_event(VaultLiquidityDeposited {
            funder,
            amount_usd_cents,
        });
    }

    pub fn fund_invoice(
        &mut self,
        invoice_id: Hash32,
        seller: Address,
        investor: Address,
        advance_amount_usd_cents: U256,
        expected_repayment_usd_cents: U256,
    ) {
        self.require_registry();
        self.require_positive(advance_amount_usd_cents);
        self.require_positive(expected_repayment_usd_cents);
        if investor == seller {
            self.revert(FundingVaultRevert::NotSeller);
        }
        if self.fundings.get(&invoice_id).is_some() {
            self.revert(FundingVaultRevert::FundingAlreadyRegistered);
        }

        let vault = self.env().self_address();
        self.mock_usd.transfer_from(
            investor.clone(),
            vault,
            usd_cents_to_token_units(advance_amount_usd_cents),
        );
        self.liquidity_usd_cents.add(advance_amount_usd_cents);
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
        self.env().emit_event(VaultInvoiceFunded {
            invoice_id,
            seller,
            investor,
            advance_amount_usd_cents,
        });
    }

    pub fn cash_out_advance(&mut self, invoice_id: Hash32, seller: Address) {
        self.require_registry();
        let mut funding = self
            .fundings
            .get(&invoice_id)
            .unwrap_or_revert_with(self, FundingVaultRevert::UnknownFunding);
        if funding.seller != seller {
            self.revert(FundingVaultRevert::NotSeller);
        }
        if funding.seller_advance_claimed {
            self.revert(FundingVaultRevert::AdvanceAlreadyClaimed);
        }
        let liquidity = self.liquidity_usd_cents.get_or_default();
        if liquidity < funding.advance_amount_usd_cents {
            self.revert(FundingVaultRevert::InsufficientLiquidity);
        }

        self.mock_usd.transfer(
            seller.clone(),
            usd_cents_to_token_units(funding.advance_amount_usd_cents),
        );
        self.liquidity_usd_cents
            .set(liquidity - funding.advance_amount_usd_cents);
        funding.seller_advance_claimed = true;
        funding.claimed_at = Some(self.env().get_block_time_secs());
        let amount_usd_cents = funding.advance_amount_usd_cents;
        self.fundings.set(&invoice_id, funding);
        self.env().emit_event(SellerAdvanceCashedOut {
            invoice_id,
            seller,
            amount_usd_cents,
        });
    }

    pub fn get_liquidity_usd_cents(&self) -> U256 {
        self.liquidity_usd_cents.get_or_default()
    }

    pub fn get_funding(&self, invoice_id: Hash32) -> Option<VaultFunding> {
        self.fundings.get(&invoice_id)
    }

    pub fn get_registry(&self) -> Option<Address> {
        self.registry.get()
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

    fn require_registry(&self) {
        if self.env().caller()
            != self
                .registry
                .get_or_revert_with(FundingVaultRevert::UnauthorizedRegistry)
        {
            self.revert(FundingVaultRevert::UnauthorizedRegistry);
        }
    }

    fn require_positive(&self, amount: U256) {
        if amount == U256::from(0u8) {
            self.revert(FundingVaultRevert::InvalidAmount);
        }
    }
}
