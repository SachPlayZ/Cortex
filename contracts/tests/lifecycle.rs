use cortex_contracts::{
    Account, ContractError, CreateInvoiceInput, CortexContracts, Hash32, InvoiceStatus,
    RiskScoreInput, RiskTier,
};

fn h(value: u8) -> Hash32 {
    [value; 32]
}

fn account(value: &str) -> Account {
    value.to_string()
}

fn setup() -> CortexContracts {
    let admin = account("admin");
    let agent = account("agent");
    let relayer = account("relayer");
    let mut contracts = CortexContracts::new(admin.clone(), 1_000);
    contracts.register_agent(&admin, agent).unwrap();
    contracts
        .register_settlement_relayer(&admin, relayer)
        .unwrap();
    contracts
}

fn create_input(invoice_id: Hash32, invoice_hash: Hash32) -> CreateInvoiceInput {
    CreateInvoiceInput {
        invoice_id,
        invoice_hash,
        evidence_hash: h(3),
        buyer_hash: h(4),
        original_currency_hash: h(5),
        invoice_amount_usd_cents: 100_000,
        due_timestamp: 100_000,
    }
}

fn score_input(invoice_id: Hash32, tier: RiskTier) -> RiskScoreInput {
    RiskScoreInput {
        invoice_id,
        risk_score: if tier == RiskTier::Rejected { 40 } else { 92 },
        risk_tier: tier,
        discount_bps: 300,
        advance_rate_bps: 9_700,
        advance_amount_usd_cents: 97_000,
        repayment_amount_usd_cents: 100_000,
        attestation_hash: h(6),
    }
}

fn listed_invoice() -> CortexContracts {
    let mut contracts = setup();
    contracts
        .create_invoice(account("seller"), create_input(h(1), h(2)))
        .unwrap();
    contracts
        .post_risk_score(&account("agent"), score_input(h(1), RiskTier::Low))
        .unwrap();
    contracts.list_invoice(&account("seller"), &h(1)).unwrap();
    contracts
}

fn funded_invoice() -> CortexContracts {
    let mut contracts = listed_invoice();
    contracts
        .fund_invoice(account("investor"), &h(1), 97_000)
        .unwrap();
    contracts
        .cash_out_advance(&account("seller"), &h(1))
        .unwrap();
    contracts
}

#[test]
fn create_valid_invoice() {
    let mut contracts = setup();
    contracts
        .create_invoice(account("seller"), create_input(h(1), h(2)))
        .unwrap();

    assert_eq!(
        contracts.invoice(&h(1)).unwrap().status,
        InvoiceStatus::Created
    );
}

#[test]
fn reject_duplicate_invoice_hash_zero_amount_and_past_due() {
    let mut contracts = setup();
    contracts
        .create_invoice(account("seller"), create_input(h(1), h(2)))
        .unwrap();

    assert_eq!(
        contracts
            .create_invoice(account("seller"), create_input(h(9), h(2)))
            .unwrap_err(),
        ContractError::DuplicateInvoiceHash
    );

    let mut zero = create_input(h(3), h(4));
    zero.invoice_amount_usd_cents = 0;
    assert_eq!(
        contracts
            .create_invoice(account("seller"), zero)
            .unwrap_err(),
        ContractError::InvalidAmount
    );

    let mut past = create_input(h(5), h(6));
    past.due_timestamp = 1_000;
    assert_eq!(
        contracts
            .create_invoice(account("seller"), past)
            .unwrap_err(),
        ContractError::InvalidDueDate
    );
}

#[test]
fn only_registered_agent_scores_and_invalid_bps_reverts() {
    let mut contracts = setup();
    contracts
        .create_invoice(account("seller"), create_input(h(1), h(2)))
        .unwrap();

    assert_eq!(
        contracts
            .post_risk_score(&account("stranger"), score_input(h(1), RiskTier::Low))
            .unwrap_err(),
        ContractError::UnauthorizedAgent
    );

    let mut invalid = score_input(h(1), RiskTier::Low);
    invalid.discount_bps = 301;
    assert_eq!(
        contracts
            .post_risk_score(&account("agent"), invalid)
            .unwrap_err(),
        ContractError::InvalidBpsMath
    );
}

