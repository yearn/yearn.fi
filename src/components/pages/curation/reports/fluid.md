# Protocol Risk Assessment: Fluid Lending Protocol

- **Assessment Date:** February 12, 2026
- **Token:** fTokens (fUSDC, fUSDT, fWETH)
- **Chain:** Ethereum Mainnet
- **Token Address:** [`0x9Fb7b4477576Fe5B32be4C1843aFB1e55F251B33`](https://etherscan.io/address/0x9Fb7b4477576Fe5B32be4C1843aFB1e55F251B33) (fUSDC)
- **Final Score: 1.1/5.0**

## Overview + Links

This assessment focuses on the **Fluid Lending Protocol (fTokens)** — an ERC4626-compliant lending product built on top of Fluid's unified Liquidity Layer. Users supply assets (USDC, USDT, WETH, wstETH, etc.) and receive fTokens representing their share of the lending pool. Yield is generated from borrower interest via the Vault Protocol.

**Architecture dependency chain relevant to lending risk:**

```
fTokens (Lending Protocol)
    ↓ deposits/withdraws via
Liquidity Layer (central fund store, 0x52Aa...)
    ↑ borrows against collateral
Vault Protocol (borrowers, liquidations, oracles)
```

fToken holders are exposed to risks across this entire stack: the Lending Protocol itself, the Liquidity Layer that holds all funds, and the Vault Protocol whose borrowers generate the yield. The DEX Protocol and stETH Protocol also interact with the Liquidity Layer but are secondary dependencies.

Fluid is governed by FLUID token holders via on-chain GovernorBravo governance with a 1-day Timelock. The protocol was developed by Instadapp Labs and launched in February 2024.

**Links:**

- [Protocol Documentation](https://docs.fluid.instadapp.io/)
- [Protocol App](https://fluid.io/)
- [Security/Audits Page](https://docs.fluid.instadapp.io/audits-and-security.html)
- [GitHub (Public Contracts)](https://github.com/Instadapp/fluid-contracts-public)
- [Deployments](https://github.com/Instadapp/fluid-contracts-public/blob/main/deployments/deployments.md)
- [Governance Forum](https://gov.instadapp.io/)
- [Snapshot Governance](https://snapshot.org/#/instadapp-gov.eth)
- [DeFiLlama — Fluid Lending](https://defillama.com/protocol/fluid-lending)

## Contract Addresses (Ethereum Mainnet)

All contracts verified on Etherscan. Compiled with Solidity 0.8.21.

### fToken Contracts (Lending)

| fToken | Address | Underlying | Underlying Address |
|--------|---------|------------|--------------------|
| **fUSDC** | [`0x9Fb7b4477576Fe5B32be4C1843aFB1e55F251B33`](https://etherscan.io/address/0x9Fb7b4477576Fe5B32be4C1843aFB1e55F251B33) | USDC | [`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`](https://etherscan.io/address/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48) |
| **fUSDT** | [`0x5C20B550819128074FD538Edf79791733ccEdd18`](https://etherscan.io/address/0x5C20B550819128074FD538Edf79791733ccEdd18) | USDT | [`0xdAC17F958D2ee523a2206206994597C13D831ec7`](https://etherscan.io/address/0xdAC17F958D2ee523a2206206994597C13D831ec7) |
| **fWETH** | [`0x90551c1795392094FE6D29B758EcCD233cFAa260`](https://etherscan.io/address/0x90551c1795392094FE6D29B758EcCD233cFAa260) | WETH | [`0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`](https://etherscan.io/address/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2) |
| **fwstETH** | [`0x2411802D8BEA09be0aF8fD8D08314a63e706b29C`](https://etherscan.io/address/0x2411802D8BEA09be0aF8fD8D08314a63e706b29C) | wstETH | [`0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0`](https://etherscan.io/address/0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0) |
| **fGHO** | [`0x6A29A46E21C730DcA1d8b23d637c101cec605C5B`](https://etherscan.io/address/0x6A29A46E21C730DcA1d8b23d637c101cec605C5B) | GHO | [`0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f`](https://etherscan.io/address/0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f) |
| **fsUSDS** | [`0x2BBE31d63E6813E3AC858C04dae43FB2a72B0D11`](https://etherscan.io/address/0x2BBE31d63E6813E3AC858C04dae43FB2a72B0D11) | sUSDS | [`0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD`](https://etherscan.io/address/0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD) |
| **fUSDtb** | [`0x15e8c742614b5D8Db4083A41Df1A14F5D2bFB400`](https://etherscan.io/address/0x15e8c742614b5D8Db4083A41Df1A14F5D2bFB400) | USDtb | [`0xC139190F447e929f090Edeb554D95AbB8b18aC1C`](https://etherscan.io/address/0xC139190F447e929f090Edeb554D95AbB8b18aC1C) |

### fToken On-Chain State (Ethereum Mainnet, as of Feb 2026)

| fToken | Total Assets | Exchange Rate | Supply Rate | Approx TVL |
|--------|-------------|---------------|-------------|------------|
| fUSDC | 274.8M USDC | 1.1853 | 4.59% | ~$274.8M |
| fUSDT | 167.5M USDT | 1.1788 | 3.99% | ~$167.5M |
| fGHO | 42.3M GHO | 1.0975 | 7.32% | ~$42.3M |
| fwstETH | 2,874 wstETH | 1.0381 | 0.26% | ~$8.9M |
| fUSDtb | 5.8M USDtb | 1.0171 | 1.82% | ~$5.8M |
| fWETH | 1,773 WETH | 1.0682 | 2.56% | ~$4.7M |
| fsUSDS | 15,025 sUSDS | 1.0021 | 0.00% | ~$15.8K |
| **Total Ethereum fTokens** | | | | **~$504M** |

All exchange rates are >1.0, confirming accumulated yield since launch. No rewards programs currently active on any fToken — yields are purely organic from supply/borrow spreads.

### Core Infrastructure (Dependency for Lending)

- **Liquidity Layer**: [`0x52Aa899454998Be5b000Ad077a46Bbe360F4e497`](https://etherscan.io/address/0x52Aa899454998Be5b000Ad077a46Bbe360F4e497) — Central contract holding all funds. Upgradeable proxy (Instadapp Infinite Proxy) with AdminModule and UserModule.
- **LendingFactory**: [`0x54B91A0D94cb471F37f949c60F7Fa7935b551D03`](https://etherscan.io/address/0x54B91A0D94cb471F37f949c60F7Fa7935b551D03) — Creates fToken markets. Owner: Timelock.
- **Timelock**: [`0x2386DC45AdDed673317eF068992F19421B481F4c`](https://etherscan.io/address/0x2386DC45AdDed673317eF068992F19421B481F4c) — Owner of Liquidity Layer, LendingFactory, VaultFactory, DexFactory. 1-day delay.
- **GovernorBravo**: [`0x0204Cd037B2ec03605CFdFe482D8e257C765fA1B`](https://etherscan.io/address/0x0204Cd037B2ec03605CFdFe482D8e257C765fA1B) — On-chain governance. 117 proposals executed.
- **Avocado Multisig**: [`0x4F6F977aCDD1177DCD81aB83074855EcB9C2D49e`](https://etherscan.io/address/0x4F6F977aCDD1177DCD81aB83074855EcB9C2D49e) — Timelock guardian (cancel-only). Also owns DeployerFactory.
- **FLUID Token**: [`0x6f40d4A6237C257fff2dB00FA0510DeEECd303eb`](https://etherscan.io/address/0x6f40d4A6237C257fff2dB00FA0510DeEECd303eb) — Governance token. 100M max supply, ~77.5M circulating.

### Resolvers (Read-Only Periphery)

- **FluidLiquidityResolver**: [`0xD7588F6c99605Ab274C211a0AFeC60947668A8Cb`](https://etherscan.io/address/0xD7588F6c99605Ab274C211a0AFeC60947668A8Cb) — Active resolver for supply/borrow rates, exchange prices, rate model params
- **RevenueResolver**: [`0x0A84741D50B4190B424f57425b09FAe60C330F32`](https://etherscan.io/address/0x0A84741D50B4190B424f57425b09FAe60C330F32)

## Audits and Due Diligence Disclosures

Fluid has undergone **8 distinct security audits** across 4 audit firms, covering all major protocol components. The Lending Protocol was covered in the PeckShield and StateMind full-protocol audits. The Liquidity Layer (critical dependency for lending) was audited by both MixBytes and StateMind in 2025 using a dual-audit approach. All audit reports are available on the [audits and security page](https://docs.fluid.instadapp.io/audits-and-security.html).

| # | Firm | Date | Scope | Critical | High | Medium | Low | Info | Total |
|---|------|------|-------|----------|------|--------|-----|------|-------|
| 1 | PeckShield | Nov 2023 | Full Protocol (incl. Lending) | 0 | 4 | 4 | 5 | 0 | 13 |
| 2 | StateMind | Oct–Dec 2023 | Full Protocol (incl. Lending) | 3 | 8 | 15 | 0 | 40 | 66 |
| 3 | MixBytes | Mar–Jun 2024 | Vault Protocol | 0 | 0 | 2 | 4 | 0 | 6 |
| 4 | Cantina | Sep–Oct 2024 | DEX Protocol | 0 | 0 | 2 | 7 | 4 | 13 |
| 5 | MixBytes | Oct 2024 | DEX Protocol | 0 | 0 | 0 | 3 | 0 | 3 |
| 6 | MixBytes | Sep–Dec 2025 | Liquidity Layer | 0 | 0 | 0 | 2 | 0 | 2 |
| 7 | StateMind | Sep–Oct 2025 | Liquidity Layer | 0 | 1 | 0 | 0 | 4 | 5 |
| **Total** | | | | **3** | **13** | **23** | **21** | **48** | **108** |

**Lending-relevant audit details:**

- **PeckShield — Full Protocol** ([report](https://docs.fluid.instadapp.io/Peckshield_Fluid_Audit.pdf)): Covered lending/fToken contracts. All 13 issues resolved (12 resolved, 1 mitigated — "Trust Issue of Admin Keys").
- **StateMind — Full Protocol** ([report](https://docs.fluid.instadapp.io/Statemind_Fluid_Audit.pdf)): Covered Lending/iTokens (now fTokens), Liquidity Layer, Vaults, Oracles. Critical finding: **LendingRewardRateModel returns rate with incorrect decimals** (pool-draining risk) — **fixed**. Also: incorrect supplyExchangePrice calculation, DOS of iToken markets — **all fixed**.
- **MixBytes — Liquidity Layer** ([report](https://docs.fluid.instadapp.io/MixBytes_Fluid_Liquidity_Audit.pdf)): Directly impacts lending withdrawal/supply mechanics. 2 Low findings.
- **StateMind — Liquidity Layer Updates** ([report](https://docs.fluid.instadapp.io/Statemind_Fluid_Liquidity_Updates_Audit.pdf)): 1 High: incorrect net transfer calculation causing user overpayment — **fixed**.
- **MixBytes — Vault Protocol** ([report](https://docs.fluid.instadapp.io/Mixbytes_Fluid_Vault_Protocol_Audit.pdf)): Vault borrowers generate fToken yield. Relevant for lending counterparty risk. Insufficient reentrancy protection — **fixed**.

No formal verification (Certora, Halmos, etc.) has been performed.

### Bug Bounty

[Immunefi Bug Bounty Program](https://immunefi.com/bug-bounty/instadapp/) — Active program under the "Instadapp" name. Last updated 2024-12-15. **Fluid Lending Protocol is explicitly in scope.**

| Category | Severity | Min Reward | Max Reward | Calculation |
|----------|----------|------------|------------|-------------|
| Smart Contract | Critical | $25,000 | $500,000 | 10% of directly affected funds |
| Smart Contract | High | $5,000 | $100,000 | 50% of affected funds value |
| Web/App | Critical | $5,000 | $50,000 | Range model |
| Web/App | High | $5,000 | $10,000 | Range model |

**Fluid scope**: Liquidity Layer, **Lending Protocol**, Vault Protocol (excluding periphery folder). [Source repo](https://github.com/Instadapp/fluid-contracts-public).

**Payment**: USDC, USDT, or DAI on Ethereum. Medium/Low severity levels are not in scope.

## Historical Track Record

- **Production History**: Fluid launched on Ethereum mainnet on **February 20, 2024** (first TVL recorded). The protocol has been in production for approximately **~2 years** (722 days as of February 2026).
- **Lending TVL**: **$1.28B** across all chains (88.7% of Fluid's total $1.45B TVL). Lending is the dominant product. TVL peaked at $2.68B (Oct 2025). TVL maintained >$500M for over 1.5 years.
- **Multi-chain Lending Deployment**:

| Chain | Lending Supply TVL | % of Lending | Borrowed | Utilization |
|-------|-------------------|--------------|----------|-------------|
| Ethereum | $718.9M | 56.1% | $682.7M | **95.0%** |
| Plasma | $366.9M | 28.6% | $279.3M | 76.1% |
| Arbitrum | $146.7M | 11.4% | $77.9M | 53.1% |
| Base | $43.2M | 3.4% | $20.0M | 46.3% |
| Polygon | $5.4M | 0.4% | $2.6M | 47.8% |
| **Total** | **$1.28B** | **100%** | **$1.06B** | **82.9%** |

- **Incidents**: **No reported security incidents or exploits** found. Not listed in DeFi Llama hacks database. No rekt.news entries for Fluid or Instadapp.
- **TVL Stability**: Only 1 daily drop >15% in entire history (August 6, 2024, -16.1%, aligned with broader crypto market selloff). Average daily volatility of 2.53% over past 90 days.
- **Instadapp Legacy**: Instadapp has been operating since 2019, maintaining ~$2B TVL through 2023. Fluid represents the team's most ambitious protocol built on years of DeFi infrastructure experience.

## Funds Management

### How fTokens Work

fTokens are **ERC4626-compliant vault tokens**. When a user deposits an underlying asset (e.g., USDC), the fToken contract:

1. Calls `LIQUIDITY.operate()` to deposit the underlying into the Liquidity Layer
2. The Liquidity Layer triggers a callback; the fToken transfers the underlying via SafeTransfer or Permit2
3. Shares are minted to the user based on the current exchange rate

On withdrawal, the reverse occurs: shares are **burned before** the underlying is withdrawn from the Liquidity Layer (burn-first pattern for safety).

**Exchange rate**: Computed on-chain as `tokenExchangePrice / EXCHANGE_PRICES_PRECISION` (1e12 precision). The rate is monotonically increasing — it can never decrease. It incorporates:
- Yield from the Liquidity Layer (borrower interest)
- Optional rewards from a `LendingRewardsRateModel` (currently **inactive** for all fTokens; yields are purely organic)

**Safety mechanisms in fToken contracts:**
- Custom reentrancy guard (deposit/withdraw/rebalance all protected)
- Callback validation: checks caller = Liquidity AND token = ASSET AND status = ENTERED
- Burn-before-withdraw pattern
- BigMath precision with SafeCast overflow protection
- Rewards rate capped at 50% APR maximum

### Accessibility

- **Supplying**: Permissionless — anyone can deposit via fTokens. No whitelist required.
- **Redemption**: fToken withdrawals via `withdraw()` or `redeem()` (standard ERC4626). Subject to Liquidity Layer withdrawal limits. If utilization is very high, withdrawals may be temporarily throttled until limits expand or borrows are repaid.
- **Fees**: No explicit deposit/withdrawal fees. Interest rates are algorithmically determined by utilization via a kink-based model.

### Yield Source and Counterparty Risk

fToken yield comes from **borrower interest**. Borrowers use the Vault Protocol to deposit collateral and borrow assets from the Liquidity Layer. This means fToken holders are exposed to:

- **Vault Protocol solvency**: If borrowers default and liquidations fail to recover full value, bad debt could affect lending reserves
- **Liquidation effectiveness**: The tick-based liquidation mechanism must function correctly to prevent bad debt accumulation
- **Oracle correctness**: Vault liquidations depend on Chainlink, UniswapV3 TWAP, and Redstone price feeds. Oracle failures could delay liquidations

**Collateral quality backing fToken yield** (borrower collateral types):
- Blue-chip: ETH, WETH, wstETH, weETH, WBTC, cbBTC
- Stablecoins: USDC, USDT, sUSDe, GHO
- Others: PAXG, XAUt, various LSTs

### Collateralization

- **Backing**: All lending positions are over-collateralized on-chain. Borrowers must maintain collateral ratios (80-95% LTV depending on the pair).
- **Liquidations**: Fully on-chain tick-based mechanism. Liquidation penalty as low as 0.1% for correlated pairs (wstETH/ETH), higher for uncorrelated pairs.
- **Withdrawal Gap**: Extra gap on Liquidity Layer limits reserved for liquidations to ensure they can always execute.

### Provability

- **Transparency**: All reserves are fully on-chain and verifiable via resolver contracts (FluidLiquidityResolver at [`0xD7588F6c99605Ab274C211a0AFeC60947668A8Cb`](https://etherscan.io/address/0xD7588F6c99605Ab274C211a0AFeC60947668A8Cb)).
- **Exchange Rate**: fToken exchange rates are computed programmatically on-chain (ERC4626 standard). No off-chain oracle or admin input needed. Rate is monotonically increasing.
- **Interest Rates**: Algorithmically determined based on utilization. USDC rate model: kink at 85% utilization (5.5% rate), second kink at 93% (8.5%), max rate 40%.
- **Revenue**: Protocol revenue is calculated and verifiable via the RevenueResolver contract.

### Interest Rate Model (USDC example, verified on-chain)

| Parameter | Value |
|-----------|-------|
| Model Type | Kinked (V2) |
| Kink 1 | 85% utilization |
| Rate at Kink 1 | 5.50% |
| Kink 2 | 93% utilization |
| Rate at Kink 2 | 8.50% |
| Max Rate | 40.00% |
| Fee | 10% of spread |

## Liquidity Risk

### Lending-Specific Liquidity Concerns

fToken holders face liquidity risk from the **shared Liquidity Layer** architecture. The Liquidity Layer serves not only lending but also Vaults, DEX, and stETH protocols. This means:

- **Shared pool**: fToken withdrawals compete with all other withdrawal demand on the Liquidity Layer
- **High utilization**: Ethereum lending utilization is **95.0%** (borrowing $682.7M of $718.9M supplied). Overall cross-chain lending utilization is **82.9%**. This is very high.
- **Withdrawal limits**: The Liquidity Layer enforces per-token expandable withdrawal limits. `maxWithdraw()` returns the minimum of: (1) the withdrawal limit at Liquidity, (2) actual liquid balance. If a large withdrawal exceeds the current expanded limit, users must wait for the limit to expand.

### Exit Mechanisms

- **Normal exit**: Call `withdraw()` or `redeem()` on fToken. Subject to available liquidity and withdrawal limits.
- **Secondary market**: fTokens are ERC20 tokens and can be traded on secondary markets, though no significant DEX liquidity for fTokens was observed.
- **Throttled exit**: During high utilization, the expansion-rate mechanism throttles large withdrawals. This prevents bank runs but delays exit for large holders.

### Lending TVL by Asset Type (Ethereum)

| Asset Type | TVL | % of Ethereum Lending |
|------------|-----|----------------------|
| Stablecoins | $368.8M | 51.3% |
| ETH/LSTs | $265.1M | 36.9% |
| BTC tokens | $54.4M | 7.6% |
| Other (Gold, FLUID, etc.) | $30.7M | 4.3% |
| **Total** | **$718.9M** | 100% |

### Top Supply Assets (All Chains)

| Rank | Token | Supply TVL | % of Total |
|------|-------|-----------|------------|
| 1 | wstUSR | $242.5M | 18.9% |
| 2 | wstETH | $130.3M | 10.2% |
| 3 | USDT0 | $125.3M | 9.8% |
| 4 | USDC | $124.4M | 9.7% |
| 5 | weETH | $113.1M | 8.8% |
| 6 | sUSDe | $103.8M | 8.1% |
| 7 | USDT | $77.7M | 6.1% |
| 8 | WBTC | $55.1M | 4.3% |
| 9 | syrupUSDC | $51.3M | 4.0% |
| 10 | syrupUSDT | $51.0M | 4.0% |

**Concentration risk**: wstUSR is the single largest supply asset at 18.9% of total lending TVL. Top 5 assets account for 57.6%.

### Historical Liquidity Performance

- During the August 2024 market stress (only >15% TVL drop), the protocol maintained operations normally. TVL recovered and continued growing.
- No recorded instances of withdrawal limit throttling causing prolonged user lockouts.

## Centralization & Control Risks

### Governance

- **Governance Model**: On-chain GovernorBravo governance. FLUID token holders vote on proposals that execute through a timelock. Discussion on [governance forum](https://gov.instadapp.io/), on-chain voting via [GovernorBravo](https://etherscan.io/address/0x0204Cd037B2ec03605CFdFe482D8e257C765fA1B), and off-chain signaling via [Snapshot](https://snapshot.org/#/instadapp-gov.eth).
- **Timelock**: [`0x2386DC45AdDed673317eF068992F19421B481F4c`](https://etherscan.io/address/0x2386DC45AdDed673317eF068992F19421B481F4c) — **1-day (86,400s) delay**. Admin of GovernorBravo is the Timelock itself (standard circular pattern). The Timelock guardian is the Avocado multisig (can cancel queued transactions). Min delay: 1 hour, max delay: 30 days.
- **Owner/Admin**: All core contracts (Liquidity Layer proxy admin, LendingFactory, VaultFactory, DexFactory) are owned by the **Timelock** (`0x2386DC45...`), not directly by the multisig. Verified on-chain via `owner()` calls and EIP-1967 admin slot reads.
- **GovernorBravo Parameters** (verified on-chain):
  - Quorum: 4,000,000 FLUID (4% of total supply)
  - Proposal threshold: 1,000,000 FLUID (1% of total supply)
  - Voting delay: 7,200 blocks (~1 day)
  - Voting period: 14,400 blocks (~2 days)
  - Proposals executed: 117
  - Minimum time from proposal to execution: ~4 days (1d delay + 2d voting + 1d timelock)

### Lending-Specific Admin Controls

| Role | Who | What They Can Do to Lending |
|------|-----|---------------------------|
| **Timelock** (governance) | [`0x2386DC45...`](https://etherscan.io/address/0x2386DC45AdDed673317eF068992F19421B481F4c) | Upgrade Liquidity Layer implementation, change LendingFactory owner, change supply/borrow configs, change rate models |
| **LendingFactory Auths** | Set by Timelock | Update fToken rewards config, change rebalancer address, rescue stuck tokens, set fToken creation code |
| **LendingFactory Deployers** | Set by Timelock | Create new fToken contracts |
| **Rebalancer** | [`0x724d...b9b6`](https://etherscan.io/address/0x724d0c9497Fa89B2C6A4585e08380c91a92ab9b6) (fUSDC/fUSDT only) | Deposit underlying without minting shares (adds as rewards). Cannot withdraw. |
| **Guardian** (Avocado multisig) | [`0x4F6F977a...`](https://etherscan.io/address/0x4F6F977aCDD1177DCD81aB83074855EcB9C2D49e) | Pause Class 0 protocols only. **Cannot move or withdraw funds.** Cancel timelock transactions. |

**Key finding**: No admin role can directly access or move user funds deposited via fTokens. The most powerful action is the Timelock upgrading the Liquidity Layer implementation (1-day delay).

### Programmability

- **System Operations**: Largely programmatic. Interest rates and exchange rates are all computed on-chain algorithmically.
- **Oracle System** (dependency via Vault Protocol): Chainlink primary, with UniswapV3 TWAP, Redstone, and custom center-price oracles as fallbacks. Modular per vault.
- **Rate Model**: Interest rates determined algorithmically via kink-based utilization model. Parameters set by governance.
- **Keepers/Automation**: No keepers needed for lending. Liquidations (in Vaults) are incentivized and performed by external liquidators.

### External Dependencies

- **Liquidity Layer**: Critical dependency — holds all fToken deposits. Upgradeable proxy controlled by Timelock.
- **Vault Protocol**: Generates fToken yield. Vault borrowers, liquidations, and oracles all affect lending counterparty risk.
- **Chainlink**: Indirect dependency via Vault Protocol oracle system. Multiple fallback oracle paths reduce risk.
- **Permit2**: Supported for deposits (Uniswap's `0x000000000022D473030F116dDEE9F6B43aC78BA3`).

## Operational Risk

- **Team**: Instadapp Labs. Founded by **Sowmay Jain** and **Samyak Jain** — both are publicly known, India-based founders active since 2019. Key GitHub contributors include **thrilok209**, **KABBOUCHI**, and **SamarendraGouda**.
- **Funding**: Well-funded by top-tier VCs: Pantera Capital, Coinbase Ventures, Standard Crypto, additional undisclosed investors.
- **Legal Structure**: Instadapp Labs. No formal DAO legal wrapper disclosed.
- **Documentation**: Comprehensive technical documentation at [docs.fluid.instadapp.io](https://docs.fluid.instadapp.io/). Full source code on GitHub.
- **Communication**: Active [governance forum](https://gov.instadapp.io/), [Discord](https://discord.com/invite/C76CeZc), Twitter [@0xfluid](https://x.com/0xfluid), [Blog](https://blog.instadapp.io/).
- **Incident Response**: No documented formal incident response plan found. However, Guardian role can pause protocols immediately. Team has ~6 years of operational history with zero security incidents.

## Monitoring

### Contracts to Monitor

| Contract | Address | Why Monitor |
|----------|---------|-------------|
| **fUSDC** | [`0x9Fb7b4477576Fe5B32be4C1843aFB1e55F251B33`](https://etherscan.io/address/0x9Fb7b4477576Fe5B32be4C1843aFB1e55F251B33) | Largest fToken (~$274.8M). Exchange rate, deposits/withdrawals |
| **fUSDT** | [`0x5C20B550819128074FD538Edf79791733ccEdd18`](https://etherscan.io/address/0x5C20B550819128074FD538Edf79791733ccEdd18) | Second largest (~$167.5M). Exchange rate, deposits/withdrawals |
| **Liquidity Layer** | [`0x52Aa899454998Be5b000Ad077a46Bbe360F4e497`](https://etherscan.io/address/0x52Aa899454998Be5b000Ad077a46Bbe360F4e497) | Holds all fToken deposits. Admin changes, implementation upgrades |
| **Timelock** | [`0x2386DC45AdDed673317eF068992F19421B481F4c`](https://etherscan.io/address/0x2386DC45AdDed673317eF068992F19421B481F4c) | Owner of all core contracts — queued/executed transactions |
| **GovernorBravo** | [`0x0204Cd037B2ec03605CFdFe482D8e257C765fA1B`](https://etherscan.io/address/0x0204Cd037B2ec03605CFdFe482D8e257C765fA1B) | Governance proposals, voting, execution |

### Key Events to Watch

| Contract | Event | Significance |
|----------|-------|-------------|
| **Timelock** | `QueueTransaction` / `ExecuteTransaction` | Governance actions queued/executed — 1 day warning |
| **Timelock** | `CancelTransaction` | Guardian cancelled a queued action |
| **Liquidity Layer** | `LogUpdateAuth` | Auth permissions changed — affects who can modify lending configs |
| **Liquidity Layer** | `LogUpdateGuardian` | Guardian address changed |
| **Liquidity Layer** | `LogPauseUser` / `LogUnpauseUser` | Protocol paused/unpaused — directly affects fToken operations |
| **Liquidity Layer** | `LogUpdateUserSupplyConfigs` | Supply limits changed — affects max fToken deposits |
| **Liquidity Layer** | `LogUpdateUserBorrowConfigs` | Borrow limits changed — affects utilization and withdrawal availability |
| **Liquidity Layer** | `LogUpdateRateDataV1` / `LogUpdateRateDataV2` | Interest rate parameters changed — affects fToken yield |
| **LendingFactory** | New fToken creation | New lending market created |

## Risk Summary

### Key Strengths

- **Lending-specific**: ERC4626-compliant fTokens with monotonically increasing exchange rates, no admin ability to access funds
- Battle-tested team with ~6 years of DeFi operational history (Instadapp since 2019), zero security incidents
- 8 security audits from 4 reputable firms (PeckShield, StateMind, MixBytes, Cantina) — **Lending Protocol directly covered** in 2 of them, Liquidity Layer (critical dependency) covered in 4
- On-chain GovernorBravo governance with 1-day Timelock and 117 proposals executed — all core contracts owned by Timelock
- $1.28B lending TVL across 5 chains, ~2 years in production with zero incidents
- Active Immunefi bug bounty ($500K max) with Lending Protocol explicitly in scope
- Fully programmatic interest rates and exchange rates — no off-chain oracle needed for lending

### Key Risks

- **Shared Liquidity Layer**: fToken deposits are commingled in the Liquidity Layer with Vault, DEX, and stETH protocol funds. A vulnerability in any protocol on the stack affects fToken holders.
- **Liquidity Layer upgradeability**: Upgradeable proxy controlled by Timelock with only 1-day delay. Malicious upgrade could affect all deposited funds.
- **Complex counterparty chain**: fToken yield depends on Vault Protocol borrowers → liquidation mechanism → oracle system. Failure at any point could lead to bad debt.
- **Concentration risk**: wstUSR is 18.9% of all lending TVL. Top 5 assets = 57.6% of lending TVL.
- **No formal verification** (Certora, Halmos) has been performed

### Critical Risks

- None identified that would trigger automatic score of 5. All contracts verified, reserves fully on-chain, governance is via on-chain GovernorBravo + Timelock. No EOA control. Guardian can only pause.

---

## Risk Score Assessment

### Critical Risk Gates

- [x] **No audit** — PASSED. 8 audits by 4 reputable firms. Lending Protocol directly covered.
- [x] **Unverifiable reserves** — PASSED. All reserves verifiable on-chain via resolver contracts. fToken exchange rates computed programmatically.
- [x] **Total centralization** — PASSED. On-chain GovernorBravo governance with 1-day Timelock. No EOA control. Guardian can only pause.

### Category Scores

#### Category 1: Audits & Historical Track Record (Weight: 20%)

- **Audits**: Exceptional coverage — 8 audits across 4 firms. Lending covered in PeckShield and StateMind full-protocol audits. Liquidity Layer (critical lending dependency) separately audited by MixBytes and StateMind in 2025. All 3 criticals and 13 highs fixed.
- **History**: ~2 years in production. Lending TVL $1.28B across 5 chains. Zero security incidents.
- **Bounty**: Active Immunefi bug bounty ($500K max) with Lending Protocol explicitly in scope.
- **Note**: No formal verification performed. StateMind found a critical lending-specific bug pre-launch (LendingRewardRateModel incorrect decimals, pool-draining risk) — **fixed before launch**.

**Score: 1.5/5** — 8 audits from 4 reputable firms with all critical/high findings resolved. Lending-specific critical bug caught and fixed pre-launch. ~2 years in production with zero incidents.

#### Category 2: Centralization & Control Risks (Weight: 30%)

**Subcategory A: Governance — 2.0**
- Full on-chain GovernorBravo governance with 117 proposals executed
- 1-day timelock delay between GovernorBravo and contract execution
- All core contracts owned by the Timelock, not directly by a multisig
- Avocado multisig serves only as Timelock guardian (cancel-only role)
- No admin role can directly access or withdraw fToken user funds
- Timelock delay (1 day) is on the shorter side but adequate with on-chain governance

**Subcategory B: Programmability — 1.5**
- Fully programmatic: interest rates and fToken exchange rates all on-chain
- ERC4626 fTokens with algorithmically computed, monotonically increasing exchange rates
- No off-chain keepers or oracles needed for lending operations
- Rebalancer role exists but can only deposit (not withdraw) — currently active only for fUSDC/fUSDT

**Subcategory C: Dependencies — 2.0**
- Critical dependency on Liquidity Layer (upgradeable proxy, shared with Vaults/DEX)
- Indirect dependency on Chainlink via Vault Protocol oracle system
- Multiple fallback oracle paths (UniswapV3, Redstone) reduce oracle risk
- Permit2 integration is standard and well-audited

**Score: 1.83/5** — (2.0 + 1.5 + 2.0) / 3 = 1.83. Full on-chain governance with timelock. No admin can access lending funds. Highly programmatic exchange rate computation.

#### Category 3: Funds Management (Weight: 30%)

**Subcategory A: Collateralization — 1.5**
- All lending is over-collateralized via Vault Protocol
- Blue-chip collateral assets dominate (ETH, wstETH, WBTC, USDC, USDT)
- Advanced tick-based liquidation mechanism
- All reserves fully on-chain and verifiable

**Subcategory B: Provability — 1.0**
- fToken exchange rates computed programmatically (ERC4626), monotonically increasing
- Interest rates algorithmically determined via kink-based model
- All reserves verifiable on-chain via FluidLiquidityResolver
- No off-chain reporting dependencies

**Score: 1.25/5** — (1.5 + 1.0) / 2 = 1.25. Excellent on-chain verifiability with programmatic, monotonically increasing exchange rates.

#### Category 4: Liquidity Risk (Weight: 15%)

- **Exit**: fToken withdrawals subject to Liquidity Layer withdrawal limits and available liquidity
- **Utilization**: Standard lending utilization dynamics apply — high utilization temporarily limits withdrawals, consistent with all lending protocols (Morpho, Aave, Compound). Kink-based rate model incentivizes rebalancing.
- **Withdrawal limits**: Expandable limits throttle large exits. Users must wait for limits to expand.
- **Shared pool risk**: Liquidity Layer serves lending, vaults, DEX, and stETH — fToken withdrawals compete with all other demand
- **Concentration**: Top 5 assets = 57.6% of lending TVL. wstUSR alone = 18.9%.
- **Stress test**: Handled August 2024 market stress (only >15% drop) without operational issues
- **Secondary market**: No significant DEX liquidity for fTokens themselves

**Score: 2.0/5** — Shared Liquidity Layer adds withdrawal competition beyond standard lending protocol dynamics. Concentration risk in top assets. Expandable limits provide gradual access but delay large exits. Offset by strong TVL depth ($1.28B) and kink-based rate model that incentivizes utilization rebalancing.

#### Category 5: Operational Risk (Weight: 5%)

- **Team**: Publicly known founders (Sowmay Jain, Samyak Jain). Active since 2019. Strong DeFi reputation.
- **Funding**: Well-funded by Pantera Capital, Coinbase Ventures, and others.
- **Docs**: Comprehensive documentation and open-source code.
- **Legal**: No formal DAO legal wrapper. Instadapp Labs as operational entity.
- **Incident Response**: No formal plan documented, but Guardian pause capability exists. Zero incidents in ~6 years.

**Score: 1.5/5** — Publicly known team with strong reputation, well-funded, comprehensive documentation. Minor deduction for no formal legal wrapper.

### Final Score Calculation

```
Final Score = (Centralization × 0.30) + (Funds Mgmt × 0.30) + (Audits × 0.20) + (Liquidity × 0.15) + (Operational × 0.05)
```

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Audits & Historical | 1.5 | 20% | 0.30 |
| Centralization & Control | 1.83 | 30% | 0.549 |
| Funds Management | 1.25 | 30% | 0.375 |
| Liquidity Risk | 2.0 | 15% | 0.300 |
| Operational Risk | 1.5 | 5% | 0.075 |
| **Final Score** | | | **1.60** |

**Optional Modifiers:**
- Protocol live >2 years with no incidents: **-0.5** → Not applied yet (1.98 years, borderline — will qualify at reassessment)
- TVL maintained >$500M for >1 year: **-0.5** → Applied

**Final Score: 1.10** (capped at minimum 1.0)

### Risk Tier

| Final Score | Risk Tier | Recommendation |
|-------------|-----------|----------------|
| 1.0-1.5 | Minimal Risk | Approved, high confidence |
| 1.5-2.5 | Low Risk | Approved with standard monitoring |
| 2.5-3.5 | Medium Risk | Approved with enhanced monitoring |
| 3.5-4.5 | Elevated Risk | Limited approval, strict limits |
| 4.5-5.0 | High Risk | Not recommended |

**Final Risk Tier: MINIMAL RISK**

The Fluid Lending Protocol (fTokens) is a well-designed ERC4626-compliant lending product with strong security properties: 8 audits, on-chain GovernorBravo governance with timelock, monotonically increasing exchange rates, and no admin ability to access user funds. The primary risk is the **shared Liquidity Layer** architecture which means fToken holders are indirectly exposed to risks across the entire Fluid protocol stack (Vaults, DEX, oracles). This is substantially mitigated by the breadth of audit coverage, the programmatic nature of the protocol, and the ~2-year track record with zero incidents.

---

## Reassessment Triggers

- **Time-based**: Reassess in 6 months (August 2026) — protocol will have >2.5 years history. Apply >2 year modifier (-0.5) at that time.
- **Utilization-based**: Reassess if Ethereum utilization exceeds 99% (negative — withdrawal availability critically constrained)
- **TVL-based**: Reassess if lending TVL changes by more than 50%
- **Incident-based**: Reassess after any exploit, governance change, or significant parameter modification
- **Governance**: Reassess if GovernorBravo parameters change (quorum, timelock delay, voting period) or if Avocado multisig signers change
- **Dependency**: Reassess if Liquidity Layer implementation is upgraded or if a new protocol is added to the shared liquidity pool
