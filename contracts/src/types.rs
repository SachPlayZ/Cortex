use core::fmt;

pub type Account = String;
pub type Hash32 = [u8; 32];

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
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

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RiskTier {
    Low,
    MediumLow,
    Medium,
    High,
    Rejected,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Invoice {
    pub invoice_id: Hash32,
    pub seller: Account,
    pub buyer_hash: Hash32,
    pub invoice_hash: Hash32,
    pub evidence_hash: Hash32,
    pub attestation_hash: Option<Hash32>,
    pub original_currency_hash: Hash32,
    pub invoice_amount_usd_cents: u128,
    pub advance_amount_usd_cents: u128,
    pub repayment_amount_usd_cents: u128,
    pub discount_bps: u16,
    pub advance_rate_bps: u16,
    pub risk_score: u8,
    pub risk_tier: RiskTier,
    pub due_timestamp: u64,
    pub investor: Option<Account>,
    pub status: InvoiceStatus,
    pub created_at: u64,
    pub funded_at: Option<u64>,
    pub seller_advance_claimed: bool,
    pub seller_advance_claimed_at: Option<u64>,
    pub repaid_at: Option<u64>,
    pub settled_at: Option<u64>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CreateInvoiceInput {
    pub invoice_id: Hash32,
    pub invoice_hash: Hash32,
    pub evidence_hash: Hash32,
    pub buyer_hash: Hash32,
    pub original_currency_hash: Hash32,
    pub invoice_amount_usd_cents: u128,
    pub due_timestamp: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RiskScoreInput {
    pub invoice_id: Hash32,
    pub risk_score: u8,
    pub risk_tier: RiskTier,
    pub discount_bps: u16,
    pub advance_rate_bps: u16,
    pub advance_amount_usd_cents: u128,
    pub repayment_amount_usd_cents: u128,
    pub attestation_hash: Hash32,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InvestorPosition {
    pub investor: Account,
    pub invoice_id: Hash32,
    pub funded_amount_usd_cents: u128,
    pub expected_repayment_usd_cents: u128,
    pub claimed: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RepaymentRecord {
    pub invoice_id: Hash32,
    pub gateway_payment_hash: Hash32,
    pub webhook_event_hash: Hash32,
    pub paid_amount_usd_cents: u128,
    pub required_amount_usd_cents: u128,
    pub recorded_by: Account,
    pub recorded_at: u64,
    pub claimed: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AgentProfile {
    pub agent: Account,
    pub reputation_score: u32,
    pub invoices_scored: u64,
    pub successful_repayments: u64,
    pub defaults: u64,
    pub low_risk_defaults: u64,
    pub last_updated: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ContractError {
    DuplicateInvoiceHash,
    InvalidAmount,
    InvalidDueDate,
    UnauthorizedAgent,
    UnauthorizedRelayer,
    UnauthorizedAdmin,
    InvalidStatus,
    InvalidRiskScore,
    InvalidBpsMath,
    SellerCannotFundOwnInvoice,
    InvoiceAlreadyFunded,
    InvoiceExpired,
    VaultInsufficientLiquidity,
    AdvanceAlreadyCashedOut,
    AdvanceNotAvailable,
    PaymentAlreadyUsed,
    Underpayment,
    ClaimNotAllowed,
    AlreadyClaimed,
    NotInvestor,
    EscrowInsufficientLiquidity,
    DefaultNotAllowed,
    UnknownInvoice,
}

impl fmt::Display for ContractError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{self:?}")
    }
}