#[test]
fn rejected_invoice_cannot_be_listed() {
    let mut contracts = setup();
    contracts
        .create_invoice(account("seller"), create_input(h(1), h(2)))
        .unwrap();
    contracts
        .post_risk_score(&account("agent"), score_input(h(1), RiskTier::Rejected))
        .unwrap();

    assert_eq!(
        contracts.invoice(&h(1)).unwrap().status,
        InvoiceStatus::Rejected
    );
    assert_eq!(
        contracts
            .list_invoice(&account("seller"), &h(1))
            .unwrap_err(),
        ContractError::InvalidStatus
    );
}

#[test]
fn only_seller_lists_scored_invoice() {
    let mut contracts = setup();
    contracts
        .create_invoice(account("seller"), create_input(h(1), h(2)))
        .unwrap();
    contracts
        .post_risk_score(&account("agent"), score_input(h(1), RiskTier::Low))
        .unwrap();

    assert_eq!(
        contracts
            .list_invoice(&account("not-seller"), &h(1))
            .unwrap_err(),
        ContractError::NotSeller
    );

    contracts.list_invoice(&account("seller"), &h(1)).unwrap();
    assert_eq!(
        contracts.invoice(&h(1)).unwrap().status,
        InvoiceStatus::Listed
    );
}

#[test]
fn investor_funds_listed_invoice() {
    let mut contracts = listed_invoice();
    contracts
        .deposit_vault_liquidity(&account("admin"), 500_000)
        .unwrap();
    contracts
        .fund_invoice(account("investor"), &h(1), 97_000)
        .unwrap();

    assert_eq!(
        contracts.invoice(&h(1)).unwrap().status,
        InvoiceStatus::RepaymentPending
    );
    assert_eq!(
        contracts
            .investor_position(&h(1))
            .unwrap()
            .expected_repayment_usd_cents,
        100_000
    );
    assert_eq!(contracts.vault_liquidity_usd_cents(), 597_000);

    contracts
        .cash_out_advance(&account("seller"), &h(1))
        .unwrap();
    assert_eq!(
        contracts.invoice(&h(1)).unwrap().status,
        InvoiceStatus::RepaymentPending
    );
    assert!(contracts.invoice(&h(1)).unwrap().seller_advance_claimed);
    assert_eq!(contracts.vault_liquidity_usd_cents(), 500_000);
}

#[test]
fn funding_rejects_self_wrong_amount_unlisted_and_double_funding() {
    let mut contracts = setup();
    contracts
        .create_invoice(account("seller"), create_input(h(1), h(2)))
        .unwrap();
    assert_eq!(
        contracts
            .fund_invoice(account("investor"), &h(1), 97_000)
            .unwrap_err(),
        ContractError::InvalidStatus
    );

    let mut contracts = listed_invoice();
    assert_eq!(
        contracts
            .fund_invoice(account("seller"), &h(1), 97_000)
            .unwrap_err(),
        ContractError::SellerCannotFundOwnInvoice
    );
    assert_eq!(
        contracts
            .fund_invoice(account("investor"), &h(1), 96_999)
            .unwrap_err(),
        ContractError::InvalidAmount
    );

    contracts
        .fund_invoice(account("investor"), &h(1), 97_000)
        .unwrap();
    assert_eq!(
        contracts
            .fund_invoice(account("investor2"), &h(1), 97_000)
            .unwrap_err(),
        ContractError::InvoiceAlreadyFunded
    );
}

#[test]
fn seller_cashout_requires_repayment_pending_and_vault_liquidity() {
    let mut contracts = listed_invoice();
    assert_eq!(
        contracts
            .cash_out_advance(&account("seller"), &h(1))
            .unwrap_err(),
        ContractError::AdvanceNotAvailable
    );

    contracts
        .fund_invoice(account("investor"), &h(1), 97_000)
        .unwrap();
    assert_eq!(
        contracts
            .cash_out_advance(&account("not-seller"), &h(1))
            .unwrap_err(),
        ContractError::NotSeller
    );

    contracts
        .cash_out_advance(&account("seller"), &h(1))
        .unwrap();
    assert_eq!(
        contracts
            .cash_out_advance(&account("seller"), &h(1))
            .unwrap_err(),
        ContractError::AdvanceAlreadyCashedOut
    );
}

