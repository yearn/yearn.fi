# Protocol Risk Assessment: Resolv RLP

- **Assessment Date:** February 8, 2026
- **Token:** RLP (Resolv Liquidity Pool)
- **Chain:** Ethereum (primary), multi-chain (Base, BNB, Berachain, Arbitrum, HyperEVM, Soneium, TAC, Plasma)
- **Token Address:** [`0x4956b52aE2fF65D74CA2d61207523288e4528f96`](https://etherscan.io/address/0x4956b52aE2fF65D74CA2d61207523288e4528f96)
- **Final Score: 2.9/5.0**

## Overview + Links

Resolv is a protocol maintaining USR, a stablecoin pegged to the US Dollar, backed by a delta-neutral strategy using ETH, BTC, and stablecoins. The protocol hedges spot crypto holdings with short perpetual futures positions to create a market-neutral portfolio.

**RLP (Resolv Liquidity Pool)** is the junior/insurance tranche of the Resolv system. It serves as a leveraged yield product that absorbs all residual risks of the delta-neutral strategy (counterparty risk, funding rate volatility, CEX exposure) to protect USR holders. In exchange for providing this protection layer, RLP holders receive a risk premium on top of their pro-rata share of base yield, resulting in higher returns with embedded leverage. RLP's price is variable and can go up or down.

**Yield sources:**
1. **Perpetual Futures Funding Rates** -- Historically positive, providing steady income from short positions
2. **Staking Rewards** -- On-chain assets (stETH, etc.) are staked for additional yield
3. **Risk Premium** -- RLP receives an additional allocation (currently 13.5% of net yield) exclusively as compensation for risk absorption

**Key metrics (Feb 8, 2026):**
- RLP TVL: ~$140.8M ([CoinGecko](https://www.coingecko.com/en/coins/resolv-rlp))
- RLP Price: ~$1.28
- RLP Supply: ~109.7M tokens
- RLP APY: ~6.45% ([DeFiLlama](https://defillama.com/protocol/resolv))
- USR Market Cap: ~$355.7M
- Total Protocol TVL: ~$494.8M (Ethereum)

**Links:**

- [Protocol Documentation](https://docs.resolv.xyz/litepaper/)
- [Protocol App](https://app.resolv.xyz/)
- [Collateral Pool Dashboard](https://app.resolv.xyz/collateral-pool)
- [Apostro Proof of Reserves](https://info.apostro.xyz/resolv-reserves)
- [GitHub](https://github.com/resolv-im/resolv-contracts-public)
- [Security / Audits](https://docs.resolv.xyz/litepaper/resources/security)
- [Immunefi Bug Bounty](https://immunefi.com/bug-bounty/resolv/information/)
- [DeFiLlama](https://defillama.com/protocol/resolv)

## Contract Addresses

### Core Tokens (Ethereum)

| Contract | Address |
|----------|---------|
| USR (Stablecoin) | [`0x66a1e37c9b0eaddca17d3662d6c05f4decf3e110`](https://etherscan.io/address/0x66a1e37c9b0eaddca17d3662d6c05f4decf3e110) |
| RLP (Liquidity Pool) | [`0x4956b52aE2fF65D74CA2d61207523288e4528f96`](https://etherscan.io/address/0x4956b52aE2fF65D74CA2d61207523288e4528f96) |
| stUSR (Staked USR) | [`0x6c8984bc7DBBeDAf4F6b2FD766f16eBB7d10AAb4`](https://etherscan.io/address/0x6c8984bc7DBBeDAf4F6b2FD766f16eBB7d10AAb4) |
| wstUSR (Wrapped Staked USR) | [`0x1202F5C7b4B9E47a1A484E8B270be34dbbC75055`](https://etherscan.io/address/0x1202F5C7b4B9E47a1A484E8B270be34dbbC75055) |
| RESOLV (Governance Token) | [`0x259338656198eC7A76c729514D3CB45Dfbf768A1`](https://etherscan.io/address/0x259338656198eC7A76c729514D3CB45Dfbf768A1) |
| stRESOLV (Staked Governance) | [`0xfe4bce4b3949c35fb17691d8b03c3cadbe2e5e23`](https://etherscan.io/address/0xfe4bce4b3949c35fb17691d8b03c3cadbe2e5e23) |

### Protocol Infrastructure (Ethereum)

| Contract | Address |
|----------|---------|
| USR Requests Manager | [`0xAC85eF29192487E0a109b7f9E40C267a9ea95f2e`](https://etherscan.io/address/0xAC85eF29192487E0a109b7f9E40C267a9ea95f2e) |
| RLP Requests Manager | [`0x10f4d4EAd6Bcd4de7849898403d88528e3Dfc872`](https://etherscan.io/address/0x10f4d4EAd6Bcd4de7849898403d88528e3Dfc872) |
| USR Counter | [`0xa27a69Ae180e202fDe5D38189a3F24Fe24E55861`](https://etherscan.io/address/0xa27a69Ae180e202fDe5D38189a3F24Fe24E55861) |
| RLP Counter | [`0xc7ab90c2ea9271efb31f5fa2843eeb4b331eafa0`](https://etherscan.io/address/0xc7ab90c2ea9271efb31f5fa2843eeb4b331eafa0) |
| Whitelist | [`0x5943026E21E3936538620ba27e01525bBA311255`](https://etherscan.io/address/0x5943026E21E3936538620ba27e01525bBA311255) |
| RewardDistributor | [`0xbE23BB6D817C08E7EC4Cd0adB0E23156189c1bA9`](https://etherscan.io/address/0xbE23BB6D817C08E7EC4Cd0adB0E23156189c1bA9) |
| Fee Collector | [`0x6E02e225329E32c854178d7c865cF70fE1617f02`](https://etherscan.io/address/0x6E02e225329E32c854178d7c865cF70fE1617f02) |

### Custodial / Treasury Wallets

| Wallet | Address |
|--------|---------|
| Treasury | [`0xacb7027f271b03b502d65feba617a0d817d62b8e`](https://etherscan.io/address/0xacb7027f271b03b502d65feba617a0d817d62b8e) |
| Fireblocks (Deribit) | [`0x22062B644aADD7e7Bb11e58C37BC1b022f4Ec3aC`](https://etherscan.io/address/0x22062B644aADD7e7Bb11e58C37BC1b022f4Ec3aC) |
| Fireblocks (Bybit) | [`0x2a144e059cd8a8200298976ce55e8938f33b1d3b`](https://etherscan.io/address/0x2a144e059cd8a8200298976ce55e8938f33b1d3b) |

## Audits and Due Diligence Disclosures

Resolv has undergone extensive auditing with 4 audit firms across 14+ audit engagements since May 2024. All 19 audit report links have been verified as accessible.

### Audit Firms: MixBytes, Pashov Audit Group, Sherlock, Pessimistic

| # | Date | Scope | Firms | Reports |
|---|------|-------|-------|---------|
| 1 | May-Jun 2024 | USR/RLP tokens, stUSR, Whitelist, Request Managers, RewardDistributor | MixBytes, Pessimistic | [MixBytes](https://github.com/mixbytes/audits_public/tree/master/Resolv/stUSR), [Pessimistic](https://github.com/pessimistic-io/audits/blob/main/Resolv%20Security%20Analysis%20by%20Pessimistic.pdf) |
| 2 | Jul-Aug 2024 | wstUSR | Pashov, Pessimistic | [Pashov](https://github.com/pashov/audits/blob/master/team/pdf/Resolv-security-review.pdf), [Pessimistic](https://github.com/pessimistic-io/audits/blob/main/Resolv%20WstUSR%20Security%20Analysis%20by%20Pessimistic.pdf) |
| 3 | Aug-Sep 2024 | Treasury, AaveV3 Connector, Lido Connector, Request Managers | Pashov, MixBytes | [Pashov](https://github.com/pashov/audits/blob/master/team/pdf/Resolv-security-review-August.pdf), [MixBytes](https://github.com/mixbytes/audits_public/tree/master/Resolv/Treasury) |
| 4 | Oct 2024 | Treasury, Dinero Connector | Pashov | [Pashov](https://github.com/pashov/audits/blob/master/team/pdf/Resolv-security-review-October.pdf) |
| 5 | Nov 2024 | **Full Core Protocol** (all major contracts) | **Sherlock** | [Sherlock](https://github.com/sherlock-protocol/sherlock-reports/blob/main/audits/2024.12.02%20-%20Final%20-%20Resolv%20Core%20Audit%20Report.pdf) |
| 6 | Dec 2024 | TheCounter, RlpPriceStorage, ExternalRequestsManager, UsrRedemptionExtension | Pashov | [Pashov](https://github.com/pashov/audits/blob/master/team/pdf/Resolv-security-review_2024-12-09.pdf) |
| 7 | Dec 2024 | LidoTreasuryExtension | MixBytes | [MixBytes](https://github.com/mixbytes/audits_public/tree/master/Resolv/Treasury%20Extension) |
| 8 | Dec 2024 | RlpPriceStorage, UsrPriceStorage, UsrRedemptionExtension | MixBytes | [MixBytes](https://github.com/mixbytes/audits_public/tree/master/Resolv/PoR%20Oracles) |
| 9 | Mar 2025 | TreasuryIntermediateEscrow | MixBytes | [MixBytes](https://github.com/mixbytes/audits_public/tree/master/Resolv/Treasury%20Escrow) |
| 10 | Apr-May 2025 | ResolvStaking, RewardDistributor with dripper | Pashov | [Pashov (Apr)](https://github.com/pashov/audits/blob/master/team/pdf/Resolv-security-review_2025-04-15.pdf), [Pashov (May)](https://github.com/pashov/audits/blob/master/team/pdf/Resolv-security-review_2025-05-14.pdf) |
| 11 | Jul 2025 | RlpUpOnlyPriceStorage, Multicall | MixBytes | [MixBytes](https://github.com/mixbytes/audits_public/tree/master/Resolv/Utils) |
| 12 | Jul 2025 | EtherFiTreasuryExtension | MixBytes | [MixBytes](https://github.com/mixbytes/audits_public/tree/master/Resolv/Treasury%20EtherFI%20Extension) |
| 13 | Jul-Aug 2025 | ResolvStakingV2 | Pashov, MixBytes | [Pashov](https://github.com/pashov/audits/blob/master/team/pdf/Resolv-security-review_2025-07-25.pdf), [MixBytes](https://github.com/mixbytes/audits_public/tree/master/Resolv/Staking) |
| 14 | Jan 2026 | ExternalRequestsCoordinator | MixBytes | [MixBytes](https://github.com/mixbytes/audits_public/tree/master/Resolv/ExternalRequestsCoordinator) |

### Bug Bounty

- **Platform**: [Immunefi](https://immunefi.com/bug-bounty/resolv/information/)
- **Maximum Bounty**: $500,000
- **Critical Reward**: 10% of funds at risk, up to $500K (minimum $100K guaranteed)
- **High Reward**: $50,000 - $100,000
- **Medium Reward**: $5,000
- **Program Type**: Primacy of Impact

**Known acknowledged issue**: An arbitrage opportunity exists in the stUSR contract where users can borrow, stake USR before reward distribution, and withdraw quickly. The team is aware and actively working on a fix.

## Historical Track Record

- **Production History**: Protocol launched publicly in September 2024. In production for ~17 months.
- **TVL Growth**: From ~$9.3M at launch (Sep 2024) to ~$494.8M (Feb 2026). Significant growth.
- **USR Supply**: ~354M ($354M circulating), peaked at ~$403M the previous week.
- **RLP Supply**: ~109.7M tokens (~$140.8M market cap)
- **Incidents**: No reported security incidents, exploits, or hacks found on Rekt News or DeFi Llama hacks database.
- **Peg Stability**: USR trading at ~$0.9998, maintaining close to $1 peg.
- **Historical Yield**: Median annual performance of delta-neutral strategy: 8.4%, with 99% of results in the 7-10% p.a. range.

## Funds Management

The protocol acts as a delta-neutral asset manager. User deposits are deployed into a hedged portfolio combining spot crypto holdings with short perpetual futures positions.

### Collateral Pool Composition (Resolv Asset Cluster Architecture)

1. **Delta-Neutral ETH/BTC**: Core yield source. Spot ETH/BTC hedged with short perps on Binance, Deribit, Bybit, and Hyperliquid
2. **USD DeFi Allocations**: Dollar-denominated DeFi lending/money market exposure (Aave, Fluid)
3. **Delta-Neutral Altcoins**: Higher-yield via delta-neutral structures with explicit sizing and risk limits
4. **Real-World Assets (RWAs)**: Superstate's USCC crypto-carry fund and Aave Horizon RWA instance

### Risk Hierarchy

Losses are allocated entirely to RLP holders. No losses flow to USR holders unless RLP is fully depleted:
1. RLP absorbs **all** losses first
2. USR holders are protected as long as RLP coverage exists
3. If RLP reaches zero, USR still redeemable for $1 but without insurance layer

### Accessibility

- **Minting RLP**: Deposit USDC, USDT, or ETH via `requestMint()` on the `LPExternalRequestsManager`. Minting takes ~1 minute (1-5 blocks). 0% minting fees (currently waived). Backend (`SERVICE_ROLE`) calls `completeMint()` with the mint amount determined off-chain based on current RLP price.
- **Redeeming RLP**: Uses an **epoch-based batch burn system** (unique to RLP, not shared with USR or wstUSR):
  1. User calls `requestBurn()` -- RLP tokens are transferred to the contract
  2. Backend calls `processBurns()` -- groups burn requests into an epoch for batch processing
  3. Backend calls `completeBurns()` -- determines withdrawal collateral amounts off-chain, supports partial completion across multiple epochs
  4. User calls `withdrawAvailableCollateral()` -- claims accumulated collateral (USDC/USDT/ETH)
  - Processed within 24 hours under normal conditions. 0% redemption fees (currently waived).
  - **No on-chain slippage protection**: Unlike USR burn requests, RLP `requestBurn()` has no `minWithdrawalAmount` parameter.
  - **No instant redeem**: RLP has no equivalent to USR's `UsrRedemptionExtension` instant redeem function.
- **Access Control**: Minting/redeeming requires **allowlisted wallets** (users must apply and be verified by Resolv Digital Assets Ltd).
- **RLP Redemption Gate**: Redemption of RLP is **suspended** if USR Collateralization Ratio (CR) falls below 110%.

### Collateralization

- **Backing**: USR is >100% collateralized. The excess collateral above 100% backs RLP.
- **On-chain portion**: Majority of collateral held on-chain in protocol smart contract wallets
- **Off-chain portion**: A portion held with institutional custodians (Fireblocks, Ceffu) as margin for futures positions
- **Exchange exposure**: As of H2 2025, exchange-related positions contribute less than 15% of collateral pool exposure combined
- **Collateral quality**: ETH, BTC, stETH, wstETH, stablecoins (USDC, USDT), RWAs (USCC)

### Provability

- **Self-reporting**: Resolv's own collateral pool dashboard at [app.resolv.xyz/collateral-pool](https://app.resolv.xyz/collateral-pool)
- **Third-party verification**: [Apostro risk curators](https://info.apostro.xyz/resolv-reserves) provide independent proof-of-reserves dashboard showing market delta, RLP/USR ratio, overcollateralization ratio, exposure by asset, and backing assets by location
- **RLP Price**: Updated every 24 hours based on collateral pool valuation. Calculated and published by Resolv (centralized update).
- **Oracle feeds**: Pyth (fundamental & market), Chainlink, Chronicle, RedStone for USR. Pyth and Resolv's own oracle for RLP price.
- **On-chain monitoring**: Continuous monitoring of smart contracts and integrated protocols

## Liquidity Risk

- **Exit Mechanism**: RLP can be redeemed at its current price (variable, ~$1.28) within 24 hours for USDC/USDT/ETH. No withdrawal queues under normal conditions.
- **Redemption Gate**: RLP redemptions are **suspended** if USR Collateralization Ratio drops below 110%. This protects USR holders at the expense of RLP holders' liquidity.
- **DEX Liquidity**: RLP available on Curve (Ethereum), Uniswap (Ethereum), Aerodrome (Base). TODO: Exact on-chain liquidity depth needs verification.
- **RLP Trading Volume**: 7days on [Fluid Dex](https://fluid.io/stats/1/dex) is $8.5M.
- **Bridge**: LayerZero OFT standard enables cross-chain transfers via Stargate.
- **Multi-chain availability**: RLP deployed on 9 chains, with Ethereum as the primary (minting/redeeming only on Ethereum).
- **Stress scenario**: In a mass redemption event, the 110% CR gate would suspend RLP redemptions, locking RLP holders while USR holders can still exit.

## Centralization & Control Risks

### Governance

- **Multisig**: All core contracts are controlled by a **3-of-5 Gnosis Safe** at [`0xd6889f307be1b83bb355d5da7d4478fb0d2af547`](https://etherscan.io/address/0xd6889f307be1b83bb355d5da7d4478fb0d2af547). The Safe is `owner()` and `DEFAULT_ADMIN_ROLE` holder for USR, RLP, Treasury, Request Managers, RewardDistributor, and Whitelist. Nonce 366+ indicates significant operational activity. All 5 signers are EOAs (not publicly identified).
- **Timelock**: A 3-day OpenZeppelin `TimelockController` at [`0x290d9544669c9c7a64f6899a0a3b28d563f6ebee`](https://etherscan.io/address/0x290d9544669c9c7a64f6899a0a3b28d563f6ebee) owns all ProxyAdmin contracts. Contract upgrades require a 3-day delay. The Safe is the sole proposer/executor on the timelock.
- **Split architecture**: The multisig controls **operational parameters directly** (no delay) -- pausing, role grants, parameter changes, price updates. The timelock only gates **proxy upgrades** (implementation changes).
- **On-chain governance not yet live**: The stRESOLV token exists but Snapshot voting has not been initiated.
- **RDAL discretion**: From the Terms of Service, RDAL has **full discretion** over collateral pool composition and strategy parameters.
- **Whitelist control**: RDAL controls who can mint/redeem by managing the address whitelist.

### Programmability

- **Hybrid Model**: The system is semi-programmatic. Smart contracts handle token operations (mint/burn requests), but a **backend system** completes mint/redeem operations via `completeMint` / `completeBurn` calls.
- **RLP Price**: Updated by a privileged role every 24 hours. Not calculated algorithmically on-chain.
- **Reward Distribution**: Rewards are distributed every 24 hours (epoch-based) by the protocol, not automatically by smart contracts.
- **Collateral management**: Active management of hedging positions and collateral deployment by the team (off-chain).
- **Oracle updates**: Resolv's own fundamental price oracles for USR and RLP are updated centrally every 24 hours.

### External Dependencies

- **CEX Dependencies (Critical)**: Binance (via Ceffu custody), Deribit (via Fireblocks), Bybit (via Fireblocks) for hedging futures positions. A CEX failure would directly impact the collateral pool, with losses absorbed by RLP.
- **DEX Dependencies**: Hyperliquid for additional hedging positions.
- **Custodians**: Fireblocks (Deribit, Bybit wallets), Ceffu (Binance omnibus wallet). These hold off-exchange margin.
- **Oracles**: Pyth (primary for minting/redeeming), Chainlink, Chronicle, RedStone for market pricing.
- **DeFi integrations**: Aave v3 (ETH borrowing), Lido (stETH), EtherFi (weETH), potentially Fluid.
- **Bridge**: LayerZero for cross-chain token bridging.

## Operational Risk

- **Team Transparency**: Team is **not publicly doxxed** on the website or docs. No /about or /team page exists. GitHub organization (`resolv-im`) has a single contributor label (`resolv-labs`). However, CoinGecko lists team members: Ivan Kozlov (CEO), Tim Shekikhachev (CPO), Fedor Chmilev (CTO) with LinkedIn and Twitter profiles.
- **Company founded**: 2023 (Resolv Labs).
- **Legal Structure**: Two BVI entities: **Resolv Labs Ltd** (frontend/app) and **Resolv Digital Assets Ltd (RDAL)** (token issuance, collateral pool). A **Resolv Foundation** manages protocol revenue and buybacks.
- **Jurisdiction**: British Virgin Islands (BVI). Dispute resolution under BVI courts.
- **U.S. access**: Restricted to Accredited Investors under Reg D Rule 501(a).
- **Documentation**: Comprehensive litepaper available at [docs.resolv.xyz](https://docs.resolv.xyz/). Blog posts provide quarterly reports and parameter updates.
- **Incident Response**: No documented incident response plan found in public documentation. Bug bounty and on-chain monitoring exist.
- **Investors**: $10M seed round led by Cyber Fund and Maven 11. Other investors include Coinbase Ventures, Arrington Capital, Robot Ventures, Animoca Brands, Ether.fi.

## Monitoring

### Governance Monitoring

- **Multisig activity**: Monitor the 3-of-5 Gnosis Safe [`0xd6889f307be1b83bb355d5da7d4478fb0d2af547`](https://etherscan.io/address/0xd6889f307be1b83bb355d5da7d4478fb0d2af547) for owner changes, threshold changes, and module additions
- **Timelock proposals**: Monitor the TimelockController [`0x290d9544669c9c7a64f6899a0a3b28d563f6ebee`](https://etherscan.io/address/0x290d9544669c9c7a64f6899a0a3b28d563f6ebee) for `CallScheduled`, `CallExecuted`, and `Cancelled` events (3-day window to review proxy upgrades)
- **Whitelist Changes**: Monitor the Whitelist contract [`0x5943026E21E3936538620ba27e01525bBA311255`](https://etherscan.io/address/0x5943026E21E3936538620ba27e01525bBA311255)

### RLP Liquidity & Redemption Monitoring

- **RLP Requests Manager**: [`0x10f4d4EAd6Bcd4de7849898403d88528e3Dfc872`](https://etherscan.io/address/0x10f4d4EAd6Bcd4de7849898403d88528e3Dfc872)
  - Monitor `BurnRequestCreated` events -- tracks users requesting RLP redemptions
  - Monitor `BurnRequestProcessed` events -- tracks when burn requests enter epoch processing
  - Monitor `BurnRequestCompleted` events -- tracks when redemptions are fulfilled and at what price
  - Monitor `BurnRequestCancelled` events -- tracks cancellations (may indicate dissatisfaction with processing times)
  - Track pending burn requests in `CREATED` state vs. `PROCESSING` state to detect processing backlogs
  - Alert if burn requests remain in `CREATED` state for >24 hours (indicates processing delays)
- **RLP Price Changes**: Monitor the RLP Counter contract [`0xc7ab90c2ea9271efb31f5fa2843eeb4b331eafa0`](https://etherscan.io/address/0xc7ab90c2ea9271efb31f5fa2843eeb4b331eafa0) for price updates. Alert on >2% daily price drops (may signal collateral pool losses).
- **Minting activity**: Monitor `MintRequestCompleted` events on RLP Requests Manager for net flow direction (net minting vs. net burning)

### Collateral & Coverage Monitoring

- **Collateral Pool**: Monitor collateral composition and delta neutrality at [Apostro dashboard](https://info.apostro.xyz/resolv-reserves) and [app.resolv.xyz/collateral-pool](https://app.resolv.xyz/collateral-pool)
- **USR Collateralization Ratio**: Alert at <120% CR (approaching the 110% redemption gate threshold)
- **RLP/USR coverage ratio**: Track total RLP value vs. USR supply. Alert if coverage drops below 20%
- **TVL**: Monitor total USR supply and RLP market cap for coverage ratio changes
- **Exchange exposure**: Monitor Apostro dashboard for changes in CEX margin ratios and delta exposure

### Operational Monitoring

- **Reward Distribution**: Monitor RewardDistributor [`0xbE23BB6D817C08E7EC4Cd0adB0E23156189c1bA9`](https://etherscan.io/address/0xbE23BB6D817C08E7EC4Cd0adB0E23156189c1bA9) for reward distribution events and yield changes
- **Treasury flows**: Monitor Treasury [`0xacb7027f271b03b502d65feba617a0d817d62b8e`](https://etherscan.io/address/0xacb7027f271b03b502d65feba617a0d817d62b8e) for large outflows or unexpected transfers
- **Recommended frequency**: Daily for price/TVL/redemptions; hourly during high volatility; real-time for governance/timelock events

## Risk Summary

### Key Strengths

- **Extensive audit coverage**: 14+ audits by 4 reputable firms (including Sherlock contest), ongoing since May 2024
- **Strong bug bounty**: $500K max on Immunefi with Primacy of Impact
- **Third-party verification**: Apostro provides independent proof-of-reserves dashboard
- **Risk segregation**: Clear tranche structure where RLP absorbs all losses before USR is affected
- **Significant TVL**: ~$494.8M total protocol TVL, ~17 months in production with no security incidents
- **Diversified collateral**: Multiple exchange venues, custodians, and asset clusters reduce single points of failure

### Key Risks

- **Centralized operations**: Backend processes minting/redeeming, RLP price updates are centralized (24h cycle), team has full discretion over collateral pool
- **CEX counterparty risk**: Futures positions on Binance, Deribit, Bybit create counterparty exposure. A CEX failure directly impacts RLP value.
- **Governance not yet live**: No on-chain governance. 3-of-5 multisig controls operations directly (no delay). 3-day timelock only for proxy upgrades. RDAL retains full discretion over collateral pool.
- **RLP as first-loss capital**: By design, RLP absorbs all losses. Severe market events or exchange failures could significantly impair RLP value.
- **Liquidity gate**: RLP redemptions are suspended below 110% CR -- in a stress scenario, RLP holders cannot exit while losses mount.
- **Whitelisting requirement**: Not permissionless; access controlled by RDAL.

### Critical Risks

- **Operational parameters not timelocked**: While a 3-of-5 multisig exists and proxy upgrades have a 3-day timelock, operational parameters (pausing, role grants, price updates, whitelist changes) are controlled by the multisig **without any timelock delay**. This means 3 of 5 anonymous signers can immediately change critical operational parameters.
- **RLP price is entirely off-chain**: The backend determines how much collateral to return for burned RLP with no on-chain price oracle or slippage protection in the contract. Users must trust the backend to apply fair pricing.

---

## Risk Score Assessment

**Scoring Guidelines:**
- Be conservative: when uncertain between two scores, choose the higher (riskier) one
- Use decimals (e.g., 2.5) when a subcategory falls between scores
- Prioritize on-chain evidence over documentation claims

### Critical Risk Gates

- [x] **No audit** -- Protocol has been audited by 4 reputable firms across 14+ engagements. **PASS**
- [x] **Unverifiable reserves** -- Reserves verifiable via on-chain wallets and Apostro third-party dashboard. **PASS**
- [x] **Total centralization** -- 3-of-5 Gnosis Safe multisig controls all contracts. 3-day timelock for proxy upgrades. Not a single EOA. **PASS**

**All gates pass.** Proceed to category scoring.

### Category Scores

#### Category 1: Audits & Historical Track Record (Weight: 20%)

- **Audits**: 4 audit firms (MixBytes, Pashov, Sherlock, Pessimistic), 14+ separate engagements covering all major contracts. Continuous auditing as new features are added. Sherlock contest for core protocol.
- **Bug Bounty**: $500K max on Immunefi (Primacy of Impact) - strong.
- **Time in Production**: ~17 months (Sep 2024 - Feb 2026).
- **TVL**: ~$494.8M (>$100M threshold).
- **Incidents**: None reported.

**Score: 1.5/5** -- Exceptional audit coverage with 4 firms and 14+ audits. Strong bug bounty ($500K). >1 year production with >$100M TVL and no incidents. The volume of audits and continuous engagement is best-in-class.

#### Category 2: Centralization & Control Risks (Weight: 30%)

**Subcategory A: Governance**

- **3-of-5 Gnosis Safe** multisig ([`0xd6889...af547`](https://etherscan.io/address/0xd6889f307be1b83bb355d5da7d4478fb0d2af547)) is `owner()` and `DEFAULT_ADMIN_ROLE` for all core contracts.
- **3-day OpenZeppelin TimelockController** ([`0x290d9...6ebee`](https://etherscan.io/address/0x290d9544669c9c7a64f6899a0a3b28d563f6ebee)) owns all ProxyAdmin contracts (upgrades only).
- Operational parameters (pause, role grants, price updates, whitelist) controlled by multisig **directly with no timelock**.
- No on-chain governance live yet. stRESOLV exists but voting not initiated.
- RDAL has full discretion per Terms of Service.
- All 5 signers are anonymous EOAs.

**Governance Score: 3.5** -- 3/5 multisig with 3-day upgrade timelock is a meaningful improvement over EOA control, but operational parameters lack delay. Anonymous signers and no active governance reduce confidence. RDAL retains full discretion per ToS.

**Subcategory B: Programmability**

- Hybrid on-chain/off-chain operations. Smart contracts handle token accounting but backend completes operations.
- RLP price updated off-chain every 24 hours by privileged role.
- Reward distribution managed off-chain.
- Collateral management is fully manual/off-chain.

**Programmability Score: 4.0** -- Significant manual intervention required. Price and rewards are admin-controlled with 24h update cycles. Core financial decisions happen off-chain.

**Subcategory C: External Dependencies**

- 3 CEXes (Binance, Deribit, Bybit) + 1 DEX (Hyperliquid) for hedging
- 2 institutional custodians (Fireblocks, Ceffu)
- 4 oracle providers (Pyth, Chainlink, Chronicle, RedStone)
- DeFi protocols (Aave, Lido, EtherFi)
- LayerZero for bridging

**Dependencies Score: 3.5** -- Multiple critical dependencies, but well-diversified across venues and custodians. CEX failure is the most acute risk but exposure has been reduced to <15% of collateral pool.

**Centralization Score = (3.5 + 4.0 + 3.5) / 3 = 3.67**

**Score: 3.7/5** -- Centralized operational control with multisig but no timelocked parameter changes. No active on-chain governance. Partially mitigated by upgrade timelock, diversified custodians, and exchange venues.

#### Category 3: Funds Management (Weight: 30%)

**Subcategory A: Collateralization**

- USR >100% collateralized on-chain; excess backs RLP.
- Collateral: ETH, BTC, stETH, stablecoins, RWAs -- mix of high-quality and newer assets.
- Majority on-chain, ~15% CEX margin exposure.
- **RLP is first-loss capital**: By design, RLP absorbs **all** losses from the delta-neutral strategy (funding rate losses, CEX counterparty failure, liquidation events) before any impact to USR. RLP price is variable and can decrease.
- No on-chain slippage protection on RLP burns -- backend determines collateral return amounts off-chain.

**Collateralization Score: 3.5** -- Verifiable on-chain collateral with third-party dashboard, but RLP is explicitly designed as loss-absorbing capital. Price is variable and can decrease. Mixing on-chain assets with off-chain futures margin and CEX exposure. Partially custodial. The first-loss tranche design means depositors face embedded structural risk beyond typical collateralization concerns.

**Subcategory B: Provability**

- Self-reporting dashboard + Apostro third-party verification.
- RLP price calculated off-chain, updated by admin every 24 hours.
- Multiple oracle sources for market pricing.
- Exchange position data visible on Apostro dashboard.

**Provability Score: 2.5** -- Good transparency with both self-reporting and third-party verification. However, fundamental price is admin-updated, not fully programmatic. Off-chain components (futures positions, custodial balances) require trust.

**Funds Management Score = (3.5 + 2.5) / 2 = 3.0**

**Score: 3.0/5** -- Verifiable collateral with third-party dashboard, but RLP is first-loss capital by design -- holders face embedded loss risk from the delta-neutral strategy. Hybrid on-chain/off-chain nature, admin-controlled pricing, and no on-chain slippage protection add further trust requirements.

#### Category 4: Liquidity Risk (Weight: 15%)

- **Exit Mechanism**: RLP redeemable within 24 hours at current price. No withdrawal queue under normal conditions.
- **Liquidity Gate**: RLP redemptions suspended below 110% CR -- critical restriction that could lock RLP holders during stress.
- **DEX liquidity**: Available on Curve, Uniswap, Aerodrome. TODO: Exact depth not verified.
- **24h processing**: Not instant. Up to 24-hour delay is a moderate concern.
- **Multi-chain**: Cross-chain liquidity fragmented across 9 chains.

**Score: 3.0/5** -- 24h redemption delay, not instant. Redemption gate at 110% CR could lock RLP holders during the exact moments they most need to exit. DEX liquidity exists but depth unverified. Same-value redemption partially mitigates the time concern, but the gate mechanism adds significant risk.

#### Category 5: Operational Risk (Weight: 5%)

- **Team**: Partially doxxed (CoinGecko lists CEO, CPO, CTO with LinkedIn/Twitter), but not prominently displayed on protocol website/docs.
- **Documentation**: Comprehensive litepaper and quarterly reports. Good transparency on yield distribution parameters.
- **Legal Structure**: Two BVI entities + Foundation. BVI jurisdiction.
- **Investors**: Strong investor base (Coinbase Ventures, Maven 11, Cyber Fund, etc.) with $10M seed.
- **Incident Response**: No documented plan found.

**Score: 2.5/5** -- Team partially identifiable via CoinGecko, strong investors, good documentation. Weakened by BVI jurisdiction, lack of documented incident response plan, and no prominent team disclosure.

### Final Score Calculation

```
Final Score = (Centralization × 0.30) + (Funds Mgmt × 0.30) + (Audits × 0.20) + (Liquidity × 0.15) + (Operational × 0.05)
```

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Audits & Historical | 1.5 | 20% | 0.30 |
| Centralization & Control | 3.7 | 30% | 1.11 |
| Funds Management | 3.0 | 30% | 0.90 |
| Liquidity Risk | 3.0 | 15% | 0.45 |
| Operational Risk | 2.5 | 5% | 0.125 |
| **Final Score** | | | **2.885** |

**Final Score: 2.9**

### Risk Tier

| Final Score | Risk Tier | Recommendation |
|------------|-----------|----------------|
| **2.5-3.5** | **Medium Risk** | Approved with enhanced monitoring |

**Final Risk Tier: Medium Risk**

---

RLP is a well-audited protocol with strong security practices but carries inherent structural risk as a **first-loss tranche** -- by design, RLP absorbs all losses from the delta-neutral strategy before USR is affected, meaning RLP price can decrease. A 3-of-5 Gnosis Safe multisig controls all contracts and a 3-day timelock gates proxy upgrades, but operational parameters remain untimelocked and no on-chain governance is live. In stress scenarios, RLP holders face both value impairment and potential liquidity lockout (110% CR gate). The RLP burn mechanism is epoch-based with no on-chain slippage protection, and pricing is entirely off-chain. These structural and centralization risks place RLP in the Medium Risk classification despite its strong audit and track record profile.

**Key conditions for exposure:**
- Enhanced monitoring of collateral pool composition and delta exposure via Apostro dashboard
- Monitor for governance activation (stRESOLV voting)
- Track RLP/USR coverage ratio; alert at <120%
- Monitor multisig signer changes and timelock proposals

---

## Reassessment Triggers

- **Time-based**: Reassess in 6 months (August 2026)
- **Governance-based**: Reassess when on-chain governance is activated
- **Incident-based**: Reassess after any exploit, governance change, CEX failure, or significant collateral modification
