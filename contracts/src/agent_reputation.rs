use odra::prelude::*;

const INITIAL_REPUTATION: u32 = 500;
const MAX_REPUTATION: u32 = 1_000;

#[odra::odra_type]
pub enum RiskTier {
    Low,
    MediumLow,
    Medium,
    High,
    Rejected,
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
pub enum AgentReputationRevert {
    UnauthorizedAdmin = 4000,
    UnauthorizedAgent = 4001,
}

#[odra::event]
pub struct AgentRegistered {
    pub agent: Address,
}

#[odra::event]
pub struct AgentReputationUpdated {
    pub agent: Address,
    pub reputation_score: u32,
}

#[odra::module]
pub struct AgentReputation {
    admin: Var<Address>,
    profiles: Mapping<Address, AgentProfile>,
    registered_agents: Mapping<Address, bool>,
}

#[odra::module]
impl AgentReputation {
    pub fn init(&mut self) {
        self.admin.set(self.env().caller());
    }

    pub fn register_agent(&mut self, agent: Address) {
        self.require_admin();
        self.registered_agents.set(&agent, true);
        if self.profiles.get(&agent).is_none() {
            self.profiles.set(
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
        self.env().emit_event(AgentRegistered { agent });
    }

    pub fn note_invoice_scored(&mut self, agent: Address) {
        self.require_admin();
        let mut profile = self.profile_or_revert(&agent);
        profile.invoices_scored += 1;
        profile.last_updated = self.now();
        self.profiles.set(&agent, profile);
    }

    pub fn note_successful_repayment(&mut self, agent: Address) {
        self.require_admin();
        let mut profile = self.profile_or_revert(&agent);
        profile.successful_repayments += 1;
        profile.reputation_score = (profile.reputation_score + 20).min(MAX_REPUTATION);
        profile.last_updated = self.now();
        let reputation_score = profile.reputation_score;
        self.profiles.set(&agent, profile);
        self.env().emit_event(AgentReputationUpdated {
            agent,
            reputation_score,
        });
    }

    pub fn note_default(&mut self, agent: Address, risk_tier: RiskTier) {
        self.require_admin();
        let mut profile = self.profile_or_revert(&agent);
        profile.defaults += 1;
        let slash = if risk_tier == RiskTier::Low {
            profile.low_risk_defaults += 1;
            60
        } else {
            15
        };
        profile.reputation_score = profile.reputation_score.saturating_sub(slash);
        profile.last_updated = self.now();
        let reputation_score = profile.reputation_score;
        self.profiles.set(&agent, profile);
        self.env().emit_event(AgentReputationUpdated {
            agent,
            reputation_score,
        });
    }

    pub fn get_agent_profile(&self, agent: Address) -> Option<AgentProfile> {
        self.profiles.get(&agent)
    }

    fn require_admin(&self) {
        if self.env().caller()
            != self
                .admin
                .get_or_revert_with(AgentReputationRevert::UnauthorizedAdmin)
        {
            self.revert(AgentReputationRevert::UnauthorizedAdmin);
        }
    }

    fn profile_or_revert(&self, agent: &Address) -> AgentProfile {
        self.profiles
            .get(agent)
            .unwrap_or_revert_with(self, AgentReputationRevert::UnauthorizedAgent)
    }

    fn now(&self) -> u64 {
        self.env().get_block_time_secs()
    }
}