#[test]
fn only_relayer_records_repayment_and_underpayment_reverts() {
    let mut contracts = funded_invoice();

    assert_eq!(
        contracts
            .record_gateway_repayment(&account("stranger"), &h(1), h(10), h(11), 100_000)
            .unwrap_err(),
        ContractError::UnauthorizedRelayer
    );
    assert_eq!(
        contracts
            .record_gateway_repayment(&account("relayer"), &h(1), h(10), h(11), 99_999)
            .unwrap_err(),
        ContractError::Underpayment
    );
}

#[test]
fn valid_gateway_repayment_marks_repaid_and_updates_agent() {
    let mut contracts = funded_invoice();
    contracts
        .record_gateway_repayment(&account("relayer"), &h(1), h(10), h(11), 100_000)
        .unwrap();

    assert_eq!(
        contracts.invoice(&h(1)).unwrap().status,
        InvoiceStatus::Repaid
    );
    assert_eq!(contracts.escrow_liquidity_usd_cents(), 100_000);
    assert_eq!(
        contracts
            .agent_profile(&account("agent"))
            .unwrap()
            .reputation_score,
        520
    );
}

#[test]
fn duplicate_gateway_payment_hash_rejected_globally() {
    let mut contracts = funded_invoice();
    contracts
        .record_gateway_repayment(&account("relayer"), &h(1), h(10), h(11), 100_000)
        .unwrap();

    contracts
        .create_invoice(account("seller2"), create_input(h(21), h(22)))
        .unwrap();
    contracts
        .post_risk_score(&account("agent"), score_input(h(21), RiskTier::Low))
        .unwrap();
    contracts.list_invoice(&account("seller2"), &h(21)).unwrap();
    contracts
        .fund_invoice(account("investor2"), &h(21), 97_000)
        .unwrap();
    contracts
        .cash_out_advance(&account("seller2"), &h(21))
        .unwrap();

    assert_eq!(
        contracts
            .record_gateway_repayment(&account("relayer"), &h(21), h(10), h(12), 100_000)
            .unwrap_err(),
        ContractError::PaymentAlreadyUsed
    );
}

#[test]
fn investor_claims_after_repayment_only_once() {
    let mut contracts = funded_invoice();
    assert_eq!(
        contracts
            .claim_repayment(&account("investor"), &h(1))
            .unwrap_err(),
        ContractError::ClaimNotAllowed
    );

    contracts
        .record_gateway_repayment(&account("relayer"), &h(1), h(10), h(11), 100_000)
        .unwrap();
    assert_eq!(
        contracts
            .claim_repayment(&account("stranger"), &h(1))
            .unwrap_err(),
        ContractError::NotInvestor
    );

    contracts
        .claim_repayment(&account("investor"), &h(1))
        .unwrap();
    assert_eq!(
        contracts.invoice(&h(1)).unwrap().status,
        InvoiceStatus::Settled
    );
    assert_eq!(contracts.escrow_liquidity_usd_cents(), 0);
    assert_eq!(
        contracts
            .claim_repayment(&account("investor"), &h(1))
            .unwrap_err(),
        ContractError::ClaimNotAllowed
    );
}

#[test]
fn default_only_after_due_and_reputation_slashes() {
    let mut contracts = funded_invoice();
    assert_eq!(
        contracts
            .mark_default_after_due(&account("relayer"), &h(1))
            .unwrap_err(),
        ContractError::DefaultNotAllowed
    );

    contracts.set_now(200_000);
    assert_eq!(
        contracts
            .mark_default_after_due(&account("stranger"), &h(1))
            .unwrap_err(),
        ContractError::UnauthorizedRelayer
    );
    contracts
        .mark_default_after_due(&account("relayer"), &h(1))
        .unwrap();

    assert_eq!(
        contracts.invoice(&h(1)).unwrap().status,
        InvoiceStatus::Defaulted
    );
    assert_eq!(
        contracts
            .agent_profile(&account("agent"))
            .unwrap()
            .reputation_score,
        440
    );
    assert_eq!(
        contracts
            .agent_profile(&account("agent"))
            .unwrap()
            .low_risk_defaults,
        1
    );
}
