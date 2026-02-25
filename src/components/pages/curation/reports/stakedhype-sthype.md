# Protocol Risk Assessment: StakedHYPE

- **Assessment Date:** February 18, 2026
- **Token:** stHYPE
- **Chain:** HyperEVM (Hyperliquid L1 ecosystem)
- **Token Address:** [`0xfFaa4a3D97fE9107Cef8a3F48c069F577Ff76cC1`](https://hyperevmscan.io/address/0xfFaa4a3D97fE9107Cef8a3F48c069F577Ff76cC1)
- **Final Score: 3.03/5.0**

## Overview + Links

StakedHYPE issues `stHYPE`, a liquid staking token representing HYPE staked into Hyperliquid validators through Hyperliquid Stake Marketplace (HSM). Conceptually it is similar to stETH: users deposit native HYPE, receive an LST (`stHYPE`), and accumulate staking rewards in token exchange rate terms.

StakedHYPE was originally built by **Thunderhead Labs**, a multi-LST provider (stFLIP, stELX, stMOVE, tPOKT, stHYPE) with shared modular infrastructure across products. In August 2025, stHYPE was **acquired by Valantis Labs**, which now maintains the protocol. The codebase benefits from components battle-tested across multiple Thunderhead LST deployments.

The architecture has two layers:

1. **LST layer (StakedHYPE)**
- User-facing mint/redeem flow for stHYPE.
- Maintains a withdrawal queue and reserve buffer.

2. **Validator staking layer (HSM)**
- HYPE is delegated into Hyperliquid validators via HSM infra.
- Uses HSM voting and delegation controls to distribute stake and manage exits.

**Links:**

- [StakedHYPE docs](https://docs.stakedhype.fi/)
- [HSM technical page](https://docs.stakedhype.fi/technical/hyperliquid-stake-marketplace-hsm)
- [Stake Accounts & Architecture](https://docs.stakedhype.fi/technical/stake-accounts)
- [stHYPE Integration (mint/burn/unstaking)](https://docs.stakedhype.fi/technical/integrate)
- [Transparency & Risks](https://docs.stakedhype.fi/info/transparency-and-risks)
- [Contract Addresses](https://docs.stakedhype.fi/technical/contract-addresses)
- [Audits](https://docs.stakedhype.fi/technical/audits)
- [StakedHYPE security page](https://docs.stakedhype.fi/technical/security)
- [StakedHYPE governance page](https://docs.stakedhype.fi/governance)
- [Hyperliquid staking docs](https://hyperliquid.gitbook.io/hyperliquid-docs/hype-staking)
- [Hyperliquid validator docs](https://hyperliquid.gitbook.io/hyperliquid-docs/hype-staking/validators)

## Contract Addresses

All contracts are deployed on HyperEVM (Hyperliquid L1). Explorer: [HyperEVMScan](https://hyperevmscan.io).

| Contract | Address | Type |
|----------|---------|------|
| stHYPE | [`0xfFaa4a3D97fE9107Cef8a3F48c069F577Ff76cC1`](https://hyperevmscan.io/address/0xfFaa4a3D97fE9107Cef8a3F48c069F577Ff76cC1) | Proxy (ERC-20 LST) |
| stHYPE Impl | [`0xa2fdc8eca86e3cf2593ec20f42a777984927553c`](https://hyperevmscan.io/address/0xa2fdc8eca86e3cf2593ec20f42a777984927553c) | Implementation |
| stHYPE ProxyAdmin | [`0xe7b0f26e8e20e109441f0ad1c885fffbb27125dc`](https://hyperevmscan.io/address/0xe7b0f26e8e20e109441f0ad1c885fffbb27125dc) | EIP-1967 Admin |
| OverseerV1 | [`0xB96f07367e69e86d6e9C3F29215885104813eeAE`](https://hyperevmscan.io/address/0xB96f07367e69e86d6e9C3F29215885104813eeAE) | Proxy (mint/burn controller) |
| OverseerV1 Impl | [`0xc9dcf086ee9f063bcd4c7d2ec4b82085142a8cee`](https://hyperevmscan.io/address/0xc9dcf086ee9f063bcd4c7d2ec4b82085142a8cee) | Implementation |
| OverseerV1 ProxyAdmin | [`0x943a7e81373423f7bb0fb6a3e55553638264fd6b`](https://hyperevmscan.io/address/0x943a7e81373423f7bb0fb6a3e55553638264fd6b) | EIP-1967 Admin |
| wstHYPE | [`0x94e8396e0869c9F2200760aF0621aFd240E1CF38`](https://hyperevmscan.io/address/0x94e8396e0869c9F2200760aF0621aFd240E1CF38) | Proxy (wrapped shares) |
| wstHYPE Impl | [`0x2936b42d1bfa7298faa44644ddea665c7aa51ef8`](https://hyperevmscan.io/address/0x2936b42d1bfa7298faa44644ddea665c7aa51ef8) | Implementation |
| wstHYPE ProxyAdmin | [`0xa29a2043b2fcbc9189beb9e6efcb2ba48bb3d586`](https://hyperevmscan.io/address/0xa29a2043b2fcbc9189beb9e6efcb2ba48bb3d586) | EIP-1967 Admin |
| Governance Multisig | [`0x97dee0ea4ca10560f260a0f6f45bdc128a1d51f9`](https://hyperevmscan.io/address/0x97dee0ea4ca10560f260a0f6f45bdc128a1d51f9) | Gnosis Safe (3-of-5) |

All contracts are **upgradeable** via EIP-1967 transparent proxy pattern. Each proxy has a separate ProxyAdmin contract. All three ProxyAdmin contracts are owned by the governance multisig (`0x97dee0ea...`, verified via `owner()` on each ProxyAdmin). This means the **3-of-5 multisig can upgrade all contract implementations** without timelock.

Source: [docs.stakedhype.fi/technical/contract-addresses](https://docs.stakedhype.fi/technical/contract-addresses) + on-chain verification via `eth_getStorageAt` (EIP-1967 slots).

## How Hyperliquid Staking Works (Context)

Hyperliquid’s staking model is validator-based and epoch-driven.

- Users stake HYPE and delegate to validators.
- Rewards accrue through validator performance and protocol emissions/fees.
- Validator set and stake movement are constrained by protocol rules (epoch timing and activation/deactivation semantics).
- Hyperliquid docs describe validator/L1 operational risks; this is the core external risk inherited by any HYPE liquid staking protocol.

### Slashing in Hyperliquid (Important for stHYPE)

As of **February 18, 2026**, Hyperliquid docs state that core HYPE staking currently has:

- **No automatic validator slashing mechanism** in live staking.
- **Jailing** as the immediate validator penalty path for uptime/behavior issues.
- A note that governance may introduce explicit validator slashing in the future.

Practical interpretation for stHYPE:
- **Today:** direct stake haircut from automatic validator slashing is low-probability because that mechanism is not yet active in base staking.
- **Still material risk:** validator jailing, poor validator performance, or chain-level instability can still reduce effective yield and delay exits.
- **Future risk step-up:** if governance enables validator slashing later, stHYPE loss profile can change meaningfully and requires immediate reassessment.

Historical status:
- No official Hyperliquid documentation found describing a past **validator slashing event** in HYPE staking as of February 18, 2026.
- This is an inference from official docs and release/risk pages; absence of a documented event is not proof of impossibility.

For stHYPE specifically, staking operations route through HSM abstractions and StakedHYPE’s queue/buffer logic, which adds additional smart-contract and operational layers on top of base protocol staking.

## Audits and Due Diligence Disclosures

StakedHYPE publicly lists 4 audits on its [audits page](https://docs.stakedhype.fi/technical/audits):

| # | Date | Firm | Scope | Link |
|---|---|---|---|---|
| 1 | Feb 2025 | Three Sigma | StakedHYPE contracts | [Report](https://github.com/ValantisLabs/audits/blob/main/Three_Sigma_Feb_25.pdf) |
| 2 | Oct 2025 | Pashov Audit Group | StakedHYPE contracts | [Report](https://github.com/ValantisLabs/audits/blob/main/pashov_oct_25.pdf) |
| 3 | Nov 2025 | Pashov Audit Group | StakedHYPE updates | [Report](https://github.com/ValantisLabs/audits/blob/main/pashov_nov_2025.pdf) |
| 4 | Nov 2025 | Guardian Audits | StakedHYPE updates | [Report](https://github.com/ValantisLabs/audits/blob/main/guardian_nov_2025.pdf) |

StakedHYPE was originally built by **Thunderhead Labs** (multi-LST provider: stFLIP, stELX, stMOVE, tPOKT) and acquired by **Valantis Labs** in August 2025. Cross-LST audits with shared modular components are available in the [Thunderhead audits repo](https://github.com/thunderhead-labs/audits). The Three Sigma audit is mirrored in both repos (identical SHA: `4c39b756`).

The governance system is based on a modified [FraxGovernorOmega](https://github.com/trailofbits/publications/blob/master/reviews/2023-05-fraxgov-securityreview.pdf) (audited by Trail of Bits), but is **not yet implemented** per the audits page.

Additional disclosures:
- HSM docs state code and technical docs are expected to be published in GitHub once finalized, indicating parts of stack/process may still be maturing.
- No public formal verification disclosure was identified.

### Bug Bounty

No Immunefi/Sherlock/Cantina bug bounty link was identified in docs.

Disclosed security contacts:
- Email: audit@valantis.xyz (per [security page](https://docs.stakedhype.fi/technical/security))
- Discord: [StakedHYPE Discord](https://t.co/zZB5aEVqCh)
- Twitter: [@ValantisLabs](https://twitter.com/ValantisLabs)

Assessment note:
- Responsible disclosure channel exists, but absence of a public bounty with payout tiers weakens external adversarial testing incentives relative to peers.

## Historical Track Record

- StakedHYPE documentation indicates active production operation with stHYPE issuance and unstaking mechanisms live.
- Listed on [DeFiLlama](https://defillama.com/protocol/stakedhype) since July 2025 (~8 months at assessment date).
- **Current TVL**: ~$124M (February 18, 2026, per DeFiLlama).
- **Peak TVL**: ~$544M (July 2025).
- **TVL trend**: Significant decline from peak, currently at ~23% of ATH. Likely driven by broader market conditions and HYPE price movements rather than protocol-specific issues.
- No major publicly disclosed exploit was identified in StakedHYPE docs at assessment time. Not listed on [Rekt News](https://rekt.news/) or [DeFiLlama Hacks](https://defillama.com/hacks).
- Track record is materially shorter and less battle-tested than older LSTs like stETH (~8 months vs 3+ years).

## Funds Management

### Strategy and delegation model

stHYPE deposits are managed via HSM-integrated staking operations:

- User deposits -> mint stHYPE.
- Capital is distributed across validator/delegation pathways using HSM.
- A reserve buffer is kept to improve withdrawal responsiveness.
- Redemptions rely on reserve and, when needed, unstake/rebalance processes.

### Accessibility

- stHYPE minting is permissionless at user level through protocol interface.
- Unstaking uses a queue-based process and does not guarantee instant 1:1 native withdrawal.
- Queue and buffer mechanics are key liquidity controls and must be actively monitored.

### Collateralization

On-chain state (verified February 18, 2026):
- **stHYPE totalSupply**: 4,252,373.17 stHYPE
- **Total HYPE backing** (`totalSupply × exchangeRate`): 4,338,882.91 HYPE
- **OverseerV1 liquid reserve**: 261,728.59 HYPE (6.0% of total backing held as liquid HYPE)
- **Exchange rate** (`balancePerShare`): 1.0203 (2.03% accumulated yield since launch)
- **maxRedeemable**: 0 HYPE — no instant redemption buffer available at time of check, all burns go through 7-day unstaking queue
- **burnCount**: 39,113 total burns processed

Economic backing is staked HYPE plus liquid reserves. The remaining ~94.0% of HYPE is staked across validators via HyperCore Staking Modules.
- Backing quality is primarily dependent on Hyperliquid validator set quality and slashing/operational outcomes.
- This is not off-chain custodial collateral; risk is on-chain protocol + validator behavior.

### Provability

- Core staking and token accounting are on-chain by design.
- Key on-chain readable functions verified: `totalSupply()`, `balancePerShare()`, `totalShares()`, `maxRedeemable()`, `burnCount()`, `getBurns(address)`, `redeemable(uint256)`.
- Exchange rate (`balancePerShare`) is programmatically updated on-chain — not reliant on admin oracle updates.
- Contracts use OpenZeppelin AccessControl with MINTER_ROLE, BURNER_ROLE, PAUSER_ROLE, DEFAULT_ADMIN_ROLE. OverseerV1 holds MINTER_ROLE and BURNER_ROLE on stHYPE. The 3-of-5 multisig holds DEFAULT_ADMIN_ROLE.
- **Transparency gaps remain in several areas:**
  - **Validator delegation breakdown**: No public dashboard or on-chain mechanism shows per-validator stake distribution. The [operators page](https://docs.stakedhype.fi/governance/operators) lists operator names (ASXN, B-harvest, HypurrCO, etc.) but publishes no addresses, delegation amounts, or performance metrics.
  - **Queue monitoring**: The only user-facing tool is an estimated withdrawal time at `app.valantis.xyz/staking` ([stake accounts docs](https://docs.stakedhype.fi/technical/stake-accounts)). No real-time queue depth, position, or reserve utilization data is published.
  - **HSM not yet deployed**: The [HSM specification](https://docs.stakedhype.fi/technical/hyperliquid-stake-marketplace-hsm) uses future tense throughout (*"HSM will be natively integrated"*, *"stHYPE will use a governance process"*), indicating the Hyperliquid Stake Marketplace is still a design document, not a live system.
  - **Off-chain operational components**: Reserve management relies on *"active liquidity management from the Protocol Delegator"* and *"coordination with custodians / HIP-3 operators"* ([stake accounts docs](https://docs.stakedhype.fi/technical/stake-accounts)) — off-chain processes with no on-chain enforcement or public monitoring.
  - **1:1 backing unverifiable end-to-end**: The [transparency page](https://docs.stakedhype.fi/info/transparency-and-risks) claims *"stHYPE is always backed 1:1 by native HYPE"*, but no independent verification tool is provided. Users can verify EVM-side state (`totalSupply`, `balancePerShare`) but cannot independently audit the full HyperCore validator delegation breakdown.

## Liquidity Risk

stHYPE exit risk is higher than a pure wrapper token:

- There is an unstaking queue design (not instant native redemption in all conditions).
- Docs disclose a reserve buffer with a [`maxRedeemable()`](https://docs.stakedhype.fi/technical/integrate) function for instant redemptions, a Managed Liquidity Buffer (1M HYPE early-exit threshold, 300k HYPE buffer), and up to a 90-day wind-down horizon for specialized stake accounts in extreme stress conditions.

### DEX Liquidity (per DeFiLlama, February 18, 2026)

**Total DEX liquidity: ~$380K** — extremely thin relative to $124M TVL (0.3% of TVL in DEX pools).

**stHYPE pools:**

| DEX | Pair | TVL | Fee | Vol 7D |
|-----|------|-----|-----|--------|
| HyperSwap V3 | WHYPE-STHYPE | $186,012 | 0.01% | $33,002 |
| HyperSwap V3 | WHYPE-LSTHYPE | $54,172 | 0.3% | $57,978 |

**wstHYPE pools:**

| DEX | Pair | TVL | Fee | Vol 7D |
|-----|------|-----|-----|--------|
| Project X | WSTHYPE-KHYPE | $97,690 | 0.3% | $0 |
| Project X | WHYPE-WSTHYPE | $39,857 | 0.01% | $7,749 |

No stHYPE or wstHYPE pools found on Curve, Laminar, or KittenSwap despite these DEXes being deployed on HyperEVM. **No wstHYPE/USDC or wstHYPE/USDT pairs exist anywhere on HyperEVM** — there is no direct stablecoin exit path via DEX for either token.

### wstHYPE as Lending Collateral

Lending protocols accept **wstHYPE (wrapped stHYPE)**, not native stHYPE, as collateral for borrowing. This is the primary use case for staked HYPE derivatives and the key risk vector, since liquidation of undercollateralized positions depends on available on-chain liquidity.

**Morpho V1** — isolated lending markets, **$44.0M wstHYPE collateral** across 10 active markets:

| Loan Token | LLTV | wstHYPE Collateral | Borrowed | Utilization |
|-----------|------|-------------------|----------|-------------|
| USDC | 77.0% | $35.2M | $8.3M | 100% |
| WHYPE | 86.0% | $5.95M | $4.07M | 90.4% |
| USDH | 77.0% | $1.47M | $493K | 91.3% |
| WHYPE | 86.0% | $744K | $499K | 69.9% |
| USDT0 | 62.5% | $206K | $74K | 90.4% |
| USDT0 | 77.0% | $185K | $120K | 88.0% |
| USDHL | 62.5% | $127K | $45K | 11.4% |
| Others | — | $71K | $47K | — |

**HyperLend** — pooled lending (Aave-fork), **$30.1M wstHYPE** in pool. In pooled model, wstHYPE depositors can borrow any supported asset (WHYPE, USDC, USDT0, etc.). No native stHYPE market exists.

**Felix CDP** — **$1.9M wstHYPE** collateral used to mint feUSD (synthetic dollar).

| Protocol | Type | wstHYPE Collateral | Borrowable Assets | LLTV Range |
|----------|------|-------------------|-------------------|------------|
| Morpho | Isolated markets | $44.0M | USDC, WHYPE, USDH, USDT0, USDe | 62.5%–91.5% |
| HyperLend | Pooled lending | $30.1M | Any pool asset | TBD |
| Felix | CDP | $1.9M | feUSD | TBD |
| **Total** | | **$76.0M** | | |

~60% of stHYPE total supply ($127M) is wrapped and used as lending collateral.

### Liquidation Risk

**On-chain liquidation of wstHYPE collateral positions is effectively broken.** $76M of wstHYPE is used as borrowing collateral, but total wstHYPE DEX liquidity is only ~$138K with zero stablecoin pairs. When a borrower's position becomes undercollateralized, liquidators must acquire and sell wstHYPE — but there is no viable on-chain path to do so efficiently:

1. **No stablecoin exit**: No wstHYPE/USDC or wstHYPE/USDT pools exist. Liquidators must route through HYPE derivatives (wstHYPE → WHYPE → USDC), adding hops and slippage. The largest Morpho market ($35.2M) is borrowing USDC against wstHYPE — liquidators need a wstHYPE-to-USDC path that doesn't exist on-chain.
2. **Negligible DEX depth**: $138K total wstHYPE liquidity cannot absorb liquidations from $76M in collateral. Even a small liquidation event would exhaust available pool depth.
3. **Unwrap delay**: Converting wstHYPE → stHYPE is instant at the contract level, but stHYPE → HYPE requires the 7-day unstaking queue (up to 90 days under stress). Liquidators cannot quickly realize value.
4. **Correlated stress**: In a HYPE price drawdown, both the collateral value (wstHYPE) and exit liquidity (WHYPE pools) decline simultaneously, creating a liquidation spiral risk where falling prices trigger liquidations that cannot be efficiently executed.
5. **High utilization**: Most Morpho wstHYPE markets show 88–100% utilization, meaning positions are heavily leveraged relative to available supply.

This creates a structural fragility: $76M of wstHYPE borrowing collateral against ~$138K of DEX exit liquidity — a **550:1 collateral-to-liquidity ratio**.

### Practical Implications

- In normal conditions, protocol reserves/queue support predictable withdrawals (7-day unstaking).
- **Secondary market exit is severely constrained**: the largest DEX pool is ~$186K with near-zero daily volume. Any meaningful position would need to rely on the protocol's native unstaking queue.
- In stress conditions, exits can be delayed up to 90 days (specialized stake account wind-down) and/or become market-impact sensitive.
- **Lending market liquidations are the primary systemic risk vector** due to the collateral-to-liquidity mismatch described above.

## Centralization & Control Risks

### Governance

StakedHYPE docs describe a planned dual-governance model based on a modified [FraxGovernorOmega](https://github.com/trailofbits/publications/blob/master/reviews/2023-05-fraxgov-securityreview.pdf):
- **Legislative branch**: Multisig composed of Thunderhead team, Valantis team, ecosystem partners, and community members. Proposals are optimistic (succeed by default unless vetoed).
- **Executive branch**: stHYPE token holder veto power over governance proposals.

**Current status: NOT YET IMPLEMENTED.** The [security page](https://docs.stakedhype.fi/technical/security) states: *"This system will go live post Hyperliquid pre-compiles."* The [audits page](https://docs.stakedhype.fi/technical/audits) labels this as *"Governance (not implemented)."*

The current operational model is a **team-controlled multisig** without the documented veto mechanism.

On-chain verified governance data:
- **Multisig address**: [`0x97dee0ea4ca10560f260a0f6f45bdc128a1d51f9`](https://hyperevmscan.io/address/0x97dee0ea4ca10560f260a0f6f45bdc128a1d51f9) (Gnosis Safe on HyperEVM)
- **Threshold**: **3-of-5** (verified via `getThreshold()`)
- **Nonce**: 20 transactions executed
- **Timelock**: No timelock mechanism documented or found on-chain.
- **Signer identities**: Not individually disclosed. Described only as "Thunderhead team, Valantis Team, ecosystem partners."

Risk implications:
- Governance is operationally centralized in current phase with no public timelock or threshold disclosure.
- The planned dual-governance with stHYPE holder veto would be a meaningful improvement, but is not yet live.
- Governance and parameter controls need explicit monitor coverage for role changes and critical parameter updates.

### Programmability

- Hybrid system: smart-contract based staking + operational policy layer for delegation, reserves, and queue management.
- More complex than simple wrappers (WHYPE/WETH).
- Potential sensitivity to off-chain operator execution quality and policy correctness.

### External Dependencies

Critical dependencies include:
1. Hyperliquid L1 consensus/liveness.
2. Hyperliquid validator performance and staking/slashing rules.
3. HSM mechanism assumptions and stake-market behavior.
4. DEX liquidity conditions for stHYPE/HYPE exits.

Dependency concentration on Hyperliquid ecosystem is structurally high.

## Operational Risk

- Docs quality is good and technically detailed.
- Security page and audit disclosures are positive. One co-founder found a [$6M white-hat vulnerability in Curve](https://docs.stakedhype.fi/technical/security), demonstrating security expertise.
- Public bounty program absent. Not listed on Immunefi, Sherlock, Code4rena, or Cantina.
- Team operates as "known anons" via Valantis Labs. Key GitHub contributors identified: Ankit Parashar (0xparashar), Ed (happenwah). Twitter: [@ValantisLabs](https://twitter.com/ValantisLabs).
- Thunderhead Labs (original builder) has operational track record across multiple LST deployments (stFLIP, stELX, stMOVE, tPOKT). The Valantis acquisition adds the AMM/DEX expertise of the Valantis team.
- Team/governance transparency is improving but appears earlier-stage than mature LST incumbents.

## Monitoring

Key contracts to monitor:
- stHYPE Proxy: [`0xfFaa4a3D97fE9107Cef8a3F48c069F577Ff76cC1`](https://hyperevmscan.io/address/0xfFaa4a3D97fE9107Cef8a3F48c069F577Ff76cC1)
- OverseerV1 Proxy: [`0xB96f07367e69e86d6e9C3F29215885104813eeAE`](https://hyperevmscan.io/address/0xB96f07367e69e86d6e9C3F29215885104813eeAE)
- wstHYPE Proxy: [`0x94e8396e0869c9F2200760aF0621aFd240E1CF38`](https://hyperevmscan.io/address/0x94e8396e0869c9F2200760aF0621aFd240E1CF38)
- Governance Multisig: [`0x97dee0ea4ca10560f260a0f6f45bdc128a1d51f9`](https://hyperevmscan.io/address/0x97dee0ea4ca10560f260a0f6f45bdc128a1d51f9) (Gnosis Safe 3-of-5)

### 1. Governance Monitoring (MANDATORY)

Monitor all privileged role actions and parameter changes for:
- RoleGranted / RoleRevoked events on stHYPE and OverseerV1 (AccessControl)
- queue limits and withdrawal controls
- reserve/buffer parameters
- delegation strategy controls
- Upgraded events on proxy contracts (implementation changes)

Alert immediately on:
- ownership/multisig signer changes (AddedOwner/RemovedOwner on Safe)
- threshold changes (ChangedThreshold on Safe)
- implementation upgrades (Upgraded event on proxy)
- emergency pause activations

### 2. Backing & Solvency Monitoring (MANDATORY)

Track:
- total stHYPE supply
- estimated total managed HYPE (staked + liquid reserve)
- backing ratio trend
- validator concentration and large delegation shifts

Alert thresholds:
- backing ratio deterioration >1% in 24h (without expected event)
- single validator concentration >25%

### 3. Queue & Exit Monitoring (MANDATORY)

Track:
- queue size and age distribution
- realized withdrawal times
- reserve utilization rate

Alert thresholds:
- median queue delay > target SLA for 24h+
- reserve buffer utilization >80% sustained
- abrupt increase in queued exits (>20% day-over-day)

### 4. Market Liquidity Monitoring

Track:
- stHYPE/HYPE and stHYPE/stable pool depth
- slippage for representative sizes
- depeg vs implied fair value

Alert thresholds:
- >2% sustained discount vs implied NAV proxy
- pool depth drop >40% day-over-day

### 5. Hyperliquid Base Risk Monitoring

Track official Hyperliquid staking/validator announcements for:
- validator jailing incidents
- any governance activation of validator slashing
- validator instability
- staking parameter changes
- chain liveness incidents

## Risk Summary

### Key Strengths

1. Clear product-market fit: native HYPE liquid staking primitive.
2. Public audit trail with multiple firms and multiple rounds.
3. Detailed technical docs for HSM and unstaking mechanics.
4. On-chain staking economics rather than off-chain custodial backing.

### Key Risks

1. Queue-based exits and stress-path wind-down mechanics introduce liquidity delay risk.
2. Meaningful governance/parameter control centralization in current phase.
3. Strong dependency on Hyperliquid validator and chain-level risk.
4. Slashing regime may change via governance (currently no automatic validator slashing in base staking).
5. No public bug bounty program identified.

### Critical Risks

- No immediate critical gate failure found from available public docs.
- Highest tail risk is correlated Hyperliquid chain/validator stress causing both backing and liquidity pressure simultaneously.

---

## Risk Score Assessment

### Critical Risk Gates

- [x] **No audit** -- PASS (4 audits disclosed)
- [x] **Unverifiable reserves** -- PASS (on-chain staking model, though monitoring visibility still maturing)
- [x] **Total centralization** -- PASS (not single-EOA only, but governance remains relatively concentrated)

### Category Scores

#### Category 1: Audits & Historical Track Record (Weight: 20%)

- 4 disclosed audits across Feb 2025-Nov 2025 (Three Sigma, Pashov x2, Guardian). Governance audit via Trail of Bits (inherited FraxGov).
- No bug bounty program on any major platform.
- ~8 months in production, TVL ~$124M (peaked ~$544M).
- Per rubric: 3+ audits -> score 1-2 range for audits, but no bug bounty -> cannot reach score 1. Production time 6-12 months with TVL >$100M fits score 3 for track record.

**Score: 2.5/5**

#### Category 2: Centralization & Control Risks (Weight: 30%)

Subscores:
- Governance: **4.0** — 3-of-5 multisig (verified on-chain), no timelock, signer identities undisclosed, planned governance system not yet implemented. Per rubric: "Multisig 3/5 or low threshold" + "No timelock" + "Powerful admin roles with limited constraints" = score 4.
- Programmability: **3.0** — Hybrid on-chain/off-chain. Exchange rate is on-chain (`balancePerShare`), but validator delegation strategy requires off-chain operational decisions. OverseerV1 has MINTER_ROLE and BURNER_ROLE over stHYPE.
- External dependencies: **4.0** — Critical single-ecosystem dependency on Hyperliquid L1 (consensus, validator performance, staking rules). Failure of Hyperliquid would break the entire protocol.

Centralization score = (4.0 + 3.0 + 4.0) / 3 = **3.67**

**Score: 3.67/5**

#### Category 3: Funds Management (Weight: 30%)

Subscores:
- Collateralization: **2.5** — 100% on-chain collateral (staked HYPE), but not over-collateralized. Liquid reserve only 6.0% of total backing. Collateral quality = single-asset (HYPE), not blue-chip.
- Provability: **2.0** — Key state readable on-chain (`totalSupply`, `balancePerShare`, `maxRedeemable`, `totalShares`). Exchange rate updated programmatically. AccessControl roles verified. Some off-chain complexity around validator delegation not fully transparent.

Funds management score = (2.5 + 2.0) / 2 = **2.25**

**Score: 2.25/5**

#### Category 4: Liquidity Risk (Weight: 15%)

- Queue-based withdrawals: 7-day standard unstaking, up to 90-day for specialized stake account wind-down.
- DEX liquidity is extremely thin: ~$380K total across all stHYPE/wstHYPE pools (0.3% of $124M TVL). Largest single pool ~$186K with near-zero daily volume.
- `maxRedeemable()` returned 0 at time of check — no instant redemption buffer available.
- Protocol unstaking queue is the primary exit mechanism, not secondary market trading.
- ~$77M of wstHYPE used as lending collateral (HyperLend, Morpho, Felix) against only ~$138K wstHYPE DEX liquidity and zero stablecoin pairs. Liquidations are effectively unexecutable on-chain.
- Per rubric: "Withdrawal queues or restrictions" + "<$1M DEX liquidity" + ">1 week potential exit time" = score 4. Current DEX liquidity ($380K) with near-zero daily trading volume ($13/day avg) means secondary market exits are effectively unavailable for any meaningful position size. The protocol unstaking queue (7+ days, up to 90 days under stress) is the only realistic exit path.

**Score: 4.0/5**

#### Category 5: Operational Risk (Weight: 5%)

- Good docs and audits.
- No public bounty; governance and transparency still maturing.

**Score: 3.0/5**

### Final Score Calculation

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Audits & Historical | 2.5 | 20% | 0.50 |
| Centralization & Control | 3.67 | 30% | 1.10 |
| Funds Management | 2.25 | 30% | 0.68 |
| Liquidity Risk | 4.0 | 15% | 0.60 |
| Operational Risk | 3.0 | 5% | 0.15 |
| **Final Score** | | | **3.03 / 5.0** |

## Overall Risk Score: **3.0 / 5.0**

### Risk Tier: **MEDIUM RISK**

Rationale:
- stHYPE is materially more complex/risk-bearing than WHYPE due to delegated staking, queue exits, and governance parameter controls.
- Audit coverage is decent (4 audits from reputable firms), but no bug bounty.
- Governance is centralized: 3-of-5 multisig with no timelock, planned dual-governance not yet implemented.
- DEX liquidity is extremely thin ($380K vs $124M TVL); primary exit is via protocol unstaking queue (7+ days). ~$77M wstHYPE lending collateral with no stablecoin DEX pairs creates structural liquidation risk.
- Strong single-ecosystem dependency on Hyperliquid L1.
- Partially offset by: on-chain verifiable backing, programmatic exchange rate, Thunderhead's multi-LST track record, no incidents to date.

## Reassessment Triggers

1. Any governance architecture upgrade (SAFE/timelock/token governance rollout).
2. Material changes to unstake queue logic, reserve policy, or `maxRedeemable()` buffer parameters.
3. Any Hyperliquid validator jailing wave or governance rollout of validator slashing.
4. Any stHYPE discount >3% sustained for >24h.
5. Any incident disclosure by StakedHYPE or Hyperliquid affecting staking settlement.
6. Release of new audits or public bug bounty program.

## Sources

- StakedHYPE docs home: https://docs.stakedhype.fi/
- HSM technical docs: https://docs.stakedhype.fi/technical/hyperliquid-stake-marketplace-hsm
- Stake Accounts & Architecture: https://docs.stakedhype.fi/technical/stake-accounts
- Integration (mint/burn/unstaking): https://docs.stakedhype.fi/technical/integrate
- Transparency & Risks: https://docs.stakedhype.fi/info/transparency-and-risks
- Contract Addresses: https://docs.stakedhype.fi/technical/contract-addresses
- Audits page: https://docs.stakedhype.fi/technical/audits
- StakedHYPE governance: https://docs.stakedhype.fi/governance
- StakedHYPE operators: https://docs.stakedhype.fi/governance/operators
- StakedHYPE security: https://docs.stakedhype.fi/technical/security
- wstHYPE docs: https://docs.stakedhype.fi/technical/wsthype
- ValantisLabs audit repo: https://github.com/ValantisLabs/audits
- Thunderhead Labs audit repo: https://github.com/thunderhead-labs/audits
- Three Sigma Feb 2025 audit: https://github.com/ValantisLabs/audits/blob/main/Three_Sigma_Feb_25.pdf
- Pashov Oct 2025 audit: https://github.com/ValantisLabs/audits/blob/main/pashov_oct_25.pdf
- Pashov Nov 2025 audit: https://github.com/ValantisLabs/audits/blob/main/pashov_nov_2025.pdf
- Guardian Nov 2025 audit: https://github.com/ValantisLabs/audits/blob/main/guardian_nov_2025.pdf
- Trail of Bits FraxGov audit (governance basis): https://github.com/trailofbits/publications/blob/master/reviews/2023-05-fraxgov-securityreview.pdf
- DeFiLlama StakedHYPE: https://defillama.com/protocol/stakedhype
- Hyperliquid staking docs: https://hyperliquid.gitbook.io/hyperliquid-docs/hype-staking
- Hyperliquid validators docs: https://hyperliquid.gitbook.io/hyperliquid-docs/hype-staking/validators
- Hyperliquid risks docs: https://hyperliquid.gitbook.io/hyperliquid-docs/risks
- ASXN HyperScreener (LST data): https://hyperscreener.asxn.xyz/liquid-staking

## Appendix: HyperEVM Liquid Staking Market Share

Source: [ASXN HyperScreener](https://hyperscreener.asxn.xyz/liquid-staking) — February 18, 2026

| Token | Supply | Supply USD | Market Share |
|-------|--------|-----------|-------------|
| kHYPE | 21.79M | $661.46M | 77.67% |
| stHYPE | 4.19M | $127.20M | 14.94% |
| vHYPE | 1.04M | $31.72M | 3.72% |
| iHYPE | 499.68K | $15.17M | 1.78% |
| beHYPE | 484.88K | $14.72M | 1.73% |
| mHYPE | 37.06K | $1.13M | 0.13% |
| HYPED | 6.52K | $197.91K | 0.02% |
| sHYPE | 2.03K | $61.67K | 0.01% |

**Total LST market: ~$851M.** stHYPE is the second-largest LST on HyperEVM at 14.94% market share, behind kHYPE (77.67%). Notably, ~61% of stHYPE supply ($77.9M) is deposited in lending protocols as wstHYPE collateral, indicating high utilization concentration in a single use case.
