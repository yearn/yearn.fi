# Protocol Risk Assessment: Resolv wstUSR

- **Assessment Date:** February 9, 2026
- **Token:** wstUSR (Wrapped Staked USR)
- **Chain:** Ethereum (primary), multi-chain (Arbitrum, Base)
- **Token Address:** [`0x1202F5C7b4B9E47a1A484E8B270be34dbbC75055`](https://etherscan.io/address/0x1202F5C7b4B9E47a1A484E8B270be34dbbC75055)
- **Final Score: 2.2/5.0**

## Overview + Links

Resolv is a protocol maintaining USR, a stablecoin pegged to the US Dollar, backed by a delta-neutral strategy using ETH, BTC, and stablecoins. The protocol hedges spot crypto holdings with short perpetual futures positions to create a market-neutral portfolio.

**wstUSR (Wrapped Staked USR)** is the non-rebasing, DeFi-composable wrapper for stUSR (Staked USR). The token flow is:

1. **USR** → User deposits USR into the **stUSR** contract → receives **stUSR** (a rebasing token whose balance grows as rewards accrue)
2. **stUSR** → User wraps stUSR into the **wstUSR** contract → receives **wstUSR** (a non-rebasing ERC-4626 vault token whose price appreciates)
3. Alternatively, users can deposit USR directly into **wstUSR** (which internally deposits into stUSR first)

**wstUSR is analogous to Lido's wstETH**: it's a non-rebasing wrapper around a rebasing staked token. This makes it compatible with DeFi protocols (lending, AMMs) that don't support rebasing tokens natively.

**Yield source**: The stUSR yield derives from the Resolv protocol's delta-neutral strategy profits. The **RewardDistributor** contract mints USR rewards and drips them into the stUSR contract, increasing the stUSR/USR exchange rate over time. Since wstUSR wraps stUSR, it captures the same yield through exchange rate appreciation.

**Key metrics (Feb 9, 2026):**
- wstUSR Price: ~$1.13 ([CoinGecko](https://www.coingecko.com/en/coins/resolv-wstusr))
- wstUSR Market Cap: ~$344.8M
- wstUSR Supply: ~305.1M tokens
- wstUSR Exchange Rate: 1 wstUSR = ~1.1304 USR (on-chain `convertToAssets(1e18)`)
- stUSR Total Supply: ~347.2M (rebased, in USR terms)
- stUSR Staked in wstUSR: ~344.9M stUSR (99.3% of all stUSR is wrapped)
- USR Backing stUSR: ~347.2M USR held by stUSR contract
- USR Total Supply: ~350.7M
- 24h Trading Volume: ~$2.6M
- stUSR APY: ~7.36% (1-year price change of wstUSR per CoinGecko)
- Total Protocol TVL: ~$447.8M (Ethereum, DeFiLlama)

**Links:**

- [Protocol Documentation](https://docs.resolv.xyz/litepaper/)
- [Protocol App](https://app.resolv.xyz/)
- [Collateral Pool Dashboard](https://app.resolv.xyz/collateral-pool)
- [Apostro Proof of Reserves](https://info.apostro.xyz/resolv-reserves)
- [GitHub](https://github.com/resolv-im/resolv-contracts-public)
- [Security / Audits](https://docs.resolv.xyz/litepaper/resources/security)
- [Immunefi Bug Bounty](https://immunefi.com/bug-bounty/resolv/information/)
- [DeFiLlama](https://defillama.com/protocol/resolv)
- [CoinGecko wstUSR](https://www.coingecko.com/en/coins/resolv-wstusr)

## Contract Addresses

### Core Token Contracts (Ethereum)

| Contract | Address | Type |
|----------|---------|------|
| USR (Stablecoin) | [`0x66a1e37c9b0eaddca17d3662d6c05f4decf3e110`](https://etherscan.io/address/0x66a1e37c9b0eaddca17d3662d6c05f4decf3e110) | ERC-20, Upgradeable Proxy |
| stUSR (Staked USR) | [`0x6c8984bc7DBBeDAf4F6b2FD766f16eBB7d10AAb4`](https://etherscan.io/address/0x6c8984bc7DBBeDAf4F6b2FD766f16eBB7d10AAb4) | Rebasing ERC-20, Upgradeable Proxy |
| wstUSR (Wrapped Staked USR) | [`0x1202F5C7b4B9E47a1A484E8B270be34dbbC75055`](https://etherscan.io/address/0x1202F5C7b4B9E47a1A484E8B270be34dbbC75055) | ERC-4626 Vault, Upgradeable Proxy |
| RewardDistributor | [`0xbE23BB6D817C08E7EC4Cd0adB0E23156189c1bA9`](https://etherscan.io/address/0xbE23BB6D817C08E7EC4Cd0adB0E23156189c1bA9) | Non-proxy |

### Proxy Implementation & Admin (Ethereum, verified on-chain)

| Contract | Implementation | ProxyAdmin |
|----------|---------------|------------|
| stUSR | [`0xba1600735a039e2b3bf1d1d2f1a7f80f45973da7`](https://etherscan.io/address/0xba1600735a039e2b3bf1d1d2f1a7f80f45973da7) | [`0xeb88058615eaf3e4833af053484012c4d6cbfa37`](https://etherscan.io/address/0xeb88058615eaf3e4833af053484012c4d6cbfa37) |
| wstUSR | [`0x6ed5485d079d7f0cfa8e395499b3c01a6c359cc0`](https://etherscan.io/address/0x6ed5485d079d7f0cfa8e395499b3c01a6c359cc0) | [`0xD89784610EefD4d11444788F7A85AaDfd57AF7E5`](https://etherscan.io/address/0xD89784610EefD4d11444788F7A85AaDfd57AF7E5) |

### Cross-Chain Deployments

| Chain | wstUSR Address |
|-------|---------------|
| Arbitrum | [`0x66cfbd79257dc5217903a36293120282548e2254`](https://arbiscan.io/address/0x66cfbd79257dc5217903a36293120282548e2254) |
| Base | [`0xb67675158b412d53fe6b68946483ba920b135ba1`](https://basescan.org/address/0xb67675158b412d53fe6b68946483ba920b135ba1) |

### Protocol Infrastructure (Ethereum)

| Contract | Address |
|----------|---------|
| USR Requests Manager | [`0xAC85eF29192487E0a109b7f9E40C267a9ea95f2e`](https://etherscan.io/address/0xAC85eF29192487E0a109b7f9E40C267a9ea95f2e) |
| USR Counter | [`0xa27a69Ae180e202fDe5D38189a3F24Fe24E55861`](https://etherscan.io/address/0xa27a69Ae180e202fDe5D38189a3F24Fe24E55861) |
| Whitelist | [`0x5943026E21E3936538620ba27e01525bBA311255`](https://etherscan.io/address/0x5943026E21E3936538620ba27e01525bBA311255) |
| Fee Collector | [`0x6E02e225329E32c854178d7c865cF70fE1617f02`](https://etherscan.io/address/0x6E02e225329E32c854178d7c865cF70fE1617f02) |
| Gnosis Safe (3/5 multisig) | [`0xd6889f307be1b83bb355d5da7d4478fb0d2af547`](https://etherscan.io/address/0xd6889f307be1b83bb355d5da7d4478fb0d2af547) |
| TimelockController (3-day) | [`0x290d9544669c9c7a64f6899a0a3b28d563f6ebee`](https://etherscan.io/address/0x290d9544669c9c7a64f6899a0a3b28d563f6ebee) |
| Treasury | [`0xacb7027f271b03b502d65feba617a0d817d62b8e`](https://etherscan.io/address/0xacb7027f271b03b502d65feba617a0d817d62b8e) |

## Audits and Due Diligence Disclosures

Resolv has undergone extensive auditing with 4 audit firms across 14+ audit engagements since May 2024. **wstUSR and stUSR have been specifically audited** in dedicated engagements.

### wstUSR/stUSR-Specific Audits

| # | Date | Scope | Firm | Key Findings | Reports |
|---|------|-------|------|-------------|---------|
| 1 | May-Jun 2024 | USR, stUSR, Whitelist, Request Managers, RewardDistributor | MixBytes, Pessimistic | stUSR core design reviewed | [MixBytes](https://github.com/mixbytes/audits_public/tree/master/Resolv/stUSR), [Pessimistic](https://github.com/pessimistic-io/audits/blob/main/Resolv%20Security%20Analysis%20by%20Pessimistic.pdf) |
| 2 | Jul-Aug 2024 | **wstUSR** (dedicated) | Pashov, Pessimistic | 4 Medium + 3 Low (all resolved): rounding in unwrap, mintWithPermit wrong amount, previewWithdraw rounding, free withdraw via zero previewWithdraw, whale frontrunning rewards, EIP-4626 non-compliance, dust accumulation | [Pashov](https://github.com/pashov/audits/blob/master/team/pdf/Resolv-security-review.pdf), [Pessimistic](https://github.com/pessimistic-io/audits/blob/main/Resolv%20WstUSR%20Security%20Analysis%20by%20Pessimistic.pdf) |
| 3 | Nov-Dec 2024 | **Full Core Protocol** (incl. wstUSR, stUSR) | Sherlock | 1 Medium: inflation attack on wstUSR deposits via stUSR share price manipulation (fixed via initial deposit mitigation + PR #222) | [Sherlock](https://github.com/sherlock-protocol/sherlock-reports/blob/main/audits/2024.12.02%20-%20Final%20-%20Resolv%20Core%20Audit%20Report.pdf) |
| 4 | Apr-May 2025 | RewardDistributor with drip model (feeds stUSR) | Pashov | 1 Medium (withdraw bypass of claimEnabled), 2 Low (dripReward sandwiching, dust reward vesting) | [Pashov (Apr)](https://github.com/pashov/audits/blob/master/team/pdf/Resolv-security-review_2025-04-15.pdf), [Pashov (May)](https://github.com/pashov/audits/blob/master/team/pdf/Resolv-security-review_2025-05-14.pdf) |
| 5 | Jul-Aug 2025 | ResolvStakingV2 | Pashov, MixBytes | 1 Critical (rewards stolen via self-transfer, resolved), 2 Low | [Pashov](https://github.com/pashov/audits/blob/master/team/pdf/Resolv-security-review_2025-07-25.pdf), [MixBytes](https://github.com/mixbytes/audits_public/tree/master/Resolv/Staking) |

### Full Audit History

The complete Resolv audit history covers 14+ engagements by MixBytes, Pashov Audit Group, Sherlock, and Pessimistic across all protocol contracts. See the [RLP risk assessment](rlp.md) for the complete audit table.

### Bug Bounty

- **Platform**: [Immunefi](https://immunefi.com/bug-bounty/resolv/information/)
- **Maximum Bounty**: $500,000
- **Critical Reward**: 10% of funds at risk, up to $500K (minimum $100K guaranteed)
- **High Reward**: $50,000 - $100,000
- **Medium Reward**: $5,000
- **Program Type**: Primacy of Impact
- **wstUSR/stUSR in scope**: Yes, both contracts are covered

**Known acknowledged issues**:
- Whale frontrunning of reward distribution (stUSR): A user can monitor the mempool for `dripReward` transactions, deposit USR into stUSR before rewards are distributed, and withdraw after to capture a portion. The team acknowledges this.
- EIP-4626 partial non-compliance (wstUSR): `totalAssets()` returns `stUSR.totalSupply()` instead of USR managed specifically by wstUSR. Resolved in later versions.

## Historical Track Record

- **Production History**: stUSR and wstUSR launched alongside the core protocol in September 2024. In production for ~17 months.
- **TVL Growth**: wstUSR market cap ~$344.8M. stUSR TVL ~$347M (DeFiLlama). The vast majority (99.3%) of stUSR is wrapped as wstUSR.
- **Exchange Rate History**: wstUSR has appreciated from ~$1.00 (launch) to ~$1.13 (Feb 2026), representing ~13% cumulative yield. ATL was $0.59 (likely from low initial liquidity/launch pricing per CoinGecko). ATH is $1.13 (current).
- **Incidents**: No reported security incidents, exploits, or hacks found for stUSR or wstUSR on Rekt News or DeFi Llama hacks database.
- **Underlying Stability**: USR trading at ~$0.9998, maintaining close to $1 peg.
- **Protocol TVL**: ~$447.8M total Resolv protocol TVL on Ethereum (DeFiLlama).

## Funds Management

### Token Mechanism (stUSR → wstUSR)

**stUSR** is a **rebasing ERC-20 token** (similar to Lido's stETH):
- Underlying token: USR
- Users deposit USR to receive stUSR shares
- stUSR uses an internal shares model: `balanceOf(user) = shares[user] * totalPooled / totalShares`
- When the RewardDistributor drips USR rewards into the stUSR contract, the `totalPooled` USR increases, causing all stUSR balances to grow proportionally
- On-chain state (verified Feb 9, 2026):
  - `totalSupply()` (rebased): ~347.2M stUSR
  - `totalShares()`: ~307.1B internal shares
  - `underlyingToken()`: USR (`0x66a1e...`)
  - USR held by stUSR contract: ~347.2M (1:1 backing verified)

**wstUSR** is an **ERC-4626 vault** (similar to Lido's wstETH):
- Underlying asset: USR (per `asset()` = `0x66a1e...`)
- wstUSR wraps stUSR internally -- holds ~344.9M stUSR (99.3% of all stUSR)
- Non-rebasing: wstUSR balance stays constant, but `convertToAssets()` increases over time
- Exchange rate on-chain (verified Feb 9, 2026):
  - `convertToAssets(1e18)` = 1.1304 USR per wstUSR
  - `convertToShares(1e18)` = 0.8846 wstUSR per USR
  - `totalAssets()` = ~344.9M USR
  - `totalSupply()` = ~305.1M wstUSR
- `maxDeposit()` = type(uint256).max (no deposit cap)

### Reward Distribution

The **RewardDistributor** contract ([`0xbE23BB6D817C08E7EC4Cd0adB0E23156189c1bA9`](https://etherscan.io/address/0xbE23BB6D817C08E7EC4Cd0adB0E23156189c1bA9)) is responsible for feeding yield to stUSR:
- Mints USR rewards and transfers them to the stUSR contract
- Uses a **drip model**: rewards are linearly vested over a `DRIP_DURATION` period
- `dripReward()` is called to release accrued rewards
- `allocateReward()` is called by a privileged role to set new reward amounts
- Rewards are distributed approximately every 24 hours
- Not a proxy contract (non-upgradeable)

### Accessibility

- **Wrapping/Unwrapping wstUSR**: Permissionless. Anyone can:
  - `deposit(uint256 usrAmount)` → deposit USR, receive wstUSR
  - `wrap(uint256 stUSRAmount)` → wrap stUSR, receive wstUSR
  - `unwrap(uint256 wstUSRAmount)` → burn wstUSR, receive stUSR
  - `redeem(uint256 wstUSRAmount)` → burn wstUSR, receive USR
- **Staking USR to stUSR**: Permissionless. Anyone can deposit USR into stUSR.
- **Minting/Redeeming USR**: Requires **allowlisted wallets** (whitelisted by Resolv Digital Assets Ltd). Uses `requestMint()`/`requestBurn()` flow on USR Requests Manager.
- **Atomic operations**: Wrapping/unwrapping wstUSR and staking/unstaking stUSR are atomic single-transaction operations. Minting/redeeming USR is a multi-step backend process (1-24h).
- **Fees**: No fees for wrap/unwrap or stake/unstake operations.

### Collateralization

- **wstUSR backing**: wstUSR is 100% backed by stUSR, which is 100% backed by USR. Verified on-chain: stUSR contract holds ~347.2M USR for ~347.2M stUSR supply.
- **USR backing**: USR is >100% collateralized by the delta-neutral collateral pool (ETH, BTC, stETH, stablecoins, RWAs). Excess collateral above 100% backs RLP.
- **No leverage**: wstUSR does not add leverage -- it is a direct wrapper around the staked stablecoin.
- **Risk hierarchy**: Unlike RLP, wstUSR is in the **senior tranche** -- RLP absorbs all losses before any impact to USR/stUSR/wstUSR holders.

### Provability

- **wstUSR exchange rate**: Calculated **programmatically on-chain** via ERC-4626 `convertToAssets()`/`convertToShares()`. Based on `stUSR.totalSupply()` / `stUSR.totalShares()` ratio. Anyone can verify.
- **stUSR backing**: USR held by stUSR contract is fully on-chain and verifiable. `USR.balanceOf(stUSR) == stUSR.totalSupply()` (verified).
- **Reward distribution**: The RewardDistributor drip schedule is observable on-chain. The amount and frequency of reward allocations are controlled by a privileged role.
- **Underlying USR collateral**: Verified via [Apostro dashboard](https://info.apostro.xyz/resolv-reserves) and [protocol collateral pool dashboard](https://app.resolv.xyz/collateral-pool).

## Liquidity Risk

### Primary Exit Mechanisms

1. **Unwrap to stUSR → Unstake to USR**: Atomic operations. wstUSR → stUSR → USR, all permissionless and instant.
2. **Redeem USR to USDC/USDT/ETH**: Uses USR Requests Manager. Requires whitelist. Processed within 1-24 hours by backend.
3. **DEX swap**: Sell wstUSR directly on Curve, Fluid, Balancer, or other DEXes.

### DEX Liquidity (Feb 9, 2026, via DeFiLlama & CoinGecko)

| Protocol | Chain | Pool | TVL | 7d Volume |
|----------|-------|------|-----|-----------|
| Curve | Ethereum | DOLA-wstUSR | $37.3M | $3.8M |
| Fluid DEX | Ethereum | wstUSR-USDC | $3.7M | $15.8M |
| Fluid DEX | Arbitrum | wstUSR-USDC | $591K | $1.4M |
| Fluid DEX | Base | USDC-wstUSR | $403K | $1.5M |
| **Total DEX** | | | **~$42.2M** | **~$22.5M/7d** |

### Lending Market Integrations (wstUSR as collateral)

| Protocol | Chain | TVL | Notes |
|----------|-------|-----|-------|
| Fluid Lending | Ethereum | $65.5M + $34.3M + $333K | wstUSR/USDC, wstUSR/USDT, wstUSR/GHO pairs |
| Fluid Lending | Arbitrum | $11.7M + $7.5M | wstUSR/USDT, wstUSR/USDC pairs |
| Morpho | Arbitrum | $4.6M + $1.2M | wstUSR collateral vaults |
| Morpho | Ethereum | $25K | wstUSR collateral vault |
| **Total Lending** | | **~$125.1M** | |

### Additional DeFi Integrations

| Protocol | Chain | TVL | Notes |
|----------|-------|-----|-------|
| Convex | Ethereum | $37.2M | DOLA-wstUSR Curve LP |
| Inverse Finance (FiRM) | Ethereum | $37.2M + $2.2M | DOLA-wstUSR lending + Yearn vault |
| Pendle | Ethereum | $118K | wstUSR yield tokenization |
| Rheo | Ethereum | $1.3M | PT-wstUSR-29JAN2026 |
| StakeDAO | Ethereum | $20K | DOLA-wstUSR |
| Yearn | Ethereum | $69K | DOLA-wstUSR vault |
| **Total Additional** | | **~$78.1M** | |

### Liquidity Summary

- **Total wstUSR/stUSR DeFi TVL**: ~$593M across 25 pools (DeFiLlama)
- **24h Trading Volume**: ~$2.6M (CoinGecko)
- **Primary liquidity**: Fluid (lending + DEX), Curve DOLA-wstUSR pool
- **Instant unwrap**: wstUSR → stUSR → USR is atomic and permissionless (no delay)
- **USR redemption**: 1-24h via backend, requires whitelist
- **Multi-chain**: Available on Ethereum (primary), Arbitrum, Base, Plasma via LayerZero OFT

## Centralization & Control Risks

### Governance

- **Multisig**: All core contracts controlled by a **3-of-5 Gnosis Safe** at [`0xd6889f307be1b83bb355d5da7d4478fb0d2af547`](https://etherscan.io/address/0xd6889f307be1b83bb355d5da7d4478fb0d2af547). Controls `DEFAULT_ADMIN_ROLE` for stUSR, wstUSR, USR, RewardDistributor, and all infrastructure contracts.
- **Timelock**: A 3-day OpenZeppelin `TimelockController` at [`0x290d9544669c9c7a64f6899a0a3b28d563f6ebee`](https://etherscan.io/address/0x290d9544669c9c7a64f6899a0a3b28d563f6ebee) owns all ProxyAdmin contracts. **Contract upgrades require a 3-day delay**.
- **ProxyAdmins**: stUSR ProxyAdmin at [`0xeb88058615eaf3e4833af053484012c4d6cbfa37`](https://etherscan.io/address/0xeb88058615eaf3e4833af053484012c4d6cbfa37), wstUSR ProxyAdmin at [`0xD89784610EefD4d11444788F7A85AaDfd57AF7E5`](https://etherscan.io/address/0xD89784610EefD4d11444788F7A85AaDfd57AF7E5). Both owned by the timelock.
- **Split architecture**: Multisig controls **operational parameters directly** (no delay) -- pausing, role grants, parameter changes. Timelock only gates **proxy upgrades**.
- **On-chain governance not yet live**: stRESOLV token exists but Snapshot voting has not been initiated.
- **All 5 signers are EOAs** (not publicly identified).

### Programmability

- **wstUSR exchange rate**: Fully programmatic. Calculated on-chain via ERC-4626 standard: `convertToAssets()` = stUSR totalSupply / totalShares. No admin input needed for exchange rate.
- **stUSR rebasing**: Programmatic based on USR balance in the contract. When RewardDistributor drips USR, balances rebase automatically.
- **Reward distribution**: Controlled by a **privileged role** on the RewardDistributor. The `allocateReward()` function is called by an admin to set reward amounts. The drip schedule is then programmatic.
- **Wrapping/unwrapping**: Fully programmatic, no admin involvement.

### External Dependencies

- **USR stability**: wstUSR's value is fundamentally tied to USR maintaining its $1 peg. USR is backed by the delta-neutral collateral pool.
- **RewardDistributor**: A single non-proxy contract controlled by the multisig. If it stops distributing rewards, wstUSR exchange rate stops growing (no loss of principal, just no yield).
- **LayerZero**: Used for cross-chain bridging of wstUSR (OFT standard).
- **Underlying collateral dependencies**: Same as the broader Resolv protocol -- CEX counterparty risk (Binance, Deribit, Bybit), DeFi integrations (Aave, Lido, EtherFi), oracle providers (Pyth, Chainlink, Chronicle, RedStone).

## Operational Risk

- **Team Transparency**: Team is **partially doxxed** via CoinGecko (Ivan Kozlov CEO, Tim Shekikhachev CPO, Fedor Chmilev CTO with LinkedIn/Twitter). Not prominently displayed on protocol website.
- **Company founded**: 2023 (Resolv Labs).
- **Legal Structure**: Two BVI entities: **Resolv Labs Ltd** (frontend/app) and **Resolv Digital Assets Ltd (RDAL)** (token issuance, collateral pool). A **Resolv Foundation** manages protocol revenue.
- **Jurisdiction**: British Virgin Islands (BVI).
- **Investors**: $10M seed round led by Cyber Fund and Maven 11. Other investors: Coinbase Ventures, Arrington Capital, Robot Ventures, Animoca Brands, Ether.fi.
- **Documentation**: Comprehensive litepaper at [docs.resolv.xyz](https://docs.resolv.xyz/). Quarterly reports and parameter updates published.
- **Incident Response**: No documented incident response plan found. Bug bounty and on-chain monitoring exist.

## Monitoring

### wstUSR Exchange Rate Monitoring

- **wstUSR contract**: [`0x1202F5C7b4B9E47a1A484E8B270be34dbbC75055`](https://etherscan.io/address/0x1202F5C7b4B9E47a1A484E8B270be34dbbC75055)
  - Monitor `convertToAssets(1e18)` for exchange rate changes. Current: ~1.1304 USR/wstUSR.
  - **Alert**: If exchange rate **decreases** (should only ever increase). Any decrease indicates a potential issue with the stUSR contract or reward distribution.
  - **Alert**: If exchange rate growth **stops** for >48 hours (indicates RewardDistributor has stopped dripping rewards).
  - Monitor `Deposit`, `Withdraw` events for large deposits/withdrawals (>$1M).
  - **Threshold**: Alert on single deposits/withdrawals >$5M (potential whale activity or stress signals).

### stUSR Backing Verification

- **stUSR contract**: [`0x6c8984bc7DBBeDAf4F6b2FD766f16eBB7d10AAb4`](https://etherscan.io/address/0x6c8984bc7DBBeDAf4F6b2FD766f16eBB7d10AAb4)
  - Monitor `USR.balanceOf(stUSR)` vs `stUSR.totalSupply()`. These should be approximately equal (1:1 backing).
  - **Alert**: If `USR.balanceOf(stUSR) < stUSR.totalSupply() * 0.99` (under-collateralization by >1%).
  - Monitor `totalShares()` and `totalSupply()` for the shares-to-tokens ratio.
  - Monitor `Transfer` events for large movements (>$5M).

### RewardDistributor Monitoring

- **RewardDistributor**: [`0xbE23BB6D817C08E7EC4Cd0adB0E23156189c1bA9`](https://etherscan.io/address/0xbE23BB6D817C08E7EC4Cd0adB0E23156189c1bA9)
  - Monitor `RewardDripped` events -- tracks when rewards are released to stUSR.
  - **Alert**: If no `RewardDripped` event for >48 hours (rewards should drip approximately daily).
  - Monitor `RewardAllocated` events -- tracks when new reward amounts are set.
  - **Threshold**: Alert if allocated reward amount changes by >50% from previous allocation (significant yield change).
  - Monitor USR balance of RewardDistributor -- this is the pending rewards to be dripped.

### Governance & Proxy Monitoring

- **Multisig**: [`0xd6889f307be1b83bb355d5da7d4478fb0d2af547`](https://etherscan.io/address/0xd6889f307be1b83bb355d5da7d4478fb0d2af547)
  - Monitor for owner changes, threshold changes, module additions.
  - **Alert**: Immediately on any signer replacement or threshold change.

- **Timelock**: [`0x290d9544669c9c7a64f6899a0a3b28d563f6ebee`](https://etherscan.io/address/0x290d9544669c9c7a64f6899a0a3b28d563f6ebee)
  - Monitor `CallScheduled`, `CallExecuted`, `Cancelled` events.
  - **Alert**: Immediately on any `CallScheduled` event (3-day window to review proxy upgrades).
  - Cross-reference scheduled calls against stUSR ProxyAdmin (`0xeb8805...`) and wstUSR ProxyAdmin (`0xD89784...`) addresses.

- **stUSR ProxyAdmin**: [`0xeb88058615eaf3e4833af053484012c4d6cbfa37`](https://etherscan.io/address/0xeb88058615eaf3e4833af053484012c4d6cbfa37)
  - Monitor for `Upgraded` events on stUSR proxy (implementation change).
  - **Alert**: Immediately on any implementation change.

- **wstUSR ProxyAdmin**: [`0xD89784610EefD4d11444788F7A85AaDfd57AF7E5`](https://etherscan.io/address/0xD89784610EefD4d11444788F7A85AaDfd57AF7E5)
  - Monitor for `Upgraded` events on wstUSR proxy (implementation change).
  - **Alert**: Immediately on any implementation change.

### Liquidity Monitoring

- **Curve DOLA-wstUSR pool**: Monitor TVL. Current: ~$37.3M.
  - **Alert**: If pool TVL drops below $10M (liquidity deterioration).
  - **Alert**: If pool imbalance exceeds 80/20 in either direction (potential depegging pressure).

- **Fluid lending markets** (Ethereum):
  - wstUSR/USDC: TVL $65.5M
  - wstUSR/USDT: TVL $34.3M
  - **Alert**: If utilization rate exceeds 98% (liquidity crunch risk).
  - **Alert**: If wstUSR collateral liquidations occur (signals stress).

- **CoinGecko wstUSR price**: Monitor for deviations from expected exchange rate.
  - **Alert**: If CoinGecko price deviates >2% from on-chain `convertToAssets()` * USR_price (indicates market mispricing or DEX imbalance).

### USR Collateral Pool Monitoring

- **USR Collateralization Ratio**: Monitor via [Apostro dashboard](https://info.apostro.xyz/resolv-reserves).
  - **Alert**: If CR drops below 120% (approaching stress levels for the entire Resolv system).
  - **Alert**: If CR drops below 110% (RLP redemption gate triggers -- indirect impact on wstUSR if USR confidence is shaken).
- **USR Peg**: Monitor USR price on DEXes.
  - **Alert**: If USR deviates >0.5% from $1.00 peg (significant depegging).
  - **Alert**: If USR deviates >2% from $1.00 peg (critical depegging -- wstUSR value directly impacted).

### Monitoring Frequency

| Category | Frequency | Priority |
|----------|-----------|----------|
| Timelock scheduled calls | Real-time | Critical |
| Proxy upgrade events | Real-time | Critical |
| Multisig signer changes | Real-time | Critical |
| wstUSR exchange rate | Every 6 hours | High |
| stUSR backing (USR balance) | Every 6 hours | High |
| RewardDistributor drip events | Daily | High |
| USR peg stability | Hourly | High |
| DEX pool TVL/balance | Hourly | Medium |
| Lending market utilization | Hourly | Medium |
| USR Collateralization Ratio | Daily | Medium |

## Risk Summary

### Key Strengths

- **Programmatic exchange rate**: Unlike RLP (where price is set off-chain), wstUSR exchange rate is computed on-chain via ERC-4626 standard. Anyone can verify.
- **Senior tranche**: wstUSR/stUSR holders are protected by RLP, which absorbs all losses before USR is affected. wstUSR is fundamentally a yield-bearing wrapper around a USD-pegged stablecoin.
- **Extensive audit coverage**: wstUSR specifically audited by Pashov, Pessimistic, and Sherlock. 14+ total protocol audits.
- **Permissionless wrapping**: No whitelist needed to wrap/unwrap wstUSR/stUSR. Only minting/redeeming USR requires whitelist.
- **Strong DeFi adoption**: ~$593M TVL across 25 pools. Integrated with Fluid, Curve, Morpho, Pendle, Balancer V3, Convex, Yearn.
- **1:1 stUSR backing verified on-chain**: USR.balanceOf(stUSR) == stUSR.totalSupply() (verified Feb 9, 2026).

### Key Risks

- **Centralized reward distribution**: The RewardDistributor is controlled by the multisig. If rewards stop, wstUSR exchange rate stops growing.
- **Upgradeable proxies**: Both stUSR and wstUSR are upgradeable (3-day timelock for implementation changes). A malicious upgrade could compromise funds.
- **USR peg dependency**: wstUSR value is fundamentally tied to USR maintaining its $1 peg. Any USR depegging directly impacts wstUSR.
- **Whale frontrunning acknowledged**: The known issue where MEV bots can frontrun reward distributions for stUSR has been acknowledged but not fixed.
- **Underlying collateral risks**: wstUSR inherits all risks of the Resolv collateral pool (CEX counterparty, funding rate volatility, etc.), albeit protected by RLP as first-loss capital.

### Critical Risks

- **Proxy upgrade with 3-day timelock**: While the timelock provides a review window, the 3-of-5 anonymous signers could propose a malicious upgrade. The 3-day window is the only safeguard.
- **RewardDistributor is not upgradeable** but is controlled by the multisig for allocating rewards. If the multisig is compromised, reward allocation could be manipulated (though this would affect yield, not principal).

---

## Risk Score Assessment

**Scoring Guidelines:**
- Be conservative: when uncertain between two scores, choose the higher (riskier) one
- Use decimals (e.g., 2.5) when a subcategory falls between scores
- Prioritize on-chain evidence over documentation claims

### Critical Risk Gates

- [x] **No audit** -- wstUSR specifically audited by 3 firms (Pashov, Pessimistic, Sherlock). Protocol has 14+ total audits. **PASS**
- [x] **Unverifiable reserves** -- stUSR backing verified on-chain (USR.balanceOf(stUSR) == totalSupply). wstUSR exchange rate programmatic via ERC-4626. **PASS**
- [x] **Total centralization** -- 3-of-5 Gnosis Safe multisig. 3-day timelock for upgrades. Not a single EOA. **PASS**

**All gates pass.** Proceed to category scoring.

### Category Scores

#### Category 1: Audits & Historical Track Record (Weight: 20%)

- **Audits**: 4 audit firms (MixBytes, Pashov, Sherlock, Pessimistic), 14+ engagements. wstUSR specifically audited in 3 separate engagements. Dedicated wstUSR audit found 7 issues (all resolved). Sherlock contest found inflation attack (fixed).
- **Bug Bounty**: $500K max on Immunefi (Primacy of Impact). wstUSR/stUSR in scope.
- **Time in Production**: ~17 months (Sep 2024 - Feb 2026).
- **TVL**: ~$344.8M wstUSR market cap, ~$593M in DeFi integrations.
- **Incidents**: None reported.

**Score: 1.5/5** -- Exceptional audit coverage with wstUSR specifically reviewed by 3 firms. Strong bug bounty ($500K). >1 year production with >$100M TVL and no incidents. Known issues (frontrunning, ERC-4626 compliance) acknowledged and managed.

#### Category 2: Centralization & Control Risks (Weight: 30%)

**Subcategory A: Governance**

- **3-of-5 Gnosis Safe** multisig controls all contracts.
- **3-day timelock** for proxy upgrades (stUSR and wstUSR are both upgradeable proxies).
- Operational parameters (pause, role grants) controlled by multisig **directly without timelock**.
- No on-chain governance live yet.
- All 5 signers anonymous EOAs.

**Governance Score: 3.5** -- Same governance structure as broader Resolv protocol. 3/5 multisig with 3-day upgrade timelock is adequate but operational parameters lack delay.

**Subcategory B: Programmability**

- **wstUSR exchange rate**: Fully on-chain, programmatic (ERC-4626). Significant improvement over RLP.
- **stUSR rebase**: Programmatic based on USR in contract.
- **Reward distribution**: Admin-controlled allocation, but drip schedule is programmatic.
- **Wrapping/unwrapping**: Fully programmatic, no admin involvement.

**Programmability Score: 2.5** -- wstUSR itself is highly programmatic (ERC-4626 on-chain exchange rate), but reward allocation is admin-controlled. Significantly better than RLP's fully off-chain pricing.

**Subcategory C: External Dependencies**

- USR stability depends on the delta-neutral collateral pool
- 3 CEXes + 1 DEX for hedging (inherited from USR)
- LayerZero for cross-chain bridging
- DeFi integrations (Aave, Lido, EtherFi) for yield

**Dependencies Score: 3.0** -- Inherits USR's dependency profile (CEX counterparty, multiple custodians). wstUSR itself adds no additional critical dependencies beyond the stUSR/USR contracts.

**Centralization Score = (3.5 + 2.5 + 3.0) / 3 = 3.0**

**Score: 3.0/5** -- Improved over RLP due to programmatic exchange rate. Still constrained by centralized reward distribution and multisig control without timelocked operational parameters.

#### Category 3: Funds Management (Weight: 30%)

**Subcategory A: Collateralization**

- wstUSR → stUSR → USR: Each layer is 100% backed and verifiable on-chain.
- stUSR holds exactly as much USR as its total supply (verified on-chain).
- wstUSR is an ERC-4626 vault with no leverage.
- **Senior tranche**: RLP absorbs losses before USR/stUSR/wstUSR are impacted.
- Underlying USR collateral is a mix of on-chain (ETH, stETH, stablecoins) and off-chain (CEX margin ~15%).

**Collateralization Score: 2.0** -- 100% on-chain verifiable backing for stUSR→USR. Senior tranche protection via RLP. Mixed quality underlying assets (including CEX margin), but wstUSR itself is purely on-chain.

**Subcategory B: Provability**

- wstUSR exchange rate: programmatic on-chain (ERC-4626).
- stUSR backing: fully verifiable (USR.balanceOf(stUSR)).
- Reward allocation: admin-controlled but drip is on-chain.
- Underlying USR collateral: Apostro third-party dashboard + self-reporting.

**Provability Score: 2.0** -- wstUSR and stUSR layers are fully on-chain verifiable. Underlying USR collateral has hybrid on-chain/off-chain provability (same as broader Resolv).

**Funds Management Score = (2.0 + 2.0) / 2 = 2.0**

**Score: 2.0/5** -- Significantly better than RLP. wstUSR/stUSR layers are fully on-chain and verifiable. Underlying USR has hybrid on-chain/off-chain backing but is senior tranche (protected by RLP).

#### Category 4: Liquidity Risk (Weight: 15%)

- **Exit Mechanism**: wstUSR → stUSR → USR is atomic and permissionless (instant). USR → USDC/USDT requires whitelist and 1-24h.
- **DEX Liquidity**: ~$42.2M in DEX pools, ~$22.5M/week trading volume. Curve DOLA-wstUSR is deepest at $37.3M.
- **Lending Markets**: ~$125.1M in lending markets (Fluid, Morpho). Highly integrated.
- **Multi-chain**: Available on Ethereum, Arbitrum, Base.
- **Same-value redemption**: wstUSR redeems for USR (stablecoin) -- no variable pricing risk on exit.

**Score: 2.0/5** -- Instant atomic unwrap to USR (stablecoin). Strong DEX liquidity ($42.2M) and lending market depth ($125.1M). Same-value asset (stablecoin-denominated). Minor friction for final USR→fiat step (whitelist, 1-24h delay). Excellent DeFi integration.

#### Category 5: Operational Risk (Weight: 5%)

- **Team**: Partially doxxed (CoinGecko), strong investors ($10M seed).
- **Documentation**: Comprehensive.
- **Legal Structure**: Two BVI entities + Foundation.
- **Incident Response**: No documented plan.

**Score: 2.5/5** -- Same as broader Resolv protocol. Partially identifiable team, strong investors, good documentation. BVI jurisdiction, no documented incident response.

### Final Score Calculation

```
Final Score = (Centralization × 0.30) + (Funds Mgmt × 0.30) + (Audits × 0.20) + (Liquidity × 0.15) + (Operational × 0.05)
```

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Audits & Historical | 1.5 | 20% | 0.30 |
| Centralization & Control | 3.0 | 30% | 0.90 |
| Funds Management | 2.0 | 30% | 0.60 |
| Liquidity Risk | 2.0 | 15% | 0.30 |
| Operational Risk | 2.5 | 5% | 0.125 |
| **Final Score** | | | **2.225** |

**Final Score: 2.2**

### Risk Tier

| Final Score | Risk Tier | Recommendation |
|------------|-----------|----------------|
| **1.5-2.5** | **Low Risk** | Approved with standard monitoring |

**Final Risk Tier: Low Risk**

---

wstUSR is a well-audited, programmatically-priced ERC-4626 vault wrapping staked USR. Its exchange rate is fully on-chain and verifiable, significantly distinguishing it from RLP which relies on off-chain pricing. As a wrapper around the senior tranche of Resolv's protocol (USR/stUSR), wstUSR holders benefit from RLP's first-loss protection. The 1:1 stUSR→USR backing is verified on-chain. Strong DeFi adoption (~$593M across 25 pools) provides excellent exit liquidity. Key residual risks are the centralized reward distribution (admin-controlled), upgradeable proxy contracts (3-day timelock), and inherited dependency on USR peg stability and the underlying delta-neutral collateral pool.

**Key conditions for exposure:**
- Monitor wstUSR exchange rate for any decreases (should only increase)
- Monitor stUSR backing ratio (USR.balanceOf(stUSR) vs totalSupply)
- Monitor RewardDistributor for regular drip events (should occur ~daily)
- Monitor timelock for any scheduled proxy upgrades (3-day review window)
- Track USR peg stability and overall Resolv collateralization ratio

---

## Reassessment Triggers

- **Time-based**: Reassess in 6 months (August 2026)
- **Governance-based**: Reassess when on-chain governance is activated
- **Incident-based**: Reassess after any exploit, governance change, or collateral modification
- **Peg-based**: Reassess if USR deviates >2% from $1.00 peg
