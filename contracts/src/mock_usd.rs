use odra::{casper_types::U256, prelude::*};

pub const TOKEN_UNITS_PER_USD_CENT: u64 = 10_000;

pub fn usd_cents_to_token_units(amount_usd_cents: U256) -> U256 {
    amount_usd_cents * U256::from(TOKEN_UNITS_PER_USD_CENT)
}

#[odra::odra_error]
pub enum MockUsdRevert {
    UnauthorizedAdmin = 5000,
    InvalidAmount = 5001,
    InsufficientBalance = 5002,
    InsufficientAllowance = 5003,
}

#[odra::event]
pub struct MockUsdTransfer {
    pub from: Option<Address>,
    pub to: Address,
    pub amount: U256,
}

#[odra::event]
pub struct MockUsdApproval {
    pub owner: Address,
    pub spender: Address,
    pub amount: U256,
}

#[odra::module(events = [MockUsdTransfer, MockUsdApproval], errors = MockUsdRevert)]
pub struct MockUsd {
    admin: Var<Address>,
    total_supply: Var<U256>,
    balances: Mapping<Address, U256>,
    allowances: Mapping<(Address, Address), U256>,
}

#[odra::module]
impl MockUsd {
    pub fn init(&mut self) {
        self.admin.set(self.env().caller());
        self.total_supply.set(U256::from(0u8));
    }

    pub fn name(&self) -> String {
        String::from("Mock USD Coin")
    }

    pub fn symbol(&self) -> String {
        String::from("mUSDC")
    }

    pub fn decimals(&self) -> u8 {
        6
    }

    pub fn total_supply(&self) -> U256 {
        self.total_supply.get_or_default()
    }

    pub fn balance_of(&self, owner: Address) -> U256 {
        self.balances.get_or_default(&owner)
    }

    pub fn allowance(&self, owner: Address, spender: Address) -> U256 {
        self.allowances.get_or_default(&(owner, spender))
    }

    pub fn mint(&mut self, to: Address, amount: U256) {
        self.require_admin();
        self.require_positive(amount);
        self.balances.add(&to, amount);
        self.total_supply.add(amount);
        self.env().emit_event(MockUsdTransfer {
            from: None,
            to,
            amount,
        });
    }

    pub fn transfer(&mut self, to: Address, amount: U256) {
        let owner = self.env().caller();
        self.transfer_balance(owner, to, amount);
    }

    pub fn approve(&mut self, spender: Address, amount: U256) {
        let owner = self.env().caller();
        self.allowances
            .set(&(owner.clone(), spender.clone()), amount);
        self.env().emit_event(MockUsdApproval {
            owner,
            spender,
            amount,
        });
    }

    pub fn transfer_from(&mut self, owner: Address, to: Address, amount: U256) {
        self.require_positive(amount);
        let spender = self.env().caller();
        let allowance_key = (owner.clone(), spender);
        let approved = self.allowances.get_or_default(&allowance_key);
        if approved < amount {
            self.revert(MockUsdRevert::InsufficientAllowance);
        }
        self.allowances.set(&allowance_key, approved - amount);
        self.transfer_balance(owner, to, amount);
    }

    fn transfer_balance(&mut self, owner: Address, to: Address, amount: U256) {
        self.require_positive(amount);
        let owner_balance = self.balances.get_or_default(&owner);
        if owner_balance < amount {
            self.revert(MockUsdRevert::InsufficientBalance);
        }

        if owner != to {
            self.balances.set(&owner, owner_balance - amount);
            self.balances.add(&to, amount);
        }

        self.env().emit_event(MockUsdTransfer {
            from: Some(owner),
            to,
            amount,
        });
    }

    fn require_admin(&self) {
        if self.env().caller()
            != self
                .admin
                .get_or_revert_with(MockUsdRevert::UnauthorizedAdmin)
        {
            self.revert(MockUsdRevert::UnauthorizedAdmin);
        }
    }

    fn require_positive(&self, amount: U256) {
        if amount == U256::from(0u8) {
            self.revert(MockUsdRevert::InvalidAmount);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use odra::host::{Deployer, NoArgs};

    #[test]
    fn supports_mint_transfer_approval_and_transfer_from() {
        let env = odra_test::env();
        let admin = env.get_account(0);
        let alice = env.get_account(1);
        let bob = env.get_account(2);
        let spender = env.get_account(3);
        let mut token = MockUsd::deploy(&env, NoArgs);

        env.set_caller(admin);
        token.mint(alice.clone(), U256::from(1_000_000u64));

        env.set_caller(alice.clone());
        token.transfer(bob.clone(), U256::from(250_000u64));
        token.approve(spender.clone(), U256::from(100_000u64));

        env.set_caller(spender.clone());
        token.transfer_from(alice.clone(), bob.clone(), U256::from(75_000u64));

        assert_eq!(token.name(), "Mock USD Coin");
        assert_eq!(token.symbol(), "mUSDC");
        assert_eq!(token.decimals(), 6);
        assert_eq!(token.total_supply(), U256::from(1_000_000u64));
        assert_eq!(token.balance_of(alice.clone()), U256::from(675_000u64));
        assert_eq!(token.balance_of(bob), U256::from(325_000u64));
        assert_eq!(token.allowance(alice, spender), U256::from(25_000u64));
    }

    #[test]
    fn rejects_unauthorized_mint_and_overspending() {
        let env = odra_test::env();
        let admin = env.get_account(0);
        let alice = env.get_account(1);
        let bob = env.get_account(2);
        let mut token = MockUsd::deploy(&env, NoArgs);

        env.set_caller(alice.clone());
        assert!(token
            .try_mint(alice.clone(), U256::from(1_000_000u64))
            .is_err());

        env.set_caller(admin);
        token.mint(alice.clone(), U256::from(100u64));

        env.set_caller(alice);
        assert!(token.try_transfer(bob, U256::from(101u64)).is_err());
    }
}
