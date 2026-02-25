# Protocol Risk Assessment: Origin ARM

- **Assessment Date:** February 8, 2026
- **Token:** ARM-WETH-stETH
- **Chain:** Ethereum Mainnet
- **Token Address:** [`0x85B78AcA6Deae198fBF201c82DAF6Ca21942acc6`](https://etherscan.io/address/0x85B78AcA6Deae198fBF201c82DAF6Ca21942acc6)
- **Final Score: 1.50/5.0**

## Overview + Links

Origin's stETH ARM (Automated Redemption Manager) is a yield-generating ETH vault (ERC4626) that earns returns primarily through arbitraging stETH against its redemption value via Lido's withdrawal queue. Users deposit WETH, receive ARM-WETH-stETH LP tokens. The protocol buys discounted stETH, redeems it 1:1 through Lido, and captures the spread as yield. The contract also supports deploying idle capital to Morpho lending markets, currently using WETH ARM Morpho vault curated by Yearn.

- **Launch Date:** October 25, 2024
- **Performance Fee:** 20% (2,000 bps) - mutable by owner (Timelock)
- **Backing:** Lido Ecosystem Foundation provides liquidity support

**Links:**

- [Protocol Documentation](https://docs.originprotocol.com/automated-redemption-manager-arm/introduction-to-arm)
- [Protocol App](https://www.originprotocol.com/arm)
- [GitHub Repository](https://github.com/OriginProtocol/arm-oeth)
- [Security / Audits](https://github.com/OriginProtocol/security)
- [Bug Bounty](https://immunefi.com/bug-bounty/originprotocol/scope/#top)
- [DeFiLlama](https://defillama.com/protocol/origin-arm)

## Contract Addresses

| Contract | Address |
|----------|---------|
| ARM Proxy | [`0x85B78AcA6Deae198fBF201c82DAF6Ca21942acc6`](https://etherscan.io/address/0x85B78AcA6Deae198fBF201c82DAF6Ca21942acc6) |
| ARM Implementation | [`0xC0297a0E39031F09406F0987C9D9D41c5dfbc3df`](https://etherscan.io/address/0xC0297a0E39031F09406F0987C9D9D41c5dfbc3df) |
| Timelock Controller | [`0x35918cDE7233F2dD33fA41ae3Cb6aE0e42E0e69F`](https://etherscan.io/address/0x35918cDE7233F2dD33fA41ae3Cb6aE0e42E0e69F) |
| Origin DeFi Governance | [`0x1D3fBD4d129Ddd2372EA85c5Fa00b2682081c9EC`](https://etherscan.io/address/0x1D3fBD4d129Ddd2372EA85c5Fa00b2682081c9EC) |
| GOV Multisig (5/8, cancel-only) | [`0xbe2AB3d3d8F6a32b96414ebbd865dBD276d3d899`](https://etherscan.io/address/0xbe2AB3d3d8F6a32b96414ebbd865dBD276d3d899) |
| Operator (EOA) | [`0x39878253374355DBcc15C86458F084fb6f2d6DE7`](https://etherscan.io/address/0x39878253374355DBcc15C86458F084fb6f2d6DE7) |
| Fee Collector | [`0xBB077E716A5f1F1B63ed5244eBFf5214E50fec8c`](https://etherscan.io/address/0xBB077E716A5f1F1B63ed5244eBFf5214E50fec8c) |
| xOGN Governance Token | [`0x63898b3b6Ef3d39332082178656E9862bee45C57`](https://etherscan.io/address/0x63898b3b6Ef3d39332082178656E9862bee45C57) |
| Lido Withdrawal Queue | [`0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1`](https://etherscan.io/address/0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1) |
| Morpho Vault (WETH ARM, Yearn curated) | [`0x3Dfe70B05657949A5dB340754aD664810ac63b21`](https://etherscan.io/address/0x3Dfe70B05657949A5dB340754aD664810ac63b21) |

## Audits and Due Diligence Disclosures

ARM has been audited by OpenZeppelin and formally verified by Certora:

| # | Date | Firm | Scope | Report |
|---|------|------|-------|--------|
| 1 | Nov 2024 | OpenZeppelin | ARM contracts | [Report](https://github.com/OriginProtocol/security/blob/master/audits/OpenZeppelin%20-%20Origin%20Arm%20Audit%20-%20November%202024.pdf) |
| 2 | Dec 2024 | Certora | Formal verification | [Report](https://github.com/OriginProtocol/security/blob/master/audits/Certora%20-%20Formal%20verification%20-%20December%202024.pdf) |
| 3 | Jun 2025 | OpenZeppelin | ARM contracts | [Report](https://github.com/OriginProtocol/security/blob/master/audits/OpenZeppelin%20-%20Origin%20ARM%20-%20June%202025.pdf) |

Origin Protocol has 30+ audit reports across all products (OpenZeppelin, Trail of Bits, Solidified, Nethermind, Sigma Prime, Narya, Perimeter) in their [security repository](https://github.com/OriginProtocol/security).

**Smart Contract Complexity:** Moderate - Upgradeable proxy (EIP-1967), AbstractARM base contract, Lido withdrawal queue integration, operator-controlled pricing with cross-price timelock protection.

### Bug Bounty

- **Platform:** Immunefi
- **Maximum Payout:** $1,000,000
- **Scope:** ARM (stETH/WETH) contract explicitly in-scope
- **Link:** https://immunefi.com/bug-bounty/originprotocol/scope/

## Historical Track Record

- **Launched:** October 25, 2024 (~16 months in production)
- **ARM-specific incidents:** None ✓
- **Origin Protocol incident:** November 17, 2020 - OUSD Flash Loan Reentrancy Attack ($8M loss). Different product (OUSD) with different contracts. ARM codebase built later with lessons learned. Source: [DeFiLlama Hacks DB](https://defillama.com/hacks), [rekt.news](https://rekt.news/origin-rekt/)
- **TVL volatility:** Extreme range from $782K to $28M peak, suggesting whale concentration risk
- **Team:** Origin Protocol since 2017. Founded by Josh Fraser & Matthew Liu. CEO: Rafael Ugolini. Backed by Pantera Capital, Founders Fund. Previously launched OETH and OUSD. Active development - expanding to EtherFi, Ethena ARM variants.

## Funds Management

**Strategy:** Buy discounted stETH → redeem 1:1 via Lido withdrawal queue → capture spread. Currently ~99% of assets sit in Lido withdrawal queue with a small WETH buffer.

**Morpho Integration:** The contract supports deploying idle capital to the WETH ARM Morpho vault ([`0x3Dfe70B05657949A5dB340754aD664810ac63b21`](https://etherscan.io/address/0x3Dfe70B05657949A5dB340754aD664810ac63b21)) curated by Yearn. This is considered a safer option compared to the previous MEV Capital wETH vault, as Yearn's curation provides stronger risk management and oversight.

### Accessibility

- **Deposits:** Permissionless, atomic. Deposit WETH, receive ARM-WETH-stETH LP tokens. Cap manager currently disabled (address(0)).
- **Withdrawals:** Two-step Request → Claim. PPS locked at request time, shares burned immediately. 10-minute minimum delay. Liquidity-dependent - exits exceeding WETH buffer require waiting for Lido withdrawal queue processing (1-3 days typical). No yield during queue.

### Collateralization

- 100% on-chain collateral: WETH + stETH (same-value ETH-denominated assets)
- No debt, leverage, or liquidation mechanics
- Operator sets buy/sell prices manually, bounded by cross-price (which requires timelock to change)

### Provability

- All reserves verifiable on-chain via view functions: `totalAssets()`, `totalSupply()`, `convertToAssets()`
- PPS calculated programmatically on-chain: `totalAssets() / totalSupply()`
- Lido withdrawal queue state verifiable: `withdrawsQueued()`, `withdrawsClaimed()`, `claimable()`
- 100% on-chain reserves, no off-chain components

## Liquidity Risk

- **Exit Mechanism:** Direct vault redemption with 10-minute delay. PPS locked at request time (no slippage on redemption value). No secondary DEX liquidity for the LP token.
- **Immediate exits** limited to WETH buffer (variable, typically small % of TVL)
- **Larger exits** require Lido withdrawal queue processing (1-3 days)
- No priority mechanism - first-come-first-served
- Same-value assets (ETH/stETH) mitigate price impact risk during wait

## Centralization & Control Risks

### Governance

**Governance Structure (all on-chain verified):**

```
xOGN Token Holders (Staked OGN)
        │ (100K xOGN to propose, ~133.7M xOGN quorum)
        ▼
Origin DeFi Governance (0x1D3fBD...9EC)
        │ (7,200 blocks voting delay + 14,416 blocks voting period)
        ▼ PROPOSER + EXECUTOR roles
Timelock Controller (0x35918c...69F)
        │ 172,800 seconds (48-hour) delay        ◄── GOV Multisig (5/8) can CANCEL only
        ▼ owner
ARM Contract (0x85B78A...cc6)
        ├── operator: EOA (0x39878...DE7) - codesize 0, confirmed EOA
        └── feeCollector: contract (0xBB077...8c)
```

**Timelock Roles (verified via `hasRole()`):**

| Role | Origin DeFi Governance | GOV Multisig (5/8) | address(0) |
|------|:---:|:---:|:---:|
| PROPOSER | ✓ | ✗ | - |
| EXECUTOR | ✓ | ✗ | ✗ (not open) |
| CANCELLER | ✓ | ✓ | - |

- Timelock is self-administered (TIMELOCK_ADMIN_ROLE held by itself)
- Total time from proposal to execution: ~5 days minimum (24h voting delay + 48h voting + 48h timelock)
- No backdoor - only Origin DeFi Governance can propose/execute

**GOV Multisig Signers (5-of-8):**
`0x530d3F8C`, `0xce96ae6D`, `0x336C02D3`, `0x6AC8d65D`, `0x617a3582`, `0x17aBc3F0`, `0x39772922`, `0xa96bD9c5`

**Privileged Roles:**

| Role | Who | Timelock? | Powers |
|------|-----|-----------|--------|
| Admin (owner) | Timelock → xOGN governance | ~5 days | Upgrade proxy, set cross price, change lending markets, grant/revoke operator, set fee |
| Operator | EOA `0x39878...DE7` | None | Set buy/sell prices (traderate0/1), trigger allocate/rebalance |
| Cap Manager | address(0) (disabled) | - | Could restrict deposits if enabled |

**Key Risk:** Operator is a single EOA (not a multisig). Can adjust buy/sell prices without timelock. Cross-price timelock limits exploitation.

### Programmability

- PPS calculated programmatically on-chain (`totalAssets() / totalSupply()`)
- `allocate()` function is permissionless
- Operator sets buy/sell prices manually (no timelock), bounded by cross-price (admin-set, 48h timelock)
- If operator inactive, pricing could become stale (no automated price discovery)

### External Dependencies

1. **Lido (Critical)** - Core value proposition depends on Lido's stETH and withdrawal queue. Failure would halt all operations.
2. **Morpho (High)** - Idle capital is deposited into WETH ARM Morpho vault curated by Yearn. Yearn curation reduces curator risk compared to previous MEV Capital setup.
3. **DEX Aggregators (Non-critical)** - 1inch, CoWSwap for stETH acquisition. Not required for core functionality.

No cross-chain dependencies.

## Operational Risk

- **Team:** Origin Protocol since 2017, public team, known leadership, VC-backed (Pantera, Founders Fund)
- **Documentation:** Good. Public GitHub actively maintained, comprehensive security repo
- **Legal:** Company structure (Origin Protocol), established entity
- **Incident Response:** $1M bug bounty on Immunefi, learned from 2020 OUSD incident

## Monitoring

- **Governance:** Monitor Timelock events (`CallScheduled`, `CallExecuted`, `Cancelled`) and Origin DeFi Governance proposals. Monitor EIP-1967 implementation slot for proxy upgrades.
- **Operator:** Monitor `traderate0()`, `traderate1()`, `crossPrice()` for changes. Alert on >5% market deviation or operator role changes.
- **PPS & Liquidity:** Track `totalAssets() / totalSupply()`, alert on >1% sudden PPS drops. Monitor WETH buffer and Lido withdrawal queue state. Track large movements (>20% TVL change in 24h).
- **Lending:** Monitor Morpho WETH ARM vault allocation and Yearn curator changes.

## Risk Summary

### Key Strengths

1. On-chain xOGN governance with ~5-day total cycle, self-administered Timelock, no admin backdoor
2. Cross-price protected by 48h timelock — limits operator manipulation
3. 2x OpenZeppelin + Certora formal verification + $1M Immunefi bounty
4. Simple strategy (stETH arbitrage), with lending to low risk ARM Morpho Vault curated by Yearn
5. 16 months clean ARM track record, same-value assets (ETH/stETH)

### Key Risks

1. Operator is single EOA (not multisig) — can set prices without timelock
2. Extreme TVL volatility ($782K–$28M) — whale concentration
3. Upgradeable proxy (protected by ~5-day governance cycle)
4. Critical Lido dependency

### Critical Risks

- None identified. All critical gates pass.

---

## Risk Score Assessment

### Critical Risk Gates

- [ ] **No audit** → **PASS** (2x OpenZeppelin + Certora formal verification)
- [ ] **Unverifiable reserves** → **PASS** (100% on-chain, verifiable)
- [ ] **Total centralization** → **PASS** (xOGN governance + Timelock; operator is EOA but admin is not)

### Category Scores

#### Category 1: Audits & Historical Track Record (Weight: 20%) — **1.5**

| Aspect | Assessment |
|--------|-----------|
| Audits | 2x OpenZeppelin + Certora formal verification |
| Bug Bounty | $1M on Immunefi, ARM in scope |
| Time in Production | ~16 months, no ARM incidents |
| TVL | $5M |

#### Category 2: Centralization & Control Risks (Weight: 30%) — **1.33**

**Subcategory A: Governance — 1.0**
- On-chain xOGN token governance with ~5-day cycle
- 48h timelock, self-administered, GOV Multisig (5/8) cancel-only
- No admin backdoor. Shorter than ideal 72h+ timelock.

**Subcategory B: Programmability — 1.5**
- PPS on-chain, cross-price timelocked, `allocate()` permissionless
- Operator is single EOA with no-timelock price setting

**Subcategory C: External Dependencies — 1.5**
- Critical dependency on Lido (blue-chip)
- Dependency on Morpho code
- Morpho vault curated by Yearn (safer than previous MEV Capital curator)

**Score: (1.0 + 1.5 + 1.5) / 3 = 1.33**

#### Category 3: Funds Management (Weight: 30%) — **1.25**

**Subcategory A: Collateralization — 1.5**
- 100% on-chain, same-value assets (ETH/stETH), no leverage
- Idle capital deposited into Yearn-curated WETH ARM Morpho vault, a safer option with stronger risk oversight than the previous MEV Capital vault

**Subcategory B: Provability — 1.0**
- Fully transparent on-chain. Minor dependency on operator pricing (bounded by cross-price)

**Score: (1.5 + 1.0) / 2 = 1.25**

#### Category 4: Liquidity Risk (Weight: 15%) — **2.5**

- Direct redemption with PPS lock (no slippage) ✓
- Limited immediate buffer, larger exits require multiple days Lido processing
- Same-value assets mitigate waiting risk

#### Category 5: Operational Risk (Weight: 5%) — **1.0**

- Established team (2017), public, VC-backed, comprehensive security repo

### Final Score Calculation

```
Final Score = (Audits × 0.20) + (Centralization × 0.30) + (Funds Mgmt × 0.30) + (Liquidity × 0.15) + (Operational × 0.05)
            = (1.5 × 0.20) + (1.33 × 0.30) + (1.25 × 0.30) + (2.5 × 0.15) + (1.0 × 0.05)
            = 0.30 + 0.399 + 0.375 + 0.375 + 0.05
            = 1.499
            ≈ 1.50
```

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Audits & Historical | 1.5 | 20% | 0.30 |
| Centralization & Control | 1.33 | 30% | 0.399 |
| Funds Management | 1.25 | 30% | 0.375 |
| Liquidity Risk | 2.5 | 15% | 0.375 |
| Operational Risk | 1.0 | 5% | 0.05 |
| **Final Score** | | | **1.50 / 5.0** |

### Risk Tier

| Final Score | Risk Tier | Recommendation |
|------------|-----------|----------------|
| **1.0-1.5** | **Minimal Risk** | **Approved, high confidence** |
| 1.5-2.5 | Low Risk | Approved with standard monitoring |
| 2.5-3.5 | Medium Risk | Approved with enhanced monitoring |
| 3.5-4.5 | Elevated Risk | Limited approval, strict limits |
| 4.5-5.0 | High Risk | Not recommended |

**Final Risk Tier: MINIMAL RISK**

---

## Reassessment Triggers

- **Time-based:** Quarterly (next: May 2026)
- **Incident-based:** Any security incident, pricing anomaly, or withdrawal issues
- **Change-based:** Morpho vault curator Yearn changes, especially adding new markets. Contract upgrade, Lido WQ issues or stETH depeg
