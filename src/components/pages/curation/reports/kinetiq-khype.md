# Protocol Risk Assessment: Kinetiq kHYPE

- **Assessment Date:** February 17, 2026
- **Token:** kHYPE
- **Chain:** HyperEVM (Hyperliquid L1 ecosystem)
- **Token Address:** [`0xfd739d4e423301ce9385c1fb8850539d657c296d`](https://hyperevmscan.io/address/0xfd739d4e423301ce9385c1fb8850539d657c296d)
- **Final Score: 2.315/5.0**

## Overview + Links

Kinetiq is a liquid staking protocol for HYPE on Hyperliquid L1. Users stake HYPE and receive `kHYPE`, a yield-bearing liquid staking token whose redemption value appreciates from staking rewards. kHYPE uses an exchange-rate model (not rebasing) — 1 kHYPE currently represents ~2.26 HYPE.

Kinetiq routes stake through a `StakingPool` contract that manages validator delegation, queue-based unstaking, and fee collection. Additional products include `vaultHYPE` / `xkHYPE` and Kinetiq Markets.

**Links:**

- [Kinetiq app](https://kinetiq.xyz/)
- [Kinetiq docs](https://docs.kinetiq.xyz/)
- [kHYPE docs](https://docs.kinetiq.xyz/kinetiq-lsd/khype)
- [StakeHub docs](https://docs.kinetiq.xyz/kinetiq-lsd/stakehub)
- [Contracts page](https://docs.kinetiq.xyz/resources/contracts)
- [Audits page](https://docs.kinetiq.xyz/resources/audits)
- [Kinetiq bug bounty (Cantina)](https://cantina.xyz/bounties/a98129d7-dd15-4c16-b2cb-d8cc42f87de4)
- [CoinGecko kHYPE](https://www.coingecko.com/en/coins/kinetiq-staked-hype)
- [DeFiLlama Kinetiq](https://defillama.com/protocol/kinetiq)

## Contract Addresses

All contracts are deployed on HyperEVM (Hyperliquid L1). Explorer: [HyperEVMScan](https://hyperevmscan.io).

**On-chain verified contracts (have deployed bytecode):**

| Contract | Address | Type |
|----------|---------|------|
| kHYPE | [`0xfd739d4e423301ce9385c1fb8850539d657c296d`](https://hyperevmscan.io/address/0xfd739d4e423301ce9385c1fb8850539d657c296d) | Proxy (ERC-20 LST) |
| kHYPE Implementation | [`0xfe3216d46448efd7708435eeb851950742681975`](https://hyperevmscan.io/address/0xfe3216d46448efd7708435eeb851950742681975) | Implementation |
| kHYPE ProxyAdmin | [`0x9c1e8db004d8158a52e83ffdc63e37eabea8304c`](https://hyperevmscan.io/address/0x9c1e8db004d8158a52e83ffdc63e37eabea8304c) | EIP-1967 Admin |
| StakingPool (Minter/Burner) | [`0x393D0B87Ed38fc779FD9611144aE649BA6082109`](https://hyperevmscan.io/address/0x393D0B87Ed38fc779FD9611144aE649BA6082109) | Proxy |
| StakingPool Implementation | [`0x69d4c44398fc95bbe86755ea481b467fc6a09c84`](https://hyperevmscan.io/address/0x69d4c44398fc95bbe86755ea481b467fc6a09c84) | Implementation |
| StakingPool ProxyAdmin | [`0x8194aa9eca9225f96a690072b22a9ad0dd064f64`](https://hyperevmscan.io/address/0x8194aa9eca9225f96a690072b22a9ad0dd064f64) | EIP-1967 Admin |
| PauserRegistry | [`0x752E76ea71960Da08644614E626c9F9Ff5a50547`](https://hyperevmscan.io/address/0x752E76ea71960Da08644614E626c9F9Ff5a50547) | Proxy |
| PauserRegistry ProxyAdmin | [`0xd26c2c4a8bd4f78c64212318424ed794be120ea6`](https://hyperevmscan.io/address/0xd26c2c4a8bd4f78c64212318424ed794be120ea6) | EIP-1967 Admin |
| Governance Multisig | [`0x18A82c968b992D28D4D812920eB7b4305306f8F1`](https://hyperevmscan.io/address/0x18A82c968b992D28D4D812920eB7b4305306f8F1) | Gnosis Safe (4-of-7) |
| Treasury Multisig | [`0x64bD77698Ab7C3Fd0a1F54497b228ED7a02098E3`](https://hyperevmscan.io/address/0x64bD77698Ab7C3Fd0a1F54497b228ED7a02098E3) | Gnosis Safe (4-of-7) |

All three ProxyAdmin contracts are owned by the [`Governance Multisig`](https://hyperevmscan.io/address/0x18A82c968b992D28D4D812920eB7b4305306f8F1). The **4-of-7 multisig can upgrade all contract implementations** without timelock.

## How Hyperliquid Staking Works (Context)

Hyperliquid staking is validator-based. HYPE is delegated to validators, and rewards depend on validator performance and network-level staking parameters.

Important slashing context (as of February 12, 2026, per official Hyperliquid docs):
- **No automatic slashing is implemented** ("There is currently no automatic slashing implemented").
- Slashing is "reserved for provably malicious behavior such as double-signing blocks at the same round."
- Validator penalties are jailing-only: jailed validators produce no rewards for delegators, but no principal loss occurs.
- Validators may be jailed by peer quorum vote for inadequate latency/frequency of consensus messages.
- Jailed validators can unjail themselves subject to on-chain rate limits.
- Self-delegation requirement: 10,000 HYPE (locked 1 year). Delegation lockup: 1 day.
- Unstaking queue (staking → spot): **7 days**. Max 5 pending withdrawals per address.
- Governance can still change staking/penalty rules in future.

Implication for kHYPE:
- Current tail risk is more validator-performance/liveness and queue-liquidity related than immediate automatic slash haircut.
- Governance-introduced slashing would materially change kHYPE risk profile and should trigger reassessment.

## Audits and Due Diligence Disclosures

Kinetiq hosts audit reports in a [Google Drive folder](https://drive.google.com/drive/folders/1T3ZGl6HNmt5LaKwdCmrA9HS7MsXheOys) (linked from `https://audits.kinetiq.xyz/`).

### kHYPE / staking-core relevant audits (verified from Google Drive)

| Date | Auditor | Scope | Link |
|---|---|---|---|
| Mar 2025 | Pashov Audit Group | kHYPE LST | [PDF](https://drive.google.com/file/d/1k9jA3JJ_e85AtI-EJRBdo-cq4JOvBok3/view) |
| Mar 2025 | Zenith | kHYPE LST | [PDF](https://drive.google.com/file/d/1S5Xm1rinC7kOt826eXhwrVbX7WtdwsWr/view) |
| Apr 2025 | Code4rena | kHYPE LST ($35K, 69+ wardens) | [Report](https://code4rena.com/audits/2025-04-kinetiq) |
| Jun 2025 | Spearbit | kHYPE LST | [PDF](https://drive.google.com/file/d/121JxhR9TpWGEoa1-GGm9fNbl3ByjOOhe/view) |
| Nov 2025 | Pashov Audit Group | kHYPE instant unstake | [PDF](https://drive.google.com/file/d/1ada6eazjmtatQIt38_QrZ3Nks7pYTly1/view) |

### Broader protocol audits (additional context)

| Date | Auditor | Scope | Link |
|---|---|---|---|
| Nov 2025 | Spearbit | kmHYPE | [PDF](https://drive.google.com/file/d/1uffwIAjfRDdCLCTpN66h1zK_Qji41Fr-/view) |
| Nov 2025 | Zenith | kmHYPE | [PDF](https://drive.google.com/file/d/1pMti8B4qM15-v61AyGe-hEdi8zcXR6at/view) |
| Jan 2026 | Spearbit | skNTQ | [PDF](https://drive.google.com/file/d/1LSZWM2sheoh1qeBqjkwkkl_1wO8gtI6H/view) |

Architecture complexity: high-moderate. kHYPE relies on multiple upgradeable proxy contracts (kHYPE token, StakingPool, PauserRegistry), which increases integration/control-plane risk compared to single-contract wrappers.

### Bug Bounty

- **Platform:** Cantina
- **Max Reward:** up to **$5,000,000** (Critical severity)
- **Scope:** kHYPE, StakingManager, StakingAccountant, ValidatorManager, PauserRegistry, OracleManager, OracleAdapter
- **Status:** Live since September 15, 2025; 294 findings submitted
- **Link:** https://cantina.xyz/bounties/a98129d7-dd15-4c16-b2cb-d8cc42f87de4

## Historical Track Record

- Listed on DeFiLlama since **July 17, 2025** (~7 months at assessment date).
- **Current TVL**: ~$683M (February 2026, per DeFiLlama).
- **Peak TVL**: ~$2.65B (October 4, 2025).
- **TVL trend**: Significant decline from peak, currently at ~26% of ATH. Likely driven by broader HYPE price movements.
- **CoinGecko market data**: kHYPE price $29.73, market cap ~$657M, 24h volume ~$12.8M. ATH $59.44 on September 18, 2025.
- **totalSupply (on-chain)**: 22,104,091.53 kHYPE.
- No Kinetiq entry found in [DeFiLlama Hacks database](https://defillama.com/hacks) or [Rekt News](https://rekt.news/).
- Shorter operating history and evolving module set (kHYPE + xkHYPE/skHYPE/kmHYPE) imply higher change risk.

## Funds Management

kHYPE manages deposited HYPE through a StakingPool contract and validator delegation, not a passive 1:1 wrapper.

### Accessibility

- Minting via stake flow is permissionless through app/contract path (`whitelistEnabled()` = false on-chain).
- Unstaking is queue-based, not instant.
- On-chain verified unstaking parameters:
  - **`withdrawalDelay()`**: 604,800 seconds = **7 days** exact
  - **`unstakeFeeRate()`**: 10 (0.10% in basis points)
  - `withdrawalPaused()`: false
  - `stakingPaused()`: false

### Collateralization

On-chain state (verified February 12, 2026):
- **kHYPE totalSupply**: 22,104,091.53 kHYPE
- **StakingPool totalStaked**: 50,013,410.11 HYPE
- **Implied exchange rate**: 1 kHYPE = 2.2626 HYPE
- **StakingPool liquid HYPE**: 203,958.26 HYPE (0.41% of totalStaked held as liquid buffer)
- **StakingPool kHYPE held**: 960,784.91 kHYPE
- **totalQueuedWithdrawals**: 971,460.09 HYPE
- **totalClaimed**: 27,987,503.62 HYPE

Economic backing is staked HYPE plus liquid reserves. Backing quality is primarily dependent on Hyperliquid validator set quality and staking outcomes. No off-chain custodial reserve model is disclosed for core kHYPE backing.

### Provability

- Core staking and token accounting are on-chain.
- All core contracts (kHYPE, StakingPool, PauserRegistry and their implementations) are **source-code verified on HyperEVMScan** (exact match).
- Key on-chain readable functions verified: `totalSupply()`, `totalStaked()`, `totalQueuedWithdrawals()`, `totalClaimed()`, `withdrawalDelay()`, `unstakeFeeRate()`.
- Exchange rate is derived from totalStaked / totalSupply — updated via staking operations, not admin oracle.
- Contracts use OpenZeppelin AccessControlEnumerable (verified via `supportsInterface`). kHYPE supports EIP-2612 Permit.
- kHYPE is **not** ERC4626 (`convertToAssets`, `totalAssets`, `asset` all revert).

## Liquidity Risk

kHYPE exit routes:

1. Protocol unstake queue (primary deterministic exit)
- On-chain `withdrawalDelay()` = 7 days
- Fee-bearing exit path (0.10%)
- Queue delay can expand under stress

2. Secondary market liquidity (per DeFiLlama, February 2026)

**Total DEX liquidity: ~$44M** across 39 pools on HyperEVM DEXes.

Top DEX pools:

| DEX | Pair | TVL | 24h Volume |
|-----|------|-----|------------|
| Project X | WHYPE/KHYPE | $8,206,746 | $6,933,060 |
| Project X | USDT0/KHYPE | $2,337,679 | $312,037 |
| Ramses HL | WHYPE/KHYPE | $281,206 | $1,512,669 |
| HyperSwap V3 | WHYPE/KHYPE | $268,244 | $599,408 |

**Lending protocol deposits** dominate external kHYPE usage: ~$170M HyperLend, ~$215M Morpho, ~$27M Pendle. These are not exit liquidity.

All trading is DEX-based on HyperEVM. No centralized exchange listings found.

Given queue dependence and same-ecosystem DEX liquidity, kHYPE liquidity risk is materially higher than WHYPE but better than stHYPE (which has ~$403K DEX depth vs kHYPE's $44M).

## Centralization & Control Risks

### Governance

On-chain verified governance data:

- **Multisig address**: [`Governance Multisig`](https://hyperevmscan.io/address/0x18A82c968b992D28D4D812920eB7b4305306f8F1) (Gnosis Safe on HyperEVM)
- **Threshold**: **4-of-7** (verified via `getThreshold()`)
- **Version**: 1.3.0
- **Nonce**: 32 transactions executed
- **Timelock**: **None.** Exhaustive on-chain verification confirmed no timelock exists — Safe has no modules (`getModulesPaginated` returns empty), no guard (storage slot `0x4a204f...` is zero), all three ProxyAdmins are standard OpenZeppelin (881 bytes, owned directly by multisig), and no `EnabledModule` events have ever been emitted.
- **Signer identities**: All 7 signers are pseudonymous.

**Role structure (verified via AccessControlEnumerable):**

| Contract | Role | Holder |
|----------|------|--------|
| kHYPE | DEFAULT_ADMIN | Governance Multisig (4/7) |
| kHYPE | MINTER | [`StakingPool`](https://hyperevmscan.io/address/0x393D0B87Ed38fc779FD9611144aE649BA6082109) |
| kHYPE | BURNER | [`StakingPool`](https://hyperevmscan.io/address/0x393D0B87Ed38fc779FD9611144aE649BA6082109) |
| StakingPool | DEFAULT_ADMIN | Governance Multisig (4/7) |
| StakingPool | MANAGER | Governance Multisig (4/7) |
| StakingPool | OPERATOR | [`OPERATOR EOA`](https://hyperevmscan.io/address/0x23A4604cDFe8e9e2e9Cf7C10D7492B0F3f4B4038) |
| PauserRegistry | DEFAULT_ADMIN | Governance Multisig (4/7) |

**Key concern:** The OPERATOR role on the StakingPool is held by a single **EOA** ([`OPERATOR EOA`](https://hyperevmscan.io/address/0x23A4604cDFe8e9e2e9Cf7C10D7492B0F3f4B4038)), not the multisig. This address is a Kinetiq automated bot (6,421 nonce) that calls `generatePerformance()` and `updateValidatorMetrics()` on a regular basis.

### Programmability

- Hybrid on-chain system with multiple upgradeable proxy contracts.
- Exchange rate is derived from on-chain state (totalStaked / totalSupply), not admin-set.
- StakingPool has significant admin functions: `pauseWithdrawal()`, `pauseStaking()`, `setWithdrawalDelay()`, `setUnstakeFeeRate()`, `executeEmergencyWithdrawal()`, `rescueToken()`.
- Emergency withdrawal and token rescue capabilities exist — powerful admin functions.

### External Dependencies

Critical dependencies:
1. Hyperliquid L1 consensus/liveness.
2. Hyperliquid validator performance and staking/slashing rules.
3. HyperEVM execution environment.
4. DEX liquidity conditions for kHYPE/HYPE exits.

Dependency concentration on Hyperliquid ecosystem is structurally high. **HyperEVM is NOT a separate chain** — it shares the same HyperBFT consensus as HyperCore. There is no bridge risk between HyperCore and HyperEVM; the risk is pure L1 liveness.

**Important:** Hyperliquid is a highly centralized chain — Hyper Foundation controls 56.4% of validator stake via 5 validators, exceeding the 1/3 BFT blocking minority. HYPE staking cannot be considered as safe as ETH staking, where validator set decentralization is significantly stronger (~1M validators, no single entity near blocking minority). This centralization risk is inherited by kHYPE and should be weighed accordingly.

### Hyperliquid Validator Set Dependency (Quantified)

Source: Hyperliquid L1 API (`POST https://api.hyperliquid.xyz/info`)

Verify validator data: [Hyperliquid Staking Portal](https://app.hyperliquid.xyz/staking) | [Validator Performance](https://app.hyperliquid.xyz/staking/validatorPerformance) | [HypurrScan Staking](https://hypurrscan.io/staking)

**Network overview (February 2026):**

| Metric | Value |
|--------|-------|
| Total validators | 30 (24 active, 5 jailed, 1 inactive) |
| Total network stake | 436.2M HYPE |
| Active stake | 431.9M HYPE |
| Jailed stake | 4.3M HYPE (0.99%) |

**Concentration risk:**
- **Hyper Foundation operates 5 validators** controlling **56.4%** of active stake (243.4M HYPE). This exceeds the **1/3 blocking minority** for BFT consensus.
- Top 5 validators (4 HF + Anchorage) = 60.1% of active stake.
- Top 10 validators = 83.4% of active stake.
- Kinetiq represents **11.5% of total network stake** — the single largest protocol-level staker on Hyperliquid.

**Kinetiq's delegation strategy:**
- **ValidatorManager** has 22 pre-approved validators registered; 9 receive active delegations.
- StakeHub autonomously scores and delegates via algorithmic selection.
- Total L1 delegated: **21.5M HYPE** (vs 50.0M `totalStaked` on EVM — the ~28.5M gap is likely undelegated buffer or unstaking queue).

| Validator | Delegation (HYPE) | % of Kinetiq | Lock Status |
|-----------|-------------------|-------------|-------------|
| **Kinetiq x Hyperion** (own) | 6,003,900 | **27.9%** | Locked |
| Hyper Foundation 1-5 (×4) | 1,936,320 each | 9.0% each (45.0% total) | Unlocked |
| infinitefield.xyz | 1,936,320 | 9.0% | Unlocked |
| Hypurrscanning | 1,936,320 | 9.0% | Unlocked |
| Nansen x HypurrCollective | 1,936,320 | 9.0% | Unlocked |

- **Delegation HHI: 1,429** (competitive range, below 1,500 threshold).
- **45.0%** of Kinetiq delegations go to Hyper Foundation validators; **55.0%** to non-HF validators.
- All delegated validators have 99.9-100% uptime and APR in the 2.16-2.25% range.
- **Zero exposure to currently jailed validators.**

**Slashing/jailing context:**
- **No automatic slashing is implemented** on Hyperliquid (per [official docs](https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/staking)). However, slashing may be enforced in the future and must be considered a forward-looking risk if Kinetiq delegates to validators that suffer a slashing event (per [Kinetiq risk disclosures](https://kinetiq.xyz/stake-hype#what-are-the-potential-risks)).
- Jailing = reward cessation only, no principal loss. Jailed validators visible on [Hyperliquid Staking Portal](https://app.hyperliquid.xyz/staking).
- Validators can be jailed by peer vote for latency/responsiveness issues (see [validator prison docs](https://hyperliquid.gitbook.io/hyperliquid-docs/hypercore/staking)).
- Unstaking queue from L1 validators: **7 days**.

**L1 incident history:** No Hyperliquid L1 consensus or liveness incidents found in the DeFiLlama hacks database. Three HyperEVM application-level exploits were recorded (HyperVault $3.6M rugpull, Hyperdrive $773K router exploit, Raga Finance $18.5K exploit) — none affecting L1 itself.

## Operational Risk

- Audit depth is reasonable for protocol age (5 core audits from 4 firms).
- Bug bounty at $5M max is strong and has 294 submissions.
- **Team/legal entity:** Two entity names are used inconsistently — **"Kinetiq Labs"** (Terms of Use) vs **"Kinetiq Research"** (Privacy Policy, GitHub org, footer copyright). GitHub org lists **Singapore** as location; Privacy Policy references **Panama** for data transfers. Terms of Use do not name a governing law jurisdiction. No registered address or company registration number is publicly disclosed.
- **Known team members** (via GitHub commit history on `github.com/kinetiq-research`):
  - **Justin Greenberg** ([@justingreenberg](https://github.com/justingreenberg), Twitter: @greenbergz) — primary developer on `f1rewall` repo, PGP-signed commits.
  - **GregTheDev** ([@0xgregthedev](https://github.com/0xgregthedev)) — Rust/Solidity developer, primary contributor to `hl-rs` (Hyperliquid Rust SDK). `gregthedev.eth` funded governance Safe Signer 2.
  - **mektigboy** ([@mektigboy](https://github.com/mektigboy), Twitter: @mektigboy) — self-identified "driver @kinetiq-research" in GitHub bio. Prior experience with sherlock-audit and security audit orgs.
- Contact: security@kinetiq.xyz (with PGP key at `kinetiq.xyz/.well-known/pubkey.asc`), contact@kinetiq.xyz, info@kinetiq.xyz.
- No public "About" or "Team" page exists on kinetiq.xyz or docs.kinetiq.xyz. Twitter: [@Kinetiq_xyz](https://twitter.com/Kinetiq_xyz).
- Contracts are **not open-source on GitHub** — the Kinetiq GitHub org (`github.com/kinetiq-research`) has only SDK/utility repos, no smart contract code. However, all core contracts are **source-code verified on HyperEVMScan** (exact match).
- No public formal verification disclosure found.

## Monitoring

Key contracts to monitor:
- kHYPE Proxy: [`kHYPE`](https://hyperevmscan.io/address/0xfd739d4e423301ce9385c1fb8850539d657c296d)
- StakingPool Proxy: [`StakingPool`](https://hyperevmscan.io/address/0x393D0B87Ed38fc779FD9611144aE649BA6082109)
- PauserRegistry Proxy: [`PauserRegistry`](https://hyperevmscan.io/address/0x752E76ea71960Da08644614E626c9F9Ff5a50547)
- Governance Multisig: [`Governance Multisig`](https://hyperevmscan.io/address/0x18A82c968b992D28D4D812920eB7b4305306f8F1) (Gnosis Safe 4-of-7)

### 1. Governance Monitoring (MANDATORY)

Monitor all privileged role actions and parameter changes for:
- RoleGranted / RoleRevoked events on kHYPE and StakingPool (AccessControl)
- Upgraded events on proxy contracts (implementation changes)
- AddedOwner / RemovedOwner / ChangedThreshold on Governance Safe

Immediate alerts:
- ownership/multisig signer changes
- threshold changes
- implementation upgrades
- emergency pause activations
- parameter changes (withdrawalDelay, unstakeFeeRate, stakingLimit)

### 2. Backing & Supply Monitoring (MANDATORY)

Track:
- `kHYPE.totalSupply()` (currently 22.1M)
- `StakingPool.totalStaked()` (currently 50.0M HYPE)
- Implied exchange rate trend
- StakingPool native HYPE balance (liquid buffer)

Alert thresholds:
- backing ratio drift >1% in 24h (unless expected market event)
- liquid buffer drops below 50K HYPE

### 3. Queue Health Monitoring (MANDATORY)

Track:
- `StakingPool.totalQueuedWithdrawals()` (currently 971K HYPE)
- queue size and average wait time
- daily enqueue/dequeue flow

Alert thresholds:
- average unstake latency >10 days sustained
- queue size growth >30% day-over-day

### 4. Market Liquidity Monitoring

Track:
- kHYPE/HYPE and kHYPE/stable liquidity depth on Project X, Ramses, HyperSwap
- implied NAV discount/premium
- slippage for standard notional buckets

Alert thresholds:
- discount >2% sustained for 24h
- liquidity depth decline >40% day-over-day

### 5. Hyperliquid Base Risk Monitoring

Track official Hyperliquid updates for:
- validator jailing waves
- staking parameter changes
- any governance introduction of automatic validator slashing
- chain liveness/finality incidents

## Risk Summary

### Key Strengths

1. Significant TVL (~$683M) and DeFi integration (~$493M across 52 pools).
2. 5 core audits from reputable firms (Pashov, Zenith, Code4rena, Spearbit) across 2025.
3. Active Cantina bug bounty with $5M maximum and 294 submissions.
4. On-chain verifiable staking economics with AccessControl role enumeration.
5. 4-of-7 multisig governance (stronger than many DeFi protocol minimums).

### Key Risks

1. Queue-based unstake path (7 days on-chain) introduces redemption delay risk.
2. Multi-contract upgradeable proxy architecture adds integration and control-plane complexity.
3. OPERATOR role on StakingPool held by single EOA (automated bot, not multisig-protected).
4. **No timelock on multisig** — confirmed exhaustively on-chain (no modules, no guard, no timelock contract). Upgrades can be executed immediately.
5. **Hyper Foundation controls 56.4% of network stake** — exceeds 1/3 BFT blocking minority. Kinetiq delegates 45% of its stake to HF validators.
6. **Multisig signer independence is questionable** — inter-signer funding chains, shared funders (Signers 4+7), one inactive signer (Signer 7 = 0 nonce), all appear team-associated rather than independent external parties.
7. Contracts not open-sourced on GitHub (but verified on-chain on HyperEVMScan).
8. ~28.5M HYPE gap between EVM `totalStaked` (50M) and L1 actual delegated (21.5M) — needs monitoring.
9. Legal entity ambiguity: "Kinetiq Labs" (Terms) vs "Kinetiq Research" (Privacy/GitHub) with no specific governing law jurisdiction named.

### Critical Risks

- `executeEmergencyWithdrawal()` and `rescueToken()` functions give admin significant power over funds.

---

## Risk Score Assessment

### Critical Risk Gates

- [x] **No audit** -> **PASS** (5 core audits from 4 reputable firms)
- [x] **Unverifiable reserves** -> **PASS** (on-chain staking model with readable state)
- [x] **Total centralization** -> **PASS** (4-of-7 multisig, not single EOA)

### Category Scores

#### Category 1: Audits & Historical Track Record (Weight: 20%)

- 5 core audits by reputable firms (Pashov x2, Zenith, Code4rena, Spearbit) from Mar-Nov 2025.
- Cantina bug bounty at $5M max with 294 submissions. High bug bounty (>$5M) reduces score by 0.5.
- ~7 months in production, TVL ~$683M (peaked ~$2.65B).
- Per rubric: 3+ audits by top firms, active bug bounty >$1M -> score 1 range for audits. 6-12 months, TVL >$100M fits score 2-3 for track record. Net: 1.5 + track record penalty.

**Score: 2.0/5**

#### Category 2: Centralization & Control Risks (Weight: 30%)

Subscores:
- Governance: **4.0** — 4-of-7 multisig (verified on-chain), but: **no timelock** (confirmed exhaustively), signer independence is questionable (inter-signer funding, shared funders, 1 inactive signer, all team-associated), powerful admin functions (emergency withdrawal, rescue, parameter changes). Effectively a team-controlled multisig, not an independent governance body. Per rubric: formal structure is 4/7 but real independence is much weaker.
- Programmability: **2.0** — Hybrid on-chain system with upgradeable proxies. Exchange rate is on-chain derived (not admin-set). All core contracts are source-code verified on-chain (exact match).
- External dependencies: **4.0** — Critical single-ecosystem dependency on Hyperliquid L1. Hyper Foundation controls 56.4% of validator stake (blocking minority). Kinetiq delegates 45% of its stake to HF validators.

Centralization score = (4.0 + 2.0 + 4.0) / 3 = **3.33**

**Score: 3.3/5**

#### Category 3: Funds Management (Weight: 30%)

Subscores:
- Collateralization: **2.0** — 100% on-chain collateral (staked HYPE). Liquid buffer only 0.41% of totalStaked. Collateral quality = single-asset (HYPE), high quality within Hyperliquid ecosystem. Exchange rate verified at 2.26x.
- Provability: **1.5** — Key state readable on-chain via AccessControlEnumerable. Exchange rate derived programmatically. All core contracts (kHYPE, StakingPool, PauserRegistry and their implementations) are source-code verified on HyperEVMScan (exact match), enabling independent verification.

Funds management score = (2.0 + 1.5) / 2 = **1.75**

**Score: 1.75/5**

#### Category 4: Liquidity Risk (Weight: 15%)

- Queue-based withdrawals: 7-day standard unstaking period (verified on-chain), standard for LSTs.
- DEX liquidity is strong relative to TVL: ~$44M total across 39 pools (~6.4% of TVL). Largest pool ~$8.2M with $6.9M daily volume.
- All liquidity is on HyperEVM DEXes — no CEX listings, but sufficient DEX depth for the asset class.

**Score: 2.0/5**

#### Category 5: Operational Risk (Weight: 5%)

- Docs present but client-side rendered (verification difficult).
- Audits and bounty are strong for protocol age.
- Team transparency: unknown/anon. Contracts not on GitHub but verified on-chain.
- No public incident response plan documented.

**Score: 2.0/5**

### Final Score Calculation

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Audits & Historical | 2.0 | 20% | 0.40 |
| Centralization & Control | 3.3 | 30% | 0.99 |
| Funds Management | 1.75 | 30% | 0.525 |
| Liquidity Risk | 2.0 | 15% | 0.30 |
| Operational Risk | 2.0 | 5% | 0.10 |
| **Final Score** | | | **2.315 / 5.0** |

## Overall Risk Score: **2.3 / 5.0**

### Risk Tier: **MEDIUM RISK**

Rationale:
- kHYPE is a well-audited LST with significant TVL ($683M) and DeFi adoption.
- Governance is formally 4-of-7 multisig but signer independence is weak — inter-signer funding, shared funders, 1 inactive signer, all team-associated.
- No timelock (confirmed exhaustively on-chain) and powerful admin functions (emergency withdrawal, rescue).
- Hyper Foundation controls 56.4% of network validator stake; Kinetiq delegates 45% of its stake to HF validators.
- Liquidity is decent for an LST ($44M DEX depth) but all on HyperEVM.
- Three identified team members via GitHub but no public team page, ambiguous legal entity (Labs vs Research), no specified governing jurisdiction.

## Reassessment Triggers

- **Time-based**: Reassess in 3 months
- **TVL-based**: Reassess if TVL changes by more than 50%
1. Any Hyperliquid staking governance change that introduces automatic validator slashing.
2. Any kHYPE exploit or emergency pause activation.
3. Unstake queue latency >10 days sustained for >72h.
4. kHYPE discount >3% sustained for >24h.
5. Any privileged role threshold reduction or owner structure downgrade.
6. Major contract migration or implementation upgrade.
7. OPERATOR EOA change or role reassignment.
8. Timelock implementation (positive trigger — would warrant score improvement).

## Sources

- Kinetiq app: https://kinetiq.xyz/
- Kinetiq docs: https://docs.kinetiq.xyz/
- kHYPE docs: https://docs.kinetiq.xyz/kinetiq-lsd/khype
- StakeHub docs: https://docs.kinetiq.xyz/kinetiq-lsd/stakehub
- Kinetiq FAQ: https://docs.kinetiq.xyz/resources/faq
- Kinetiq contracts: https://docs.kinetiq.xyz/resources/contracts
- Kinetiq audits: https://docs.kinetiq.xyz/resources/audits
- Kinetiq audit PDFs (Google Drive): https://drive.google.com/drive/folders/1T3ZGl6HNmt5LaKwdCmrA9HS7MsXheOys
- Code4rena Kinetiq audit: https://code4rena.com/audits/2025-04-kinetiq
- Kinetiq bug bounty (Cantina): https://cantina.xyz/bounties/a98129d7-dd15-4c16-b2cb-d8cc42f87de4
- CoinGecko kHYPE: https://www.coingecko.com/en/coins/kinetiq-staked-hype
- DeFiLlama Kinetiq: https://defillama.com/protocol/kinetiq
- Hyperliquid staking docs: https://hyperliquid.gitbook.io/hyperliquid-docs/hype-staking
- Hyperliquid validator prison docs: https://hyperliquid.gitbook.io/hyperliquid-docs/hype-staking/validator-prison
- Hyperliquid risks docs: https://hyperliquid.gitbook.io/hyperliquid-docs/risks
- On-chain verification via `cast` against HyperEVM RPC (`rpc.hyperliquid.xyz/evm`)
- Hyperliquid L1 API: `POST https://api.hyperliquid.xyz/info` (validator summaries, delegations)
- Kinetiq GitHub org: https://github.com/kinetiq-research
- Kinetiq Terms of Use: https://kinetiq.xyz/terms
- Kinetiq Privacy Policy: https://kinetiq.xyz/privacy
- Kinetiq security.txt: https://kinetiq.xyz/.well-known/security.txt
- ENS reverse lookup via `0x3671aE578E63FdF66ad4F3E12CC0c0d71Ac7510C` (getNames)
- RouteScan API for HyperEVM (chain 999) transaction tracing
- Etherscan V2 API for cross-chain address verification
