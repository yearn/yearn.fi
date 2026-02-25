# Protocol Risk Assessment: Strata

- **Assessment Date:** February 18, 2026
- **Token:** srUSDe (Senior Tranche USDe)
- **Chain:** Ethereum
- **Token Address:** [`0x3d7d6fdf07EE548B939A80edbc9B2256d0cdc003`](https://etherscan.io/address/0x3d7d6fdf07EE548B939A80edbc9B2256d0cdc003)
- **Final Score: 2.8/5.0**

## Overview + Links

Strata is a generalized risk-tranching protocol that splits yield from underlying strategies into two tokenized tranches with distinct risk-reward profiles:

- **Senior Tranche (srUSDe)**: Over-collateralized, yield-bearing synthetic dollar. Designed for capital preservation with a stable yield floored at a benchmark rate, uncapped upside participation in underlying yield, and first-loss protection from the junior tranche.
- **Junior Tranche (jrUSDe)**: Provides leveraged upside to the underlying yield, absorbing yield volatility and associated risks in exchange for potentially higher returns.

**srUSDe** is an ERC-4626 Meta Vault that accepts deposits of USDe, sUSDe, USDT, USDC, and DAI. All deposited assets are routed through the StrataCDO orchestrator into Ethena's sUSDe vault via the sUSDeStrategy. Yield is distributed between senior and junior tranches using a Dynamic Yield Split (DYS) mechanism that references:
- The underlying sUSDe APY
- A benchmark rate (supply-weighted average of USDC/USDT lending rates on Aave v3 Core)
- The relative TVL distribution between the two tranches
- Risk-premium parameters set by the team (planned to transition to independent risk managers)

The senior tranche always earns at minimum the benchmark rate (floored), with upside participation. In extreme scenarios where junior liquidity is depleted and the underlying APY is below the benchmark rate, the senior tranche simply earns the underlying APY. If the junior tranche is fully depleted, **senior tranche may incur principal losses**.

**Yield source**: Ethena's sUSDe yield (delta-neutral basis trade on ETH/BTC), redistributed via Strata's DYS mechanism.

**Key metrics (Feb 18, 2026):**
- Protocol TVL: ~$153.6M (DeFiLlama)
- Peak TVL: ~$326M (December 2025)
- Chain: Ethereum only

**Yearn use cases per issue #47:**
1. Deposit into senior vault srUSDe as part of a strategy
2. Use srUSDe as collateral on Morpho for srUSDe/USDC markets where srUSDe is collateral and USDC is the loan token (minimal price change exposure)

**Links:**

- [Protocol Documentation](https://docs.strata.markets/)
- [Protocol App](https://app.strata.money)
- [Mechanism Overview](https://docs.strata.markets/protocol-mechanism/mechanism-overview)
- [Technical Overview](https://docs.strata.markets/technical-documentation/protocol-overview)
- [Contract Details](https://docs.strata.markets/technical-documentation/contracts-details)
- [Roles & Permissions](https://docs.strata.markets/technical-documentation/roles-and-permissions)
- [Audits](https://docs.strata.markets/technical-documentation/audits)
- [Risks & Mitigations](https://docs.strata.markets/protocol-mechanism/risks-and-mitigations)
- [DeFiLlama](https://defillama.com/protocol/strata)
- [GitHub](https://github.com/Strata-Money/contracts-tranches)
- [Twitter/X](https://twitter.com/strata_markets)

## Contract Addresses

### Core Ethena USDe Market Contracts (Ethereum)

| Contract | Address | Type |
|----------|---------|------|
| srUSDe (Senior Tranche) | [`0x3d7d6fdf07EE548B939A80edbc9B2256d0cdc003`](https://etherscan.io/address/0x3d7d6fdf07EE548B939A80edbc9B2256d0cdc003) | ERC-4626 Meta Vault, Upgradeable Proxy |
| jrUSDe (Junior Tranche) | [`0xC58D044404d8B14e953C115E67823784dEA53d8F`](https://etherscan.io/address/0xC58D044404d8B14e953C115E67823784dEA53d8F) | ERC-4626 Vault, Upgradeable Proxy |
| StrataCDO | [`0x908B3921aaE4fC17191D382BB61020f2Ee6C0e20`](https://etherscan.io/address/0x908B3921aaE4fC17191D382BB61020f2Ee6C0e20) | Core Orchestrator, Upgradeable Proxy |
| Accounting | [`0xa436c5Dd1Ba62c55D112C10cd10E988bb3355102`](https://etherscan.io/address/0xa436c5Dd1Ba62c55D112C10cd10E988bb3355102) | TVL calculations, fee accrual |
| sUSDeStrategy | [`0xdbf4FB6C310C1C85D0b41B5DbCA06096F2E7099F`](https://etherscan.io/address/0xdbf4FB6C310C1C85D0b41B5DbCA06096F2E7099F) | Deposits into Ethena sUSDe Vault |
| ERC20Cooldown | [`0xd6dAD17d025cDdDEd27305aEbAB8b277996A6fAF`](https://etherscan.io/address/0xd6dAD17d025cDdDEd27305aEbAB8b277996A6fAF) | Token lockup for cooldown period |
| UnstakeCooldown | [`0x735edDF50Ca2371aa48466469C742e684c610F74`](https://etherscan.io/address/0x735edDF50Ca2371aa48466469C742e684c610F74) | sUSDe unstaking cooldown |
| SUSDeCooldownRequestImpl | [`0x00A96056c30A22b684fF7a09F4A0AfEaE426dde2`](https://etherscan.io/address/0x00A96056c30A22b684fF7a09F4A0AfEaE426dde2) | Cooldown workflow for sUSDe |
| TrancheDepositor | [`0x50E850641F43F65BF8fB3a7d0CF082a1D252F47e`](https://etherscan.io/address/0x50E850641F43F65BF8fB3a7d0CF082a1D252F47e) | Routes deposits into tranches |
| AprPairFeed | [`0x2bb416614D740E5313aA64A0E3e419B39e800EC2`](https://etherscan.io/address/0x2bb416614D740E5313aA64A0E3e419B39e800EC2) | Benchmark & Collateral APY inputs |
| AaveAprPairProvider | [`0x1c137776e04803F807616c382AbBA12d9BF0AF73`](https://etherscan.io/address/0x1c137776e04803F807616c382AbBA12d9BF0AF73) | Fetches APR values from Aave |
| AccessControlManager | [`0x1d19E18ECaC4ef332a0d5d6Aa3a0f0f772605f60`](https://etherscan.io/address/0x1d19E18ECaC4ef332a0d5d6Aa3a0f0f772605f60) | Role-based access control |
| TwoStepConfigManager | [`0x0f93bAC77c3dDD1341d3Ecc388c5F8A180818994`](https://etherscan.io/address/0x0f93bAC77c3dDD1341d3Ecc388c5F8A180818994) | Two-step exit-fee governance |

### Governance & Multisig Contracts

| Contract | Address | Configuration |
|----------|---------|---------------|
| Admin Multisig | [`0xA27cA9292268ee0f0258B749f1D5740c9Bb68B50`](https://etherscan.io/address/0xA27cA9292268ee0f0258B749f1D5740c9Bb68B50) | 3-of-4 Gnosis Safe, cold wallets, internal team + founding contributors |
| Operational Multisig | [`0x4be3749a0F6557b8fd98F3967e859DbD7C694eF4`](https://etherscan.io/address/0x4be3749a0F6557b8fd98F3967e859DbD7C694eF4) | 2-of-3 Gnosis Safe, internal team |
| Timelock (48h) | [`0xb2A3CF69C97AFD4dE7882E5fEE120e4efC77B706`](https://etherscan.io/address/0xb2A3CF69C97AFD4dE7882E5fEE120e4efC77B706) | Proposer: Admin Multisig. Canceller: Guardian |
| Timelock (24h) | [`0x4f2682b78F37910704fB1AFF29358A1da07E022d`](https://etherscan.io/address/0x4f2682b78F37910704fB1AFF29358A1da07E022d) | Strategy config changes |
| Guardian | [`0x277D26a45Add5775F21256159F089769892CEa5B`](https://etherscan.io/address/0x277D26a45Add5775F21256159F089769892CEa5B) | Patrick Collins (Cyfrin CEO) -- can cancel timelock transactions |

### Proxy Infrastructure

| Contract | ProxyAdmin |
|----------|-----------|
| StrataCDO | [`0xcAb791D0D44eBaC17378fF2AF6356c012F15c9e6`](https://etherscan.io/address/0xcAb791D0D44eBaC17378fF2AF6356c012F15c9e6) |
| ERC20Cooldown | [`0xeD6c7b379F73DF0618406d263b13b2386E398166`](https://etherscan.io/address/0xeD6c7b379F73DF0618406d263b13b2386E398166) |

### On-Chain Verification (Etherscan, Feb 18, 2026)

All core contracts are **verified on Etherscan**:

| Contract | Etherscan Name | Verified | Proxy |
|----------|---------------|----------|-------|
| srUSDe | TransparentUpgradeableProxy → Tranche (impl) | Yes | Yes |
| jrUSDe | TransparentUpgradeableProxy | Yes | Yes |
| StrataCDO | TransparentUpgradeableProxy → StrataCDO (impl) | Yes | Yes |
| sUSDeStrategy | TransparentUpgradeableProxy | Yes | Yes |
| Accounting | TransparentUpgradeableProxy | Yes | Yes |
| AccessControlManager | AccessControlManager | Yes | No |
| Admin Multisig | GnosisSafeProxy | Yes | Yes |
| Operational Multisig | SafeProxy | Yes | Yes |
| 48h Timelock | StrataMasterChef (OZ TimelockController) | Yes | No |
| 24h Timelock | StrataMasterChef (OZ TimelockController) | Yes | No |
| Guardian | EOA (not a contract) | N/A | N/A |

**Note**: Both timelocks are registered on Etherscan as `StrataMasterChef` but contain standard OpenZeppelin TimelockController functions (`schedule`, `execute`, `cancel`, `getMinDelay`). Delays verified on-chain: 48h = 172,800 seconds, 24h = 86,400 seconds.

## Audits and Due Diligence Disclosures

Strata has completed an extensive, multi-phased audit process with 3 reputable firms across at least 7 distinct audit engagements:

### Audit History

| # | Firm | Date | Scope | C | H | M | L | Info | Report |
|---|------|------|-------|---|---|---|---|------|--------|
| 1 | **Cyfrin** | Oct 8, 2025 | Protocol v1 (Tranches) | 1 | 2 | 6 | 5 | 12 | [PDF](https://github.com/Cyfrin/cyfrin-audit-reports/blob/main/reports/2025-10-08-cyfrin-strata-tranches-v2.0.pdf) |
| 2 | **Guardian Audits** | Oct 10, 2025 | Protocol v1 (Tranches) | 1 | 5 | 14 | 5 | 8 | [PDF](https://github.com/GuardianAudits/Audits/blob/main/Strata/Strata_Tranches_report.pdf) |
| 3 | **Quantstamp** | ~Q4 2025 | Protocol v1 (Tranches) | - | - | - | - | - | [Certificate](https://certificate.quantstamp.com/full/strata-tranches/3c3a4037-2a92-468c-a4f3-5ea498e7b539/index.html) |
| 4 | **Quantstamp** | ~Q4 2025 | Redemption Fee (Update to Tranches) | - | - | - | - | - | [Certificate](https://certificate.quantstamp.com/full/strata-update-to-tranches/d7a903b7-80cf-42db-8433-79186fdd8be2/index.html) |
| 5 | **Cyfrin** | Jan 23, 2026 | Shares Cooldown mechanism | 0 | 0 | 6 | 3 | 10 | [PDF](https://github.com/Cyfrin/cyfrin-audit-reports/blob/main/reports/2026-01-23-cyfrin-strata-shares-cooldown-v2.0.pdf) |
| 6 | **Cyfrin** | Jun 11, 2025 | Pre-Deposit Vaults | 1 | 1 | 3 | 16 | 9 | [PDF](https://github.com/Cyfrin/cyfrin-audit-reports/blob/main/reports/2025-06-11-cyfrin-strata-predeposit-v2.1.pdf) |
| 7 | **Quantstamp** | ~2025 | Pre-Deposit Vaults | - | - | - | - | - | [Papermark](https://www.papermark.com/view/cmgm9op9b0003l404g395i6a5) |

*Quantstamp reports hosted on JS-rendered platforms; finding counts require browser access. Dashes indicate data not programmatically extractable.*

**Total findings across Cyfrin + Guardian reports: 3 Critical, 8 High, 29 Medium, 29 Low (all resolved).**

Notable Critical/High findings (all resolved):
- **C: Withdrawers of sUSDe always incur a loss** (Cyfrin #1) -- Inverted parameters in `Tranche::_withdraw` caused users to receive significantly less than entitled
- **C: Reserve withdrawal unit mismatch** (Guardian #2) -- `StrataCDO.reduceReserve` forwarded incorrect amounts, breaking internal accounting
- **C: Attacker can drain entire protocol sUSDe balance** (Cyfrin #6) -- Incorrect redemption accounting in pre-deposit vault could drain funds
- **H: Withdrawal active requests DoS** (Cyfrin #1, Guardian #2) -- Spam tiny withdrawal requests on behalf of another user causing out-of-gas during finalization
- **H: MEV APR front-run** (Guardian #2) -- Front-running of APR changes via `onAprChanged`
- **H: JR tranche bankrun susceptibility** (Cyfrin #5) -- SharesCooldown finalization bypassed `minimumJrtSrtRatio`

Guardian Audits recommended an independent follow-up review after finding 1 Critical + 5 High issues, which was conducted by Quantstamp.

### On-Chain Complexity

The architecture is moderately complex:
- **CDO Pattern**: Core orchestrator (StrataCDO) connects tranches, accounting, and strategy contracts
- **Multiple Proxy Contracts**: Most core contracts use OpenZeppelin TransparentUpgradeableProxy
- **Cooldown Mechanisms**: Two-stage withdrawal with ERC20Cooldown and UnstakeCooldown contracts
- **APR Feed System**: On-chain APR calculation using Aave data feeds
- **Multi-token deposits**: The srUSDe Meta Vault accepts USDe, sUSDe, USDT, USDC, and DAI

### Bug Bounty

**No active bug bounty program found.** Exhaustive search across Immunefi, Code4rena, Sherlock, HackerOne, Safe Harbor, and the protocol's own documentation and GitHub yielded no bug bounty listing, responsible disclosure policy, or security contact for vulnerability reporting. The [security documentation](https://docs.strata.markets/technical-documentation/security) covers audits, multisigs, and monitoring but does not mention a bug bounty. This is a notable gap for a protocol with >$150M TVL.

## Historical Track Record

- **Time in Production**: srUSDe proxy deployed October 2, 2025 (block [23492392](https://etherscan.io/tx/0x857c511cb166160e9b9acdb8ef47d9306ad5bcef1a311e845b4a2d4b90ea1f6b)). In production for **~4.5 months** as of February 2026. Pre-deposit vaults with TVL existed from July 2025 (~7 months with TVL).
- **GitHub Repository**: Created September 16, 2025. Public, Solidity-based, actively maintained (last update Feb 17, 2026).
- **TVL History**:

| Period | TVL | Notes |
|--------|-----|-------|
| Jul 2025 | ~$18M | Pre-deposit vaults / soft launch |
| Aug 2025 | $18M - $53M | Steady growth |
| Sep 2025 | $53M - $105M | Rapid growth |
| Oct 13, 2025 | ~$110M | Official launch on Ethena USDe |
| Nov 2025 | $110M - $258M | Strong growth phase |
| Dec 5-8, 2025 | **~$326M** | **Peak TVL** |
| Dec 20-31, 2025 | $326M → $262M | Moderate decline |
| Jan 8-14, 2026 | $230M → $147M | **Sharp drop** (~$83M outflow in ~1 week) |
| Jan 17, 2026 | **~$122M** | **Deepest drawdown** (62.6% below peak) |
| Feb 1-10, 2026 | $152M → $233M | Recovery |
| Feb 18, 2026 | ~$153M | Current (53% below ATH) |

- **TVL Volatility**: The protocol has experienced significant TVL swings. The sharp January drop (from ~$262M to ~$147M in one week) suggests **large depositor concentration risk**. The TVL remains volatile with multiple >20% swings.
- **Incidents**: No reported security incidents, exploits, or hacks found.
- **Exchange Rate (on-chain verified Feb 18, 2026)**:
  - `convertToAssets(1e18)` = 1.013728 USDe per srUSDe
  - `totalAssets()` = 113,838,466 USDe
  - `totalSupply()` = 112,296,907 srUSDe
  - As an ERC-4626 vault, the exchange rate should only increase (denominated in underlying). The current 1.37% appreciation over ~4.5 months implies ~3.7% annualized yield to the senior tranche.

## Funds Management

### Deposit/Withdrawal Flow

**Deposit**: Users deposit USDe (or sUSDe, USDT, USDC, DAI) into the srUSDe Meta Vault. Deposited assets are exchanged for shares proportional to the current exchange rate and passed to the sUSDeStrategy, which stakes them into Ethena's sUSDe vault.

**Withdrawal**: Uses a multi-stage cooldown mechanism:
1. **ERC20Cooldown**: Strategy locks tokens in a cooldown contract for a specified period
2. **UnstakeCooldown**: For sUSDe, triggers Ethena's own sUSDe cooldown (currently 7 days)
3. Each withdrawal request is handled independently per user; new requests do not extend or affect earlier requests
4. After the cooldown period, tokens can be finalized/withdrawn

### Accessibility

- **Deposits**: Permissionless. Anyone can deposit USDe, sUSDe, USDT, USDC, or DAI
- **Redemptions**: Permissionless but subject to cooldown periods tied to Ethena's sUSDe unstaking
- **Atomic operations**: Deposits are single-transaction. Withdrawals require initiation + cooldown + finalization
- **Fees**: Performance fees and redemption fees apply (transparent, visible on the app). Exit-fee changes governed by a two-step process via TwoStepConfigManager

### Collateralization

- **Backing**: srUSDe is backed by the underlying USDe/sUSDe staked in Ethena's vault, with additional over-collateralization from the junior tranche (jrUSDe) which serves as first-loss capital
- **Senior coverage ratio**: When it falls below **105%**, the protocol may temporarily halt senior minting and junior redemptions to protect the senior tranche
- **Underlying collateral**: USDe is Ethena's synthetic dollar backed by a delta-neutral strategy (ETH/BTC spot + short perpetual futures). Ethena maintains proof of reserves via third-party verification
- **Risk hierarchy**: Senior tranche (srUSDe) is principal-protected in the base asset and paid first. The junior tranche absorbs losses before any impact to senior holders. However, if the junior tranche is **fully depleted**, the senior tranche **may incur principal losses**
- **Reserve mechanism**: Part of strategy gains can be allocated to a protocol reserve (configurable via `setReserveBps`), which can be redistributed to tranche TVL or withdrawn to treasury

### Provability

- **Exchange rate**: Calculated on-chain via ERC-4626 standard (`convertToAssets()`/`convertToShares()`). Anyone can verify
- **Underlying sUSDe balance**: Verifiable on-chain by checking the strategy's sUSDe holdings
- **Yield calculation**: DYS mechanism computes yields on-chain using the AprPairFeed contract. Benchmark rate sourced from Aave v3 Core. However, risk-premium parameters (x, y, k) are set by the team
- **Accounting**: On-chain Accounting contract tracks raw TVL, balances, inflows/outflows, fees, and reward distribution for both tranches

## Liquidity Risk

### Primary Exit Mechanisms

1. **Redeem from srUSDe vault**: Initiate withdrawal → cooldown period (tied to Ethena's sUSDe cooldown, currently ~7 days) → finalize. Permissionless but not instant
2. **DEX swap**: Extremely thin on-chain DEX liquidity. Total across all Uniswap V4 pools: ~$135K. Largest pool is srUSDe/USDe at ~$81K with only $425 in 24h volume. **No Curve or Balancer pools exist.** CoinGecko does not list srUSDe
3. **Pendle markets**: PT-srUSDe-02APR2026 pool holds ~$21.9M TVL with ~$128K weekly volume. Primary venue for srUSDe trading, but these are fixed-yield PT tokens, not raw srUSDe
4. **Morpho markets**: PT-srUSDe-2APR2026/USDC market has ~$14.6M supply and 82.4% utilization. A raw srUSDe/USDe market exists on Morpho but is empty ($0 supply/$0 borrow)

### Withdrawal Restrictions

- **Cooldown period**: Withdrawals require a cooldown period linked to Ethena's sUSDe unstaking (~7 days). Not instant
- **Coverage protection**: When senior coverage ratio falls below 105%, senior minting and junior redemptions are suspended. This protects senior tranche but could trap capital in extreme scenarios
- **Self-balancing**: The coverage mechanism is designed to be self-balancing -- thinner junior coverage attracts more liquidity via higher junior yields

### Liquidity Assessment

- **Primary liquidity**: The main exit path is through the cooldown-based redemption mechanism (not instant)
- **Secondary market**: DEX liquidity is negligible (~$135K total across Uniswap V4 pools). Pendle PT-srUSDe markets (~$21.9M) are the most liquid venue but trade fixed-yield PTs, not raw srUSDe. Morpho lending markets hold ~$14.6M in PT-srUSDe collateral
- **Large holder impact**: Given the TVL volatility (62.6% drawdown from peak), large holders can exit but it takes time due to cooldowns
- **Same-value redemption**: srUSDe redeems for USDe (stablecoin-denominated), so price impact risk is minimal for the Morpho use case

## Centralization & Control Risks

### Governance

Strata uses a layered Role-Based Access Control (RBAC) system with clear separation between operational, administrative, and owner functions:

| Role | Callable By | Description | Key Functions |
|------|-------------|-------------|---------------|
| PAUSER_ROLE | Admin Multisig (3/4) | Pause/resume deposits and redemptions | `setActionStates`, `setJrtShortfallPausePrice` |
| UPDATER_FEED_ROLE | Operational Multisig (2/3) | Trigger APR refresh and recalculation | `onAprChanged`, `updateRoundData` |
| UPDATER_STRAT_CONFIG_ROLE | 24h Timelock | Update strategy risk parameters and cooldowns | `setRiskParameters`, `setCooldowns` |
| RESERVE_MANAGER_ROLE | Admin Multisig (3/4) | Redistribute reserves or withdraw to treasury | `reduceReserve`, `distributeReserve`, `setReserveTreasury` |
| PROPOSER_CONFIG_ROLE | Admin Multisig (3/4) | Propose exit-fee configuration changes | `scheduleExitFeeChange` |
| OWNER_ROLE | 48h Timelock | High-level protocol configuration | `setAprPairFeed`, `setReserveBps`, `setFeeRetentionBps`, `setMinimumJrtSrtRatio`, `setImplementations`, `setProvider` |

**Multisig Details:**
- **Admin Multisig**: 3-of-4 Gnosis Safe. All signers use cold wallets. Keys held by internal team members and founding core contributors. At least 3 signers must validate transaction hashes match
- **Operational Multisig**: 2-of-3 Gnosis Safe. All keys held by internal team members
- **Timelocks**: 48h for owner-level changes (proxy upgrades, core config), 24h for strategy config changes
- **Guardian**: Patrick Collins (Co-Founder & CEO of Cyfrin, well-known security researcher). Can cancel timelock transactions before execution. Monitors queued transactions using Hypernative and custom tools

**Key concerns:**
- Admin Multisig is only 3-of-4 (relatively low threshold)
- Operational Multisig is only 2-of-3 (low threshold)
- All multisig keys held by internal team -- no external/independent signers
- Admin Multisig can pause the protocol immediately (no timelock on pause)
- RESERVE_MANAGER_ROLE (Admin Multisig) can transfer reserves to treasury -- potential extraction vector if compromised
- No on-chain governance yet (planned for future)

### Programmability

- **srUSDe exchange rate**: Calculated on-chain via ERC-4626 standard. Programmatic, no admin input needed
- **Yield distribution (DYS)**: Mostly programmatic. AprPairFeed fetches benchmark rate from Aave on-chain. However, risk-premium parameters (x, y, k) are set by the team initially
- **APR updates**: Triggered by Operational Multisig via `updateRoundData`. This is a manual trigger for an on-chain computation
- **Accounting**: Fully on-chain. TVL, balances, fees, and reward distribution tracked programmatically
- **Withdrawals**: Programmatic cooldown mechanism. No manual intervention needed after initiation

### External Dependencies

| Dependency | Type | Criticality | Impact of Failure |
|------------|------|-------------|-------------------|
| **Ethena (sUSDe/USDe)** | Yield source & collateral | **Critical** | All deposited assets staked in Ethena's sUSDe vault. Ethena insolvency, USDe depegging, or sUSDe exploit would directly impact srUSDe. Senior tranche principal at risk if junior tranche is depleted |
| **Aave v3 Core** | Benchmark rate oracle | **High** | Supply-weighted average of USDC/USDT lending rates used for benchmark. Failure could distort yield calculations and tranche distributions |
| **Gnosis Safe** | Multisig infrastructure | **High** | All governance actions flow through Safe multisigs |
| **Hypernative** | Monitoring & alerting | **Medium** | 24/7 contract monitoring. Not critical for operations but important for security |
| **Ethereum L1** | Settlement layer | **High** | All contracts deployed on Ethereum mainnet only |

**Key dependency risk**: Strata has a **single critical yield source dependency** on Ethena/sUSDe. The benchmark rate relies on a **single data source** (Aave v3 Core). No documented fallback mechanisms if Ethena or Aave dependencies fail. The AprPairFeed has a `setRoundStaleAfter` parameter suggesting some staleness detection.

## Operational Risk

- **Team Transparency**: Founding team is **not publicly named** in documentation. Operational team members are not publicly identified. The only publicly named individual is **Patrick Collins** (Cyfrin CEO), who serves as Guardian (security oversight role, not management). Team is classified as **partially anonymous** -- known anons at best
- **Documentation**: Good quality. Comprehensive docs at docs.strata.markets covering mechanism, technical architecture, contracts, roles, and risks. Actively maintained (last updated Feb 14, 2026)
- **Legal Structure**: **Frontera Labs, Inc.**, a Delaware (USA) corporation, operates the Interface (front-end) only. The company explicitly disclaims ownership or control of the protocol smart contracts. Protocol contracts are licensed under BUSL-1.1. A planned transition to a **Cayman Islands foundation** is referenced in the [Terms of Service](https://docs.strata.markets/resources/terms-of-service) (last updated Nov 28, 2025). US users are geo-blocked. Contact: legal@strata.markets
- **Incident Response**: Not formally documented, but the protocol has multiple layers of defense:
  - 24/7 monitoring via Hypernative
  - Guardian (Patrick Collins) can cancel timelock transactions
  - Admin Multisig can pause the protocol immediately
- **Open Source**: Contracts are public on [GitHub](https://github.com/Strata-Money/contracts-tranches)
- **Points Program**: Strata runs a "Strata Points Program" (likely incentive/airdrop mechanism). The TVL volatility may be partially explained by points farming behavior

## Monitoring

### srUSDe Vault Monitoring

- **srUSDe contract**: [`0x3d7d6fdf07EE548B939A80edbc9B2256d0cdc003`](https://etherscan.io/address/0x3d7d6fdf07EE548B939A80edbc9B2256d0cdc003)
  - Monitor `convertToAssets(1e18)` for exchange rate changes (should only increase)
  - **Alert**: If exchange rate **decreases** -- indicates potential issue with yield distribution or losses
  - Monitor `Deposit`, `Withdraw` events for large deposits/withdrawals (>$1M)
  - **Alert**: Single deposits/withdrawals >$5M (potential whale activity)

### StrataCDO Monitoring

- **StrataCDO**: [`0x908B3921aaE4fC17191D382BB61020f2Ee6C0e20`](https://etherscan.io/address/0x908B3921aaE4fC17191D382BB61020f2Ee6C0e20)
  - Monitor senior coverage ratio (should stay above 105%)
  - **Alert**: Coverage ratio below 105% (triggers protective measures -- junior redemptions halted)
  - Monitor for any pausing events (`setActionStates`)

### Strategy Monitoring

- **sUSDeStrategy**: [`0xdbf4FB6C310C1C85D0b41B5DbCA06096F2E7099F`](https://etherscan.io/address/0xdbf4FB6C310C1C85D0b41B5DbCA06096F2E7099F)
  - Monitor sUSDe balance held by strategy
  - **Alert**: If strategy balance drops significantly relative to total deposits

### Governance Monitoring

- **Admin Multisig**: [`0xA27cA9292268ee0f0258B749f1D5740c9Bb68B50`](https://etherscan.io/address/0xA27cA9292268ee0f0258B749f1D5740c9Bb68B50)
  - Monitor for owner/signer changes and threshold modifications
  - **Alert**: Immediately on any signer replacement or threshold change

- **48h Timelock**: [`0xb2A3CF69C97AFD4dE7882E5fEE120e4efC77B706`](https://etherscan.io/address/0xb2A3CF69C97AFD4dE7882E5fEE120e4efC77B706)
  - Monitor `CallScheduled`, `CallExecuted`, `Cancelled` events
  - **Alert**: Immediately on any `CallScheduled` event (48h window to review changes)

- **24h Timelock**: [`0x4f2682b78F37910704fB1AFF29358A1da07E022d`](https://etherscan.io/address/0x4f2682b78F37910704fB1AFF29358A1da07E022d)
  - Monitor `CallScheduled`, `CallExecuted`, `Cancelled` events
  - **Alert**: On any `CallScheduled` event (24h window for strategy config changes)

### Ethena Dependency Monitoring

- **USDe peg**: Monitor USDe price on DEXes
  - **Alert**: If USDe deviates >0.5% from $1.00 peg
  - **Alert**: If USDe deviates >2% from $1.00 peg (critical -- srUSDe value directly impacted)
- **sUSDe vault**: Monitor Ethena's sUSDe vault for any anomalies, cooldown period changes

### Monitoring Frequency

| Category | Frequency | Priority |
|----------|-----------|----------|
| Timelock scheduled calls (both 48h and 24h) | Real-time | Critical |
| Proxy upgrade events | Real-time | Critical |
| Multisig signer/threshold changes | Real-time | Critical |
| srUSDe exchange rate | Every 6 hours | High |
| Senior coverage ratio | Every 6 hours | High |
| USDe peg stability | Hourly | High |
| Strategy sUSDe balance | Daily | Medium |
| Protocol TVL changes | Daily | Medium |

## Risk Summary

### Key Strengths

- **Structured risk tranching**: srUSDe benefits from junior tranche (jrUSDe) first-loss protection, providing additional security beyond just the underlying yield source
- **Multi-layered governance**: 48h timelock for owner changes, 24h timelock for strategy config, two-step exit-fee changes, independent Guardian (Patrick Collins/Cyfrin) with veto power
- **On-chain transparency**: Exchange rate is programmatic (ERC-4626), accounting is fully on-chain, and the codebase is open-source
- **Multiple reputable audits**: 7+ audit engagements across Cyfrin, Quantstamp, and Guardian Audits
- **Active monitoring**: 24/7 monitoring via Hypernative with Guardian oversight

### Key Risks

- **Short track record**: Only ~4 months in production since official launch (October 2025). Very young protocol
- **Single critical dependency on Ethena**: All funds flow into Ethena's sUSDe. An Ethena exploit or USDe depeg would directly impact srUSDe holders
- **Significant TVL volatility**: 62.6% drawdown from peak ($326M → $122M), suggesting large depositor concentration and/or points farming instability
- **Low multisig thresholds**: Admin Multisig is 3-of-4 with all internal signers (no independent/external signers). Operational Multisig is 2-of-3
- **No bug bounty program found**: Notable absence for a protocol managing >$150M TVL
- **Withdrawal delays**: Redemptions subject to cooldown periods tied to Ethena's sUSDe unstaking (~7 days)
- **Anonymous team**: Founding team not publicly identified. Patrick Collins (Guardian) is the only doxxed individual, in a security oversight role

### Critical Risks

- **Junior tranche depletion**: If the junior tranche is fully depleted (e.g., prolonged negative yield or extreme outflows), senior tranche **may incur principal losses**. The 105% coverage circuit breaker provides some protection but is not a guarantee
- **Reserve extraction risk**: The Admin Multisig (3/4, internal team only) holds RESERVE_MANAGER_ROLE and can transfer reserves to treasury. If compromised, this could be an extraction vector
- **Proxy upgrade risk**: Core contracts are upgradeable with 48h timelock. While the Guardian can cancel, this requires active monitoring

---

## Risk Score Assessment

**Scoring Guidelines:**
- Be conservative: when uncertain between two scores, choose the higher (riskier) one
- Use decimals (e.g., 2.5) when a subcategory falls between scores
- Prioritize on-chain evidence over documentation claims

### Critical Risk Gates

- [x] **No audit** -- Protocol audited by 3 reputable firms (Cyfrin, Quantstamp, Guardian) across 7+ engagements. **PASS**
- [x] **Unverifiable reserves** -- srUSDe exchange rate is programmatic on-chain (ERC-4626). Underlying sUSDe holdings verifiable on-chain. **PASS**
- [x] **Total centralization** -- 3-of-4 Gnosis Safe multisig with 48h timelock and independent Guardian. Not a single EOA. **PASS**

**All gates pass.** Proceed to category scoring.

### Category Scores

#### Category 1: Audits & Historical Track Record (Weight: 20%)

- **Audits**: 3 audit firms (Cyfrin, Quantstamp, Guardian) across 7+ engagements covering core contracts, redemption mechanism, and pre-deposit vaults. Good coverage.
- **Bug Bounty**: No active bug bounty program found. Significant gap.
- **Time in Production**: ~4 months since official launch (October 2025). Very young.
- **TVL**: ~$153M current, peaked at ~$326M. Has shown significant volatility (62.6% drawdown).
- **Incidents**: None reported.

**Score: 3.0/5** -- Strong audit coverage from reputable firms across multiple phases. However, the very short production history (~4 months), absence of a bug bounty program, and significant TVL volatility weigh heavily. Between score 2 (2+ audits, 1-2 years, TVL >$50M) and score 3 (1 audit, 6-12 months) -- the strong audit suite is offset by the very short track record. Conservative assessment leans toward 3.

#### Category 2: Centralization & Control Risks (Weight: 30%)

**Subcategory A: Governance**

- 3-of-4 Admin Multisig with cold wallets, all internal team signers
- 2-of-3 Operational Multisig, all internal team signers
- 48h timelock for owner-level changes (proxy upgrades, core config)
- 24h timelock for strategy config changes
- Independent Guardian (Patrick Collins/Cyfrin) can cancel timelock transactions
- Pause function available immediately via Admin Multisig (no timelock)
- No external/independent signers on either multisig

**Governance Score: 3.0** -- The timelocked governance with Guardian veto is a good design. However, the 3/4 admin threshold is low, operational multisig is only 2/3, and all signers are internal team only. The Guardian adds meaningful independent oversight but cannot initiate changes, only cancel.

**Subcategory B: Programmability**

- srUSDe exchange rate: fully on-chain ERC-4626
- Yield distribution (DYS): mostly programmatic using AprPairFeed from Aave
- Risk-premium parameters (x, y, k): set by team initially, planned transition to independent risk managers
- APR updates: triggered manually by Operational Multisig (but computation is on-chain)
- Accounting: fully on-chain

**Programmability Score: 2.5** -- Most critical functions are on-chain and programmatic. The APR update trigger and risk-premium parameter setting introduce some manual dependency. The planned transition to independent risk managers is positive but not yet implemented.

**Subcategory C: External Dependencies**

- **Critical**: Ethena sUSDe (single yield source, all funds deposited there)
- **High**: Aave v3 Core (single benchmark rate source)
- **High**: Gnosis Safe (multisig infrastructure)
- No documented fallback mechanisms if critical dependencies fail

**Dependencies Score: 4.0** -- Single critical dependency on Ethena with no fallback. Aave as single benchmark rate source. Failure of Ethena would break core functionality and potentially result in principal losses.

**Centralization Score = (3.0 + 2.5 + 4.0) / 3 = 3.17**

**Score: 3.2/5** -- Reasonable governance structure with timelocks and Guardian oversight, but constrained by low multisig thresholds, internal-only signers, critical Ethena dependency, and team-controlled risk parameters.

#### Category 3: Funds Management (Weight: 30%)

**Subcategory A: Collateralization**

- srUSDe backed by sUSDe staked in Ethena's vault (on-chain verifiable)
- Over-collateralized by junior tranche (first-loss capital)
- 105% coverage circuit breaker provides protection
- Underlying collateral is USDe (Ethena's synthetic dollar -- backed by delta-neutral ETH/BTC strategy with CEX counterparty exposure)
- Reserve mechanism exists (configurable by admin, can be withdrawn to treasury)

**Collateralization Score: 2.5** -- On-chain backing verifiable through ERC-4626 and strategy. Junior tranche first-loss protection is a strength. But the underlying asset is Ethena's USDe (itself a synthetic dollar with CEX counterparty risk), and the reserve extraction vector is a concern.

**Subcategory B: Provability**

- Exchange rate: programmatic on-chain (ERC-4626)
- Strategy holdings: verifiable on-chain (sUSDe balance in strategy contract)
- Accounting: fully on-chain with transparent TVL tracking
- Underlying USDe collateral: relies on Ethena's proof of reserves (third-party verified)
- Risk-premium parameters: set by team, visible on-chain once set

**Provability Score: 2.0** -- srUSDe layer is fully on-chain verifiable. Underlying USDe/sUSDe provability depends on Ethena (which has third-party verification). Good transparency overall.

**Funds Management Score = (2.5 + 2.0) / 2 = 2.25**

**Score: 2.25/5** -- Good on-chain provability and transparency. Senior tranche benefits from junior first-loss protection. Underlying Ethena dependency and reserve extraction risk prevent a lower score.

#### Category 4: Liquidity Risk (Weight: 15%)

- **Exit mechanism**: Cooldown-based redemption (~7 days via Ethena sUSDe unstaking). Not instant
- **DEX liquidity**: Negligible -- ~$135K total across Uniswap V4 pools with <$500/day volume. No Curve or Balancer pools. Pendle PT markets (~$21.9M) are the most liquid but trade PTs, not raw srUSDe
- **Withdrawal restrictions**: 105% coverage circuit breaker can temporarily halt operations
- **Same-value redemption**: srUSDe redeems for USDe (stablecoin-denominated), minimal price change risk
- **Use case context**: For the Morpho use case (srUSDe as collateral for USDC loans), the collateral/loan price change should be minimal

**Score: 3.0/5** -- Redemptions are available but not instant (~7 day cooldown). Limited or no DEX liquidity for secondary market exits. The same-value (stablecoin-denominated) redemption is a plus, and the Morpho collateral use case has minimal price impact risk. Between score 2 (direct redemption with minor delays) and score 4 (withdrawal queues/restrictions) -- the 7-day cooldown and limited secondary market push this toward 3.

#### Category 5: Operational Risk (Weight: 5%)

- **Team**: Partially anonymous. Founding team not publicly identified. Patrick Collins (Guardian) is the only doxxed individual, in a security oversight role
- **Documentation**: Good quality, comprehensive, actively maintained
- **Legal Structure**: Frontera Labs, Inc. (Delaware) operates the front-end. Protocol contracts are autonomous and licensed under BUSL-1.1. Planned transition to Cayman Islands foundation. US users geo-blocked
- **Incident Response**: Not formally documented. 24/7 Hypernative monitoring + Guardian veto capability provide de facto incident response

**Score: 2.5/5** -- Adequate documentation, clear legal entity (Delaware corporation), and US compliance via geo-blocking. Anonymous team and no formal incident response plan are concerns, but Patrick Collins's involvement adds credibility.

### Final Score Calculation

```
Final Score = (Centralization × 0.30) + (Funds Mgmt × 0.30) + (Audits × 0.20) + (Liquidity × 0.15) + (Operational × 0.05)
```

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Audits & Historical | 3.0 | 20% | 0.60 |
| Centralization & Control | 3.2 | 30% | 0.96 |
| Funds Management | 2.25 | 30% | 0.675 |
| Liquidity Risk | 3.0 | 15% | 0.45 |
| Operational Risk | 2.5 | 5% | 0.125 |
| **Final Score** | | | **2.81** |

**Final Score: 2.8**

### Risk Tier

| Final Score | Risk Tier | Recommendation |
|------------|-----------|----------------|
| **2.5-3.5** | **Medium Risk** | Approved with enhanced monitoring |

**Final Risk Tier: Medium Risk**

---

Strata's srUSDe is a well-designed risk-tranching product with good audit coverage from reputable firms, multi-layered governance with independent Guardian oversight, and fully on-chain accounting and exchange rate computation. The junior tranche first-loss protection adds meaningful risk mitigation beyond the underlying yield source.

However, the protocol is very young (~4 months), has a critical single dependency on Ethena's sUSDe, exhibited significant TVL volatility (62.6% drawdown), has no bug bounty program, an anonymous team, and withdrawal delays tied to Ethena's cooldown period.

**For the intended Yearn use cases:**
1. **Direct srUSDe deposit**: Medium risk. The 7-day withdrawal cooldown and Ethena dependency are the primary concerns.
2. **srUSDe as Morpho collateral (srUSDe/USDC)**: Lower effective risk for the specific use case since srUSDe is stablecoin-denominated and price changes should be minimal, but liquidation could be slow due to cooldown periods.

**Key conditions for exposure:**
- Monitor srUSDe exchange rate for any decreases (should only increase)
- Monitor senior coverage ratio (alert below 105%)
- Monitor 48h and 24h timelocks for any scheduled changes
- Monitor USDe peg stability
- Track TVL for concentration risk signals (large outflows)
- Verify bug bounty program status with the team

---

## Reassessment Triggers

- **Time-based**: Reassess in 3 months (May 2026) given the protocol's youth
- **TVL-based**: Reassess if TVL changes by more than 50%
- **Incident-based**: Reassess after any exploit, governance change, collateral modification, or Ethena incident
- **Dependency-based**: Reassess if Ethena modifies sUSDe mechanics, cooldown periods, or undergoes significant changes
- **Bug bounty**: Reassess if/when a bug bounty program is launched (should improve Audits score)
- **Governance-based**: Reassess when on-chain governance is activated or when risk-premium parameters transition to independent managers
