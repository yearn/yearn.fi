# Protocol Risk Assessment: Reserve Protocol

- **Assessment Date:** December 22, 2025
- **Token:** ETH+
- **Chain:** Ethereum Mainnet
- **Token Address:** [`0xE72B141DF173b999AE7c1aDcbF60Cc9833Ce56a8`](https://etherscan.io/address/0xE72B141DF173b999AE7c1aDcbF60Cc9833Ce56a8)
- **Final Score: 1.9/5.0**

## Overview + Links

ETH+ is a yield-bearing Ethereum Liquid Staking Token basket built on Reserve Protocol. It's an over-collateralized RToken backed by a diversified basket of LST tokens (wstETH, sfrxETH, rETH, ETHx). The protocol automatically captures staking rewards from underlying LSTs and redistributes them to ETH+ holders through an appreciating exchange rate.

**Yield Sources:**
- Ethereum staking rewards from underlying LSTs
- Automated rebalancing during basket changes

**Current Basket Composition (as of December 22, 2025):**
- 50.04% wstETH (Lido) - 18,137 ETH
- 21.04% rETH (Rocket Pool) - 7,625 ETH
- 20.91% sfrxETH (Frax) - 7,579 ETH
- 8.02% ETHx (Stader) - 2,906 ETH

**Total TVL:** ~$108M (~36,246 ETH)

**Links:**
- [Reserve Protocol Documentation](https://reserve.org/protocol/introduction/)
- [ETH+ Dashboard](https://app.reserve.org/ethereum/token/0xe72b141df173b999ae7c1adcbf60cc9833ce56a8/overview)
- [Reserve Protocol Security](https://reserve.org/protocol/security/)
- [LlamaRisk Analysis](https://www.llamarisk.com/research/rtoken-risk-ethplus)

## Audits and Due Diligence Disclosures

**Audit Status:** Comprehensive

The Reserve Protocol has undergone [multiple security audits and code contests](https://reserve.org/protocol/security/#smart-contract-security-audits):
- Trail of Bits
- Solidified
- Ackee Blockchain
- Halborn
- Code4rena contests

**Findings:** No critical unresolved issues. Historical issues were addressed in subsequent versions.

**Smart Contract Complexity:** Moderate-High
- Multi-contract system with RToken core, governance, basket handling, trading logic, and collateral plugins
- Modular architecture allows independent upgrades
- Oracle integration for price feeds (primarily Chainlink)

### Bug Bounty

**Platform:** Immunefi
**Maximum Payout:** $10,000,000
**Link:** https://immunefi.com/bug-bounty/reserve/

This is one of the highest bug bounty programs in DeFi, indicating strong commitment to security.

## Historical Track Record

**Time in Production:**
- Reserve Protocol: Live since 2023
- ETH+ specifically: Launched Q2 2023 (~2.5 years)

**Past Security Incidents:**
- No major exploits or hacks on Reserve Protocol
- No collateral defaults triggered for ETH+

**Peg Stability:**
- ETH+ maintains soft peg to ETH through basket composition
- No significant depegging events recorded
- Minor deviations during high volatility are expected and programmatically resolved

**TVL History:**
- ETH+ TVL has grown steadily since launch
- Current TVL: ~$108M (~36,246 ETH as of Dec 22, 2025)
- Stable growth pattern with no sudden drops

**Team Track Record:**
- Reserve team has been building since 2018
- Previously launched Reserve stablecoin (RSV) on mainnet
- Strong technical execution and transparent communication

## Funds Management

**Fund Delegation:** Yes - Funds are deployed into underlying LST protocols:
- Lido (wstETH)
- Frax Finance (sfrxETH)
- Rocket Pool (rETH)
- Stader (ETHx)

**Due Diligence on Underlying Protocols:**
- All LST providers are established, audited protocols
- Each has independent security track record
- Lido and Rocket Pool are considered blue-chip LST providers

**Monitoring Fund Delegation:**
- Basket composition is on-chain and transparent
- Governance proposals for basket changes go through 3-day timelock
- Alert on: basketConfig changes, collateral default events, basket refresh events

### Accessibility

**Minting:**
- Permissionless - Anyone can mint ETH+
- Atomic minting in single transaction
- Deposit any basket collateral token or proportionally deposit all
- Issuance throttle exists (can be monitored via contract)

**Redemption:**
- Permissionless - Anyone can redeem
- Immediate redemption if under throttle limits
- Redemptions return proportional basket of collateral tokens
- Throttle mechanism: Rolling hourly limits on redemption volume
- Direct 1:1 redemption with underlying collateral basket

**Fees:**
- No minting fees
- No redemption fees under normal circumstances
- Potential premium/discount if redeeming during basket rebalancing

**Rate Limits:**
- Issuance throttle (configurable by governance)
- Redemption throttle (configurable by governance)
- Currently set to reasonable limits for normal operations

**Slippage:**
- Minimal slippage on mint/redeem (1:1 with basket)
- Users may face slippage when converting collateral to/from ETH+ via DEXes
- Redemption during basket changes may have temporary inefficiencies

### Collateralization

**On-Chain Collateralization:** Yes
- Fully collateralized on-chain
- Users deposit LST tokens to mint ETH+
- All collateral held in protocol-owned basket

**Collateral Quality:** High
- All collateral assets are established Ethereum LSTs
- Each has independent audits and security track record
- Diversification reduces single-protocol risk

**Accepted Collateral:**
- wstETH (Lido Staked ETH)
- sfrxETH (Frax Staked ETH)
- rETH (Rocket Pool ETH)
- ETHx (Stader ETH)

**Over-Collateralization:**
- Target: 100% collateralization by basket value
- Additional protection: RSR staking provides overcollateralization buffer
- RSR stakers act as first-loss capital in default scenarios
- Current RSR backing: Variable (check StRSR exchange rate)

**Maintenance Ratios:**
- Protocol monitors collateral value via oracles
- Default triggered if collateral depegs significantly (>1% for extended period)
- Automatic basket rebalancing in default scenarios

**Liquidations:** On-chain
- Automated collateral auctions in case of default
- RSR seized from stakers to recapitalize if needed
- Emergency collateral (WETH) used during recapitalization

**Peg Stability Mechanisms:**
- Arbitrage opportunities keep ETH+ near basket value
- Direct redemption provides hard floor
- Basket rebalancing maintains target composition

**Risk Curation:**
- Governance manages: basket composition, collateral weights, oracle addresses, throttle parameters
- Requires 3-day timelock for changes after governance approval
- Managed by: StRSR holders (token-weighted governance)

**Off-Chain Components:** None
- Fully on-chain collateral management
- No custodians or off-chain reserve management

**Attestations/Audits for Off-Chain:** N/A

### Provability

**Reserve Verification:** Easy
- All reserves on-chain and publicly verifiable
- Contract: `RToken.basketsNeeded()` / `RToken.totalSupply()` = backing ratio
- Should equal 1.0 for full collateralization
- View functions allow real-time verification

**Yield Calculation:** Transparent
- Yield accrues automatically from underlying LSTs
- ETH+ becomes worth more of the basket over time
- Fully calculable on-chain via basket composition and LST exchange rates

**On-Chain Reporting:** Programmatic
- No admin-controlled exchange rate
- Rate determined by: basket value / total supply
- Oracles provide collateral prices (Chainlink primarily)
- Anyone can call refresh functions to update basket status

**Off-Chain Reserves:** None
- 100% on-chain reserves
- No exchange accounts or custody wallets

**Merkle Proofs:** N/A (fully on-chain)

**Attestation Frequency:** Real-time
- On-chain state updated with each transaction
- Oracle prices updated per Chainlink feed schedules
- No periodic reporting needed

**Third-Party Verification:**
- Chainlink Price Feeds for collateral valuation
- Independent blockchain verification
- LlamaRisk provides ongoing analysis

## Liquidity Risk

**Exit Liquidity:** Good

**On-Chain Liquidity:**
- Primary liquidity on Curve (ETH+/WETH pool)
- Secondary liquidity on Balancer
- Current DEX liquidity: ~$5M across pools
- Direct redemption available as alternative exit

**Slippage Analysis:**
- <$100k: Minimal slippage (<0.5%) via direct redemption
- $100k-$1M: Low slippage (0.5-2%) via redemption or DEX
- >$1M: May require redemption + selling basket components

**Redemption Mechanism:** Hybrid
- Primary: Direct 1:1 redemption with basket collateral
- Secondary: DEX trading for convenience
- Best for large holders: Direct redemption for basket, sell components

**Withdrawal Restrictions:**
- Throttle mechanism limits hourly redemption volume
- Typical throttle allows ~5-10% of supply per hour
- Large exits may require multiple hours or days
- No fixed cooldown periods

**Historical Liquidity:**
- Maintained adequate liquidity during market stress
- March 2024 volatility: Redemptions processed smoothly
- No liquidity crisis events

**Large Holder Impact:**
- Holders with >1% supply should plan redemptions in advance
- Direct redemption minimizes price impact
- DEX route only suitable for smaller amounts

## Centralization & Control Risks

### Governance

**Contract Upgradeability:** Yes - Upgradable
- RToken implementation can be upgraded
- Collateral plugins can be changed
- Basket composition can be modified

**Governance Structure:**
- Owner: Reserve Governor Anastasius (StRSR token voting)
- Timelock: 3 days (after governance approval)
- Voting: StRSR (staked RSR) holders vote on proposals
- Quorum: Required for proposal passage

**Multisig/Timelock:**
- Timelock contract: [0x5f4A10aE2fF68bE3cdA7d7FB432b10C6BFA6457B](https://etherscan.io/address/0x5f4A10aE2fF68bE3cdA7d7FB432b10C6BFA6457B)
- 3-day delay from approval to execution (259,200 seconds)
- Allows RToken holders time to exit before changes

**Privileged Roles:**
- **Owner:** Can upgrade contracts, change basket, modify parameters
- **Pauser:** Can pause issuance/redemption (emergency)
- **Short Freezer:** Can freeze system for 6 hours
- **Long Freezer:** Can freeze system for extended periods
- **Guardian:** Can veto governance proposals

**Powers Analysis:**
- Governance cannot seize user funds directly
- Can modify basket (changes what users redeem for)
- Can upgrade contracts (introduces code risk)
- Emergency roles can pause operations
- 3-day timelock provides exit window

**Risk Assessment:** Medium
- Timelock provides protection but shorter than ideal
- Decentralized StRSR governance
- Emergency roles add some centralization
- Governance changes are transparent

### Programmability

**System Programmability:** Highly Programmatic

Reserve Protocol operations are largely automated:
- Basket valuation: Calculated on-chain via oracle prices
- Collateral monitoring: Automated default detection
- Rebalancing: Automated trading during basket changes
- Redemptions: Fully programmatic, no admin intervention

**Non-Programmatic Elements:**
- Basket composition: Set by governance, not algorithmic
- Oracle address configuration: Governance-controlled
- Parameter tuning: Governance sets throttles, delays, etc.

**PPS Definition:** On-chain
- PPS = basket value / total supply
- Calculated programmatically from oracle prices
- No off-chain accounting

**Oracle Upgradeability:** Yes
- Each collateral plugin has oracle address
- Governance can change oracle addresses
- Currently using Chainlink feeds (most reliable)
- Oracle changes go through 3-day timelock

**Off-Chain Dependencies:**
- Keeper bots: Not critical, anyone can call public functions
- Governance frontend: Users can interact directly with contracts
- Oracle data providers: Chainlink (decentralized oracle network)

### External Dependencies

**Protocol Dependencies:**

1. **Chainlink Oracles (Critical)**
   - Used for collateral price feeds
   - Failure would prevent accurate basket valuation
   - Multiple independent feeds for redundancy
   - Fallback: Manual oracle update by governance

2. **Underlying LST Protocols (Critical)**
   - wstETH (Lido) - Blue chip, highly decentralized
   - rETH (Rocket Pool) - Decentralized node operators
   - sfrxETH (Frax) - Established protocol
   - ETHx (Stader) - Smaller but audited

3. **Ethereum Mainnet**
   - Full dependency on Ethereum L1
   - No cross-chain risk

**Dependency Criticality:**
- LST protocol exploit: Would trigger default, RSR covers losses
- Chainlink failure: Could freeze accurate pricing temporarily
- No single point of failure in LST basket (diversified)

**Fallback Mechanisms:**
- Collateral default handling: Automatic auctions + RSR recapitalization
- Emergency collateral (WETH) as fallback
- Governance can replace failed collateral

**Protocol Positions:** Yes
- Holds LST tokens as collateral
- Each LST represents staked ETH position
- Indirect exposure to validator risks

**Cross-Chain Dependencies:** None
- Fully Ethereum mainnet
- No bridge risks

**Infrastructure Dependencies:**
- RPC nodes: Standard Ethereum dependency
- Indexers/APIs: Used by frontends, not protocol-critical
- Reserve UI: Convenient but not required

## Operational Risk

**Team Transparency:**
- Reserve team is public and doxxed
- Core team members have known identities
- Regular public communication

**Documentation Quality:**
- Excellent technical documentation
- Clear explanation of mechanisms
- Well-maintained and up-to-date
- Developer resources available

**Communication Channels:**
- Discord: Active, responsive team
- Twitter: @reserve_currency
- Forum: discourse.reserve.org
- GitHub: Public repositories

**Development Activity:**
- Active ongoing development
- Regular protocol improvements
- Security patches deployed promptly
- Transparent development process

**Community Engagement:**
- Active Discord community (~5k+ members)
- Regular governance participation
- Multiple RTokens deployed by community
- Strong educational resources

**Legal Structure:**
- Reserve protocol developed by Reserve Labs (company)
- Foundation structure for decentralization
- Jurisdiction: International team
- Regulatory engagement for stablecoin compliance

**Incident Response:**
- Bug bounty program indicates preparedness
- Emergency pause mechanisms in place
- Clear security contact (security@reserve.org)
- Past minor issues handled professionally

## Monitoring

**Critical Monitoring Requirements:**

### 1. Governance Monitoring (MANDATORY)
- **Timelock Contract:** [0x5f4A10aE2fF68bE3cdA7d7FB432b10C6BFA6457B](https://etherscan.io/address/0x5f4A10aE2fF68bE3cdA7d7FB432b10C6BFA6457B)
- **Timelock Delay:** 3 days (259,200 seconds)
- Monitor events: `CallScheduled`, `CallExecuted`, `Cancelled`
- Monitor function calls: `schedule()`, `execute()`, `cancel()`
- **Action:** Add to [Yearn monitoring scripts](https://github.com/yearn/monitoring-scripts-py)
- **Frequency:** Hourly checks
- **Alerts:** Telegram SAM bot (@sam_alerter_bot)

### 2. Backing/Collateralization Monitoring (MANDATORY)
- **RToken Contract:** [0xE72B141DF173b999AE7c1aDcbF60Cc9833Ce56a8](https://etherscan.io/address/0xE72B141DF173b999AE7c1aDcbF60Cc9833Ce56a8)
- Monitor ratio: `basketsNeeded / totalSupply` (should be >1.0)

### 3. RSR Exchange Rate Monitoring
- **StRSR Contract:** [0xffa151Ad0A0e2e40F39f9e5E9F87cF9E45e819dd](https://etherscan.io/address/0xffa151Ad0A0e2e40F39f9e5E9F87cF9E45e819dd)
- Monitor function: `exchangeRate()`
- Falling exchange rate indicates RSR being seized (default scenario)
- Alert on any drop in exchange rate

### 4. Emergency Role Monitoring
- Monitor Timelock contract for queued calls

### 5. Basket Composition Changes
- Monitor collateral composition changes

**Monitoring Implementation:**
1. Open PR in [Yearn monitoring repository](https://github.com/yearn/monitoring-scripts-py)
2. Add addresses to Safe monitoring (if applicable)
3. Set up Tenderly alerts for timelock
4. Create Telegram group: "Reserve-ETH+-Monitoring"
5. Invite SAM bot: @sam_alerter_bot
6. Configure GitHub Actions: Hourly workflow for critical checks

## Risk Summary

### Key Findings

**Critical Risks Identified:**
1. **Governance Risk** - 3-day timelock provides protection but upgradable contracts introduce code risk; timelock on the edge of acceptable threshold
2. **Multiple Dependencies** - Relies on 5 external protocols (Chainlink + 4 LSTs) for critical functionality; 50% concentration in Lido wstETH
3. **Oracle Dependency** - Critical reliance on Chainlink for accurate pricing; oracle failures could impact system

**Key Strengths:**
1. **Strong Security** - $10M bug bounty, multiple audits, 2+ years without incidents
2. **Full On-Chain Backing** - 100% transparent, verifiable reserves with direct redemption
3. **Diversified Collateral** - Multiple LST providers reduces single-point-of-failure risk
4. **Decentralized Governance** - StRSR token voting with 3-day timelock safeguard
5. **Programmatic Operations** - Minimal trust, automated basket management

### Recommendations

**Risk Mitigation Actions:**
1. Monitor Lido wstETH exposure closely (50% concentration risk)
2. Set up automated alerts for collateralization ratio
3. Review all governance proposals during 3-day timelock period (note: shorter window requires prompt review)
4. Maintain awareness of underlying LST protocol risks (Lido, Frax, Rocket Pool, Stader)

**Ongoing Monitoring Requirements:**
- **Hourly:** Collateralization ratio, RSR exchange rate
- **Daily:** Collateral composition changes
- **Real-time:** Timelock queued calls

---

## Risk Score Assessment

### Critical Risk Gates Check

**Auto-Fail Criteria (if ANY true, score = 5):**

- [ ] No audit → **PASS** (Multiple audits, clean)
- [ ] Unverifiable reserves → **PASS** (Fully on-chain, verifiable)
- [ ] Total centralization (single EOA admin) → **PASS** (Decentralized governance with 3-day timelock)

**Result:** Protocol passes all critical gates ✓

---

### Category Scoring (1-5 scale, 1 = safest)

#### 1. Audits & Historical Track Record
**Score: 1.5**

**Audits:**
- Multiple professional audits (Trail of Bits, Solidified, etc.) ✓
- $10M bug bounty on Immunefi (>$1M threshold) ✓

**Time in Production:**
- 2.5+ years in production (>2 years) ✓
- TVL ~$108M (>$100M threshold) ✓

**Scoring per rubric:** Should be 1.0 (meets all criteria for top tier)
**Adjustment:** +0.5 for moderate contract complexity
**Final:** 1.5

#### 2. Centralization & Control Risks
**Score: 2.5**

**Governance (using 1-5 rubric):**
- Decentralized DAO (StRSR voting) ✓
- 3-day timelock (meets >3 day threshold but just barely)
- Privileged roles exist (Owner, Pauser, Freezer, Guardian) - constrained by timelock
- Rubric Score 1-2 range: Has DAO and >3 day timelock (Score 1), but privileged roles push toward Score 2
- **Subcategory Score: 2.0**

**Programmability (using 1-5 rubric):**
- Mostly programmatic with minor admin governance input ✓
- On-chain PPS calculation with parameters ✓
- Decentralized oracle (Chainlink), governance can change ✓
- Matches Score 2 criteria exactly
- **Subcategory Score: 2.0**

**External Dependencies (using 1-5 rubric):**
- Chainlink oracles (1 dependency, critical for pricing)
- 4 LST protocols: Lido, Rocket Pool, Frax, Stader (critical for collateral)
- Total: 5 dependencies on established/blue-chip protocols
- All critical for core functionality
- Rubric Score 3-4 range: Many dependencies (Score 4) but all blue-chip/established (mitigating)
- **Subcategory Score: 3.0**

**Category Average: (2.0 + 2.0 + 3.0) / 3 = 2.33 ≈ 2.5**

#### 3. Funds Management (Collateralization + Provability)
**Score: 1.5**

- 100% on-chain collateral ✓
- High-quality collateral (blue-chip LSTs) ✓
- Real-time verifiability ✓
- Direct 1:1 redemption ✓
- RSR overcollateralization buffer ✓
- Minor penalty: Delegated to other protocols (LSTs)

#### 4. Liquidity Risk
**Score: 2.0**

- Direct redemption mechanism available ✓
- Reasonable DEX liquidity (~$5M) ✓
- Throttle mechanism limits large exits (+0.5)
- Historically stable liquidity ✓
- Large holders need multi-day exit planning (+0.5)

#### 5. Operational Risk
**Score: 1.5**

**Team Transparency:**
- Public, doxxed team with established reputation ✓
- Rubric Score 1: Fully doxxed, established reputation

**Documentation:**
- Excellent, comprehensive documentation ✓
- Rubric Score 1: Excellent, comprehensive

**Legal/Compliance:**
- Established legal structure (Reserve Labs + Foundation) ✓
- Long-term protocol (2+ years) ✓
- Minor concern: Some regulatory uncertainty around stablecoins
- Rubric Score 1-2 range: Clear structure but some regulatory uncertainty

**Category Average: (1.0 + 1.0 + 2.0) / 3 = 1.33 ≈ 1.5**

---

### Weighted Final Score

**Category Weights:**
- Centralization & Control: 30%
- Funds Management: 30%
- Audits + Historical: 20%
- Liquidity: 15%
- Operational: 5%

**Calculation:**
```
Final Score = (2.5 × 0.30) + (1.5 × 0.30) + (1.5 × 0.20) + (2.0 × 0.15) + (1.5 × 0.05)
            = 0.75 + 0.45 + 0.30 + 0.30 + 0.075
            = 1.875
            ≈ 1.9
```

---

## Overall Risk Score: **1.9 / 5.0**

### Risk Tier: **LOW RISK**

**Interpretation:**
ETH+ (Reserve Protocol) represents a low-risk protocol suitable for integration with Yearn vaults. The protocol demonstrates strong technical security, transparent on-chain operations, and decentralized governance. The 3-day timelock provides adequate protection for users to exit before governance changes, though a longer delay would be preferable. Main risks are manageable and relate to external dependencies (Chainlink oracles, underlying LST protocols) and governance upgradeability.

**Risk Tier Definitions:**
- **1.0-1.5**: Minimal Risk (Blue chip protocols)
- **1.5-2.5**: Low Risk (Established protocols) ← **ETH+ is here**
- **2.5-3.5**: Medium Risk (Requires monitoring)
- **3.5-4.5**: Elevated Risk (Limited exposure)
- **4.5-5.0**: High Risk (Not recommended)

**Recommendation:** ✅ **APPROVED** for Yearn integration with standard monitoring in place.
