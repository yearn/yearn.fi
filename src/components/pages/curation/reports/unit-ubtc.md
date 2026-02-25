# Protocol Risk Assessment: Unit Bitcoin (UBTC)

- **Assessment Date:** February 19, 2026
- **Token:** UBTC
- **Chain:** HyperEVM (Hyperliquid L1 ecosystem)
- **Token Address:** [`0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463`](https://hyperevmscan.io/address/0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463)
- **HyperCore Token ID:** [`0x8f254b963e8468305d409b33aa137c67`](https://app.hyperliquid.xyz/explorer/token/0x8f254b963e8468305d409b33aa137c67)
- **Final Score: 5.0/5.0**

## Overview + Links

Unit is the asset tokenization layer on Hyperliquid, enabling deposits and withdrawals for major crypto assets (BTC, ETH, SOL, etc.) between their native blockchains and Hyperliquid. Unit Bitcoin (UBTC) is the protocol's wrapped Bitcoin token — users deposit BTC on the Bitcoin network and receive UBTC on Hyperliquid (both HyperCore and HyperEVM).

The protocol uses a **Guardian Network** — a distributed leader-verifier network of 3 independent operators that collectively manage cross-chain transfers via a **2-of-3 MPC threshold signature scheme (TSS)**. Guardians independently monitor blockchain state, verify transactions, and co-sign operations. No single Guardian can unilaterally perform operations.

UBTC is a **1:1 BTC-backed token** with no yield component. It represents a custodial claim on Bitcoin held in Unit's treasury addresses on the Bitcoin network.

**Context:** UBTC is being evaluated as collateral on Morpho on HyperEVM, specifically the [UBTC-USDC market](https://app.morpho.org/hyperevm/market/0x45af9c72aa97978e143a646498c8922058b7c6f18b6f7b05d7316c8cf7ab942f/ubtc-usdc).

**Links:**

- [Unit app](https://hyperunit.xyz/)
- [Unit docs](https://docs.hyperunit.xyz/)
- [Unit explorer](https://explorer.hyperunit.xyz)
- [Supported assets](https://docs.hyperunit.xyz/unit/about-unit/supported-assets)
- [Architecture docs](https://docs.hyperunit.xyz/architecture/components)
- [Security docs](https://docs.hyperunit.xyz/architecture/security)
- [Key addresses](https://docs.hyperunit.xyz/developers/key-addresses/mainnet)
- [Token metadata](https://docs.hyperunit.xyz/developers/key-addresses/mainnet/token-metadata)
- [DeFiLlama Unit](https://defillama.com/protocol/unit)
- [CoinGecko UBTC](https://www.coingecko.com/en/coins/unit-bitcoin)
- [Regulatory compliance](https://docs.hyperunit.xyz/legal/regulatory-compliance)

## Contract Addresses

### HyperEVM Contracts

| Contract | Address | Type |
|----------|---------|------|
| UBTC Token | [`0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463`](https://hyperevmscan.io/address/0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463) | UUPS Proxy (ERC-20) |
| UBTC Implementation | [`0x1a7689c3b783eb37550efbb9c81e7f468f7034fc`](https://hyperevmscan.io/address/0x1a7689c3b783eb37550efbb9c81e7f468f7034fc) | Implementation |
| HyperEVM Deployer (Owner) | [`0xB4FC973924a91362D301E583E839Cdaf4f19cdF8`](https://hyperevmscan.io/address/0xB4FC973924a91362D301E583E839Cdaf4f19cdF8) | EOA (MPC-controlled per docs) |

### Treasury Addresses

| Native Chain | Treasury Address | HyperCore Treasury |
|-------------|-----------------|-------------------|
| Bitcoin | `bc1pdwu79dady576y3fupmm82m3g7p2p9f6hgyeqy0tdg7ztxg7xrayqlkl8j9` | [`0x574bAFCe69d9411f662a433896e74e4F153096FA`](https://hyperevmscan.io/address/0x574bAFCe69d9411f662a433896e74e4F153096FA) |

### HyperCore Token Deployer

The HyperCore deployer is a multi-sig user at address [`0xF036a5261406a394bd63Eb4dF49C464634a66155`](https://hyperevmscan.io/address/0xF036a5261406a394bd63Eb4dF49C464634a66155) (per docs, deployed via HIP-1 native token standard).

## How Unit Protocol Works (Context)

Unit is a **bridge/asset tokenization protocol** — not a lending, staking, or yield protocol.

**Deposit flow:**
1. User connects Hyperliquid wallet and selects BTC
2. Unit's Guardian Network generates a unique Bitcoin deposit address (MPC-derived, permanently tied to user's Hyperliquid address)
3. User sends BTC to this address
4. After 2 block confirmations on Bitcoin, Guardians verify and co-sign a transaction to credit UBTC on Hyperliquid

**Withdrawal flow:**
1. User enters destination Bitcoin address and amount
2. Unit generates a unique withdrawal address on Hyperliquid
3. User signs the transaction
4. Upon Hyperliquid finalization (~10 seconds), Guardians process the Bitcoin transfer
5. Withdrawals are batched — BTC withdrawals process every ~3 Bitcoin blocks, ETH every ~21 slots

**Fees:** Unit does not collect revenue from deposits or withdrawals. The only fees are native network transaction fees.

**Required confirmations:**
| Chain | Confirmations | Time |
|-------|--------------|------|
| Bitcoin | 2+ | ≥20 minutes |
| Hyperliquid | 2,000 | ~3.5 minutes |
| Ethereum | 14 | ~3 minutes |

## Audits and Due Diligence Disclosures

**No smart contract audits are publicly disclosed or listed.**

- DeFiLlama lists **0 audits** for the Unit protocol.
- No audit reports or links are found in the Unit documentation.
- No audit page exists on the Unit website or docs.
- The Unit docs do not mention any audit firm engagement.
- HyperEVMScan explicitly shows **"No contract security audit submitted"** for the UBTC token contract.
- Multiple independent third-party analyses ([ASXN](https://newsletter.asxn.xyz/p/unit-protocol), [Impossible Finance](https://blog.impossible.finance/hyperunit-cross-chain-asset-infrastructure-for-hyperliquid/), [blocmates](https://www.blocmates.com/articles/unit-the-asset-tokenization-layer-on-hyperliquid), [ChainCatcher](https://www.chaincatcher.com/en/article/2168910)) confirm no audits exist.

### Bug Bounty

- **No bug bounty program found** on Immunefi, Sherlock, or Cantina.
- Unit Protocol is **not registered** on Safe Harbor (SEAL).

### Source Code

- **Proxy contract** ([`0x9FDB...3463`](https://hyperevmscan.io/address/0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463#code)) **is source-code verified** on HyperEVMScan — it is a standard OpenZeppelin `ERC1967Proxy` (Solidity v0.8.24, MIT license, 200 optimization runs, Cancun EVM).
- **Implementation contract** ([`0x1a76...34fc`](https://hyperevmscan.io/address/0x1a7689c3b783eb37550efbb9c81e7f468f7034fc)) **is NOT source-code verified** — the actual token logic is opaque. HyperEVMScan shows "Are you the contract creator? Verify and Publish your contract source code today!"
- Bytecode analysis of the implementation suggests it contains **allowlist/blacklist mechanisms** for sender restrictions (per HyperEVMScan), in addition to standard ERC-20 functionality.
- No public GitHub repository found for Unit Protocol smart contracts.
- Implementation bytecode is 11,660 bytes. Proxy bytecode is 163 bytes (minimal ERC-1967 proxy).

## Historical Track Record

- **DeFiLlama listing date:** February 14, 2025 (~12 months at assessment date).
- **Current protocol TVL:** ~$447M (February 19, 2026).
- **Peak TVL:** ~$1.48B (October 8, 2025).
- **TVL trend:** Declined ~70% from peak; currently at ~30% of ATH.

**CoinGecko market data (UBTC):**

| Metric | Value |
|--------|-------|
| Price | ~$66,628 |
| Market Cap | ~$218M |
| 24h Volume | ~$34M |
| Circulating Supply | ~3,273 UBTC |
| Total Supply | 21,000,000 UBTC |
| ATH | $126,087 (Oct 6, 2025) |
| ATL | $60,537 (Feb 6, 2026) |
| 30-day Price Change | -25.67% |

**On-chain supply (verified):**
- `totalSupply()` = 21,000,000 UBTC (8 decimals, matching Bitcoin's hard cap)
- Circulating supply per CoinGecko is only ~3,273 UBTC — the vast majority of the 21M max supply is not in circulation.

**Peg stability (30-day per CoinGecko):**
- Current UBTC/BTC ratio: ~0.9962 (0.38% below peg)
- 30-day minimum: 0.9858 (1.42% below peg)
- 30-day maximum: 1.0169 (1.69% above peg)
- Peg has been relatively stable, with deviations up to ~1.7% in both directions.

**Incidents:**
- No Unit/UBTC exploits found in DeFiLlama hacks database or Rekt News.
- **Guardian offline incident (April 15, 2025):** A Guardian went offline, causing delays in Bitcoin withdrawals and deposit address generation. This exposed fault tolerance gaps in the 2-of-3 Guardian Network. Community feedback called for permissionless Guardian participation to improve decentralization ([source](https://blog.impossible.finance/hyperunit-cross-chain-asset-infrastructure-for-hyperliquid/)).

## Funds Management

### Accessibility

- **Deposits:** Permissionless — anyone can deposit BTC to receive UBTC.
- **Withdrawals:** Queue-based — withdrawal batches process every ~3 Bitcoin blocks for BTC, ~21 Ethereum slots for ETH.
- **Current withdrawal queue:** Bitcoin: 0, Ethereum: 1, Solana: 4, Plasma: 0, Monad: 0 (from Unit API, February 19, 2026).
- **Fees:** No protocol fee; only native network gas fees.
- **Minimum deposit:** 0.0003 BTC.
- **Revert mechanism:** Failed deposits can be reverted after sufficient confirmations (20 blocks for BTC = ~3+ hours). Not all failed deposits are revertible.

### Collateralization

UBTC is a **1:1 BTC-backed bridged asset**. For every UBTC in circulation, the protocol claims to hold an equivalent amount of BTC in the Bitcoin treasury address.

- **Bitcoin treasury:** `bc1pdwu79dady576y3fupmm82m3g7p2p9f6hgyeqy0tdg7ztxg7xrayqlkl8j9`
- Reserves can be verified on any Bitcoin block explorer (e.g., mempool.space).
- No off-chain collateral or lending activity is disclosed.
- Collateral is entirely **native BTC** — the highest quality collateral for a BTC wrapper.

### Provability

- **Bitcoin reserves** are verifiable on-chain via the Bitcoin treasury address.
- **UBTC supply** on HyperCore/HyperEVM is verifiable via `totalSupply()`.
- **The backing ratio requires comparing two chains** (Bitcoin balance vs Hyperliquid UBTC supply), which complicates real-time verification but is deterministic.
- No Chainlink Proof of Reserve (PoR) or equivalent third-party attestation mechanism is in place.
- Unit operates an [explorer](https://explorer.hyperunit.xyz) for transaction tracking.
- The protocol does not have a public dashboard showing real-time reserve status.

## Liquidity Risk

### HyperCore Spot Orderbook (Primary Liquidity)

UBTC trades on Hyperliquid's native spot CLOB (Central Limit Order Book). Per CoinGecko:

| Venue | Pair | 24h Volume |
|-------|------|-----------|
| Hyperliquid | UBTC/USDC | ~$28.6M |
| Hyperliquid | UBTC/USDH | ~$979K |

This is the primary exit liquidity for UBTC — the spot orderbook provides market-based exit at BTC spot prices.

### HyperEVM DEX Liquidity

Per DeFiLlama, 27 UBTC pools on Hyperliquid L1 with ~$35M total TVL:

| DEX | Pair | TVL | 24h Volume |
|-----|------|-----|-----------|
| Project X | WHYPE-UBTC | $5,495,037 | - |
| Project X | UBTC-USDT0 | $1,157,720 | - |
| Project X | UBTC-KHYPE | $838,225 | - |
| Project X | UBTC-UETH | $452,481 | - |
| HyperSwap V3 | WHYPE-UBTC | $403,719 | - |
| Ramses HL | UBTC-UETH | $251,943 | - |
| Nest V1 | WHYPE-UBTC | $205,647 | - |

**DEX-only liquidity:** ~$9.4M across 18 pools.

### Lending Protocol Deposits

| Protocol | TVL |
|----------|-----|
| HyperLend | ~$14.0M |
| Morpho (14 markets) | ~$7.6M supply |
| Other (Nabla, etc.) | ~$33K |

### Morpho Markets (UBTC as Collateral)

14 Morpho markets use UBTC as collateral with total supply of ~$7.6M and total borrows of ~$6.4M.

**The specific market from the issue (UBTC-USDC):**

| Metric | Value |
|--------|-------|
| Market ID | [`0x45af9c72aa97978e143a646498c8922058b7c6f18b6f7b05d7316c8cf7ab942f`](https://app.morpho.org/hyperevm/market/0x45af9c72aa97978e143a646498c8922058b7c6f18b6f7b05d7316c8cf7ab942f/ubtc-usdc) |
| Loan Asset | USDC |
| LLTV | 77.0% |
| Supply | ~$2.72M |
| Borrow | ~$2.45M |
| Utilization | 90.0% |

### Liquidity Assessment

- **Primary exit:** Hyperliquid spot CLOB with ~$29M daily volume — adequate for most position sizes.
- **Secondary exit:** Protocol withdrawal back to native BTC (queue-based, ~3 Bitcoin block batches).
- **DEX liquidity on HyperEVM:** ~$9.4M — moderate for DEX-based exits.
- **All liquidity is within the Hyperliquid ecosystem** — no CEX listings.

## Centralization & Control Risks

### Governance

**UBTC HyperEVM token contract:**
- **Owner:** [`0xB4FC973924a91362D301E583E839Cdaf4f19cdF8`](https://hyperevmscan.io/address/0xB4FC973924a91362D301E583E839Cdaf4f19cdF8)
- **On-chain code-size: 0** — this is an **EOA** (Externally Owned Account).
- **Per Unit docs:** The HyperEVM deployer is "controlled via multi-party computation (MPC), requiring key-shares from multiple signers to construct and perform transactions." However, this is **not verifiable on-chain** — it appears as a regular EOA.
- **Contract type:** UUPS upgradeable proxy — the owner can upgrade the implementation without timelock.
- **No timelock** detected on-chain.
- **No multisig** on-chain — the MPC claim is off-chain only.

**Guardian Network (bridge operations):**
- 2-of-3 MPC threshold signature scheme.
- 3 Guardians: **Unit**, **Hyperliquid**, and **Infinite Field**.
  - **Infinite Field** self-identifies as "a proprietary HFT market making firm" running on Hyperliquid since February 2024 ([source](https://x.com/infinitefieldx/status/1890437991224520799)).
- Each Guardian runs independent blockchain indexers, verifiers, and secure enclaves (e.g., AWS Nitro).
- Guardian keys are generated via distributed key generation (DKG), encrypted at rest via KMS, combined only at runtime in secure enclaves.
- The relay server only forwards ciphertext — no key material.
- **Leader centralization:** Currently a single pre-determined leader coordinates proposals. The protocol plans to implement a leader election process in the future, but this creates interim centralization risk.

**Key concern:** While the bridge operations use 2-of-3 MPC, the HyperEVM token contract ownership is an EOA. A compromise of the MPC key (or the off-chain signers controlling it) could allow an attacker to upgrade the UBTC implementation to a malicious contract.

### Programmability

- The UBTC token contract is a **simple ERC-20 with Ownable + UUPS**. No complex vault logic, exchange rates, or admin parameters detected.
- No `paused()`, `blacklister()`, `cap()`, `MINTER_ROLE()`, `DEFAULT_ADMIN_ROLE()`, or `DOMAIN_SEPARATOR()` functions exposed via the proxy interface.
- However, bytecode analysis of the unverified implementation suggests **allowlist/blacklist mechanisms** exist for sender restrictions — these are not callable from the proxy but may be accessible to the owner.
- The bridge operations (deposit/withdrawal) are handled entirely off-chain by the Guardian Network — the on-chain token contract is just a standard ERC-20.
- The deterministic state machine underlying all protocol actions guarantees strict, verifiable workflows per the security docs.

### External Dependencies

Critical dependencies:
1. **Bitcoin network** — for BTC custody and transfer verification.
2. **Hyperliquid L1** — HyperCore consensus/liveness and HyperEVM execution.
3. **Guardian Network infrastructure** — AWS Nitro enclaves, relay servers, indexers.
4. **KMS services** — for Guardian key encryption at rest.

**Hyperliquid chain risk:**
- Hyperliquid is a highly centralized chain — Hyper Foundation controls 56.4% of validator stake via 5 validators, exceeding the 1/3 BFT blocking minority (per kHYPE assessment).
- HyperEVM shares the same HyperBFT consensus as HyperCore — no separate bridge risk between the two, but full L1 dependency.

## Operational Risk

- **Team:** Unit describes itself as "a research and development collective dedicated to advancing the Hyperliquid ecosystem." Core team members claim expertise from **HRT** (Hudson River Trading), **Jump** (Jump Crypto), **Fortress**, and **IDF cyber units** (per docs). The team is reportedly self-funded.
- **Team transparency:** No individual team members are named or publicly doxxed. No "Team" page with identifiable individuals. Multiple third-party analyses ([ChainCatcher](https://www.chaincatcher.com/en/article/2168910), [Impossible Finance](https://blog.impossible.finance/hyperunit-cross-chain-asset-infrastructure-for-hyperliquid/)) note "founders and investors are unknown" and flag this as a transparency concern.
- **Entity:** "Unit Labs" — referenced in regulatory compliance docs.
- **Legal:** Unit Labs utilizes blockchain analytics to screen wallets (OFAC SDN List compliance). Frontend implements IP-based geofencing for prohibited jurisdictions. Legal inquiries to `legal@hyperunit.xyz`.
- **Twitter:** [@hyperunit](https://x.com/hyperunit) (primary, per CoinGecko) / [@unitxyz](https://twitter.com/unitxyz) (per DeFiLlama).
- **Token:** The team secured the $UNIT ticker for ~$350K in January 2025, strongly suggesting plans for a future token launch. No official airdrop confirmed.
- **Documentation:** Adequate — hosted on GitBook, covers architecture, security, API, key addresses. Some pages are JS-rendered only.
- **Compliance:** Guardians independently implement compliance screening. Unit Labs uses blockchain analytics software. Maintains transaction records for law enforcement disclosure.
- **Incident handling:** Guardian offline incident (April 15, 2025) was resolved, but no formal public incident response plan is documented.

## Monitoring

Key addresses and data to monitor:

### 1. Bitcoin Treasury Monitoring (MANDATORY)

- **Bitcoin treasury:** `bc1pdwu79dady576y3fupmm82m3g7p2p9f6hgyeqy0tdg7ztxg7xrayqlkl8j9`
- Compare BTC held vs UBTC circulating supply on Hyperliquid
- Alert: If BTC balance falls below circulating UBTC supply

### 2. Token Supply Monitoring (MANDATORY)

- `UBTC.totalSupply()` on HyperEVM: [`0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463`](https://hyperevmscan.io/address/0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463)
- HyperCore token supply via Hyperliquid explorer
- Alert: Sudden supply changes >10% in 24h

### 3. Contract Upgrade Monitoring (MANDATORY)

- Monitor `Upgraded` events on UBTC proxy contract
- Monitor ownership transfers on UBTC contract (`OwnershipTransferred` event)
- Alert: Any implementation upgrade or ownership change (immediate)

### 4. Peg Monitoring

- UBTC/BTC price ratio (CoinGecko, Hyperliquid spot)
- Alert: Discount >3% sustained for >1h

### 5. Withdrawal Queue Monitoring

- Unit API endpoint: `GET https://api.hyperunit.xyz/withdrawal-queue`
- Alert: Bitcoin withdrawal queue >10 pending operations

### 6. Guardian Network Health

- Monitor for any Guardian downtime or signing failures
- TODO: No public endpoint for Guardian health status identified

## Risk Summary

### Key Strengths

1. **Simple architecture** — UBTC is a straightforward 1:1 BTC wrapper with minimal on-chain complexity.
2. **Significant protocol TVL** (~$447M) and meaningful trading volume (~$34M/day) demonstrating product-market fit.
3. **Bitcoin reserves are verifiable** on-chain via the Bitcoin treasury address.
4. **No protocol fees** — reduces attack surface and misalignment incentives.
5. **Regulatory compliance measures** — OFAC screening, geofencing, law enforcement cooperation.

### Key Risks

1. **No public smart contract audits** — no audit reports found anywhere, confirmed by multiple independent sources. This is a critical concern for a bridge holding ~$447M.
2. **No bug bounty program** — no Immunefi, Sherlock, or Cantina listing found.
3. **Implementation source code unverified** — the proxy is verified (standard OpenZeppelin ERC1967Proxy), but the actual token implementation at [`0x1a7689c3b783eb37550efbb9c81e7f468f7034fc`](https://hyperevmscan.io/address/0x1a7689c3b783eb37550efbb9c81e7f468f7034fc) is **not verified**. Bytecode analysis suggests undisclosed allowlist/blacklist features.
4. **EOA ownership on HyperEVM** — the MPC claim is not verifiable on-chain. The contract owner (`Unit: Deployer`) appears as a single EOA that can upgrade the implementation instantly.
5. **No timelock** on contract upgrades — implementation can be swapped instantly.
7. **2-of-3 MPC** is a relatively low threshold — compromise of any 2 Guardians (one of which is Unit itself) could compromise the system.
8. **Hyperliquid chain centralization** — Hyper Foundation controls 56.4% of validator stake.

### Critical Risks

- **No audit combined with unverified implementation source code and EOA upgradeability** — the UBTC implementation could contain vulnerabilities or be upgraded to a malicious contract. Bytecode hints at undisclosed allowlist/blacklist mechanisms.
- **2-of-3 MPC with only 3 Guardians** — a coordinated compromise of Unit + one other Guardian (Hyperliquid or Infinite Field) gives full control over bridge funds.

---

## Risk Score Assessment

### Critical Risk Gates

- [ ] **No audit** -> **TRIGGERED** — Protocol has no publicly disclosed audits by any firm.
- [x] **Unverifiable reserves** -> **PASS** — Bitcoin reserves are verifiable on-chain.
- [ ] **Total centralization** -> **BORDERLINE** — EOA owner on HyperEVM (claimed MPC), 2-of-3 Guardian Network. Not a single EOA in the traditional sense, but on-chain evidence shows EOA ownership.

**Critical gate "No audit" is triggered.** Per the scoring guidelines, this automatically results in a score of **5** (High Risk).

However, given that:
1. The protocol has been operational for ~12 months with ~$447M TVL
2. The on-chain token contract interface is relatively simple (standard ERC-20 + UUPS)
3. The 2-of-3 MPC Guardian architecture provides some multi-party security
4. Bitcoin reserves are transparently verifiable

We assess whether the automatic 5 should be applied strictly or with contextual modifiers. **Given the framework's explicit instruction ("If ANY gate is triggered, the protocol automatically receives a score of 5"), we apply the automatic score.**

### Category Scores (For Reference)

Even though the critical gate is triggered, we provide category scores for reference if audits are conducted in the future.

#### Category 1: Audits & Historical Track Record (Weight: 20%)

- **No audits** from any firm (confirmed by DeFiLlama, HyperEVMScan, and multiple third-party analyses).
- No bug bounty program.
- Implementation source code unverified (proxy verified as standard OpenZeppelin ERC1967Proxy).
- ~12 months in production, TVL ~$447M (peaked ~$1.48B).
- One operational incident: Guardian offline (April 15, 2025) causing BTC withdrawal delays.

**Score: 5.0/5** — No audit (critical gate triggered).

#### Category 2: Centralization & Control Risks (Weight: 30%)

Subscores:
- **Governance: 4.5** — EOA owner (on-chain) claimed to be MPC-controlled (off-chain). No timelock. UUPS upgradeable. 2-of-3 Guardian Network for bridge operations, but not for contract governance.
- **Programmability: 2.0** — Simple ERC-20 token; bridge operations handled by deterministic state machine. No complex vault logic or admin parameters.
- **External dependencies: 3.5** — Depends on Bitcoin network, Hyperliquid L1 (centralized validator set), Guardian infrastructure (AWS Nitro, KMS). Hyperliquid Foundation controls 56.4% of validator stake.

Centralization score = (4.5 + 2.0 + 3.5) / 3 = **3.33**

**Score: 3.3/5**

#### Category 3: Funds Management (Weight: 30%)

Subscores:
- **Collateralization: 2.0** — 1:1 BTC-backed on-chain. Collateral is native BTC (highest quality). No off-chain or mixed collateral.
- **Provability: 2.5** — Bitcoin reserves verifiable on-chain. UBTC supply verifiable on Hyperliquid. Requires cross-chain comparison. No Proof of Reserve oracle or third-party attestation. No public reserve dashboard.

Funds management score = (2.0 + 2.5) / 2 = **2.25**

**Score: 2.25/5**

#### Category 4: Liquidity Risk (Weight: 15%)

- Primary exit via Hyperliquid CLOB: ~$29M daily volume — adequate.
- Secondary exit via native BTC withdrawal: queue-based, currently 0 pending BTC withdrawals.
- DEX liquidity: ~$9.4M across 18 pools.
- All within Hyperliquid ecosystem — no CEX listings.
- Peg deviations up to ~1.7% observed in last 30 days.

**Score: 2.5/5**

#### Category 5: Operational Risk (Weight: 5%)

- Team from reputable backgrounds (HRT, Jump, Fortress) but not individually doxxed.
- Documentation adequate but some pages JS-rendered only.
- Regulatory compliance measures in place (OFAC, geofencing).
- No public incident response plan.

**Score: 3.0/5**

### Final Score Calculation

**Due to the critical gate trigger (no audit), the final score is automatically set to 5.0/5.**

For reference, the weighted score without the critical gate would be:

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Audits & Historical | 5.0 | 20% | 1.00 |
| Centralization & Control | 3.3 | 30% | 0.99 |
| Funds Management | 2.25 | 30% | 0.675 |
| Liquidity Risk | 2.5 | 15% | 0.375 |
| Operational Risk | 3.0 | 5% | 0.15 |
| **Weighted Score** | | | **3.19 / 5.0** |

**But critical gate applies → Final Score: 5.0 / 5.0**

## Overall Risk Score: **5.0 / 5.0**

### Risk Tier: **HIGH RISK**

Rationale:
- **The critical gate "No audit" is triggered.** Unit Protocol has no publicly disclosed audits despite managing ~$447M in TVL.
- Implementation source code is unverified.
- No bug bounty program exists.
- HyperEVM contract owner is an EOA (MPC claim not verifiable on-chain) with UUPS upgradeability and no timelock.
- Without the critical gate, the weighted score would be 3.19/5.0 (Medium Risk), primarily elevated by the audit gap and centralization concerns.
- If audits are conducted and code is verified, the score could improve significantly to the Low-Medium range.

## Reassessment Triggers

- **Time-based**: Reassess in 3 months or upon completion of an audit
- **TVL-based**: Reassess if TVL changes by more than 50%
1. Publication of any smart contract audit for Unit Protocol / UBTC
2. Source code verification on block explorers
3. Launch of a bug bounty program
4. Contract implementation upgrade on HyperEVM
5. Ownership transfer of the UBTC contract
6. Change in Guardian Network composition (addition/removal of Guardians)
7. Introduction of timelock governance (positive trigger — would improve score)

## Appendix: What Would Improve the Score

If the following were addressed, the score could improve from 5.0 to approximately **2.5-3.0** (Low-Medium Risk):

1. **Audit by 1-2 reputable firms** → Would remove critical gate trigger
2. **Implementation source code verification** on HyperEVMScan → Would improve transparency (proxy is already verified)
3. **Bug bounty program** → Would reduce audit category score
4. **On-chain multisig** for contract ownership (replacing EOA) → Would improve governance score
5. **Timelock** on contract upgrades → Would improve governance score

## Sources

- Unit docs: https://docs.hyperunit.xyz/
- Unit app: https://hyperunit.xyz/
- Unit explorer: https://explorer.hyperunit.xyz
- Unit architecture: https://docs.hyperunit.xyz/architecture/components
- Unit security: https://docs.hyperunit.xyz/architecture/security
- Unit key addresses: https://docs.hyperunit.xyz/developers/key-addresses/mainnet
- Unit token metadata: https://docs.hyperunit.xyz/developers/key-addresses/mainnet/token-metadata
- Unit team: https://docs.hyperunit.xyz/unit/about-unit/team
- Unit regulatory compliance: https://docs.hyperunit.xyz/legal/regulatory-compliance
- Unit withdrawal queue API: https://api.hyperunit.xyz/withdrawal-queue
- DeFiLlama Unit: https://defillama.com/protocol/unit
- CoinGecko UBTC: https://www.coingecko.com/en/coins/unit-bitcoin
- Morpho UBTC markets: https://app.morpho.org/hyperevm/market/0x45af9c72aa97978e143a646498c8922058b7c6f18b6f7b05d7316c8cf7ab942f
- HyperEVMScan UBTC proxy (verified): https://hyperevmscan.io/address/0x9FDBdA0A5e284c32744D2f17Ee5c74B284993463#code
- HyperEVMScan UBTC implementation (unverified): https://hyperevmscan.io/address/0x1a7689c3b783eb37550efbb9c81e7f468f7034fc
- On-chain verification via `cast` against HyperEVM RPC (`rpc.hyperliquid.xyz/evm`)
- Morpho Blue API: https://blue-api.morpho.org/graphql
- DeFiLlama Yields API: https://yields.llama.fi/pools
- DeFiLlama Hacks: https://api.llama.fi/hacks
- Infinite Field Guardian announcement: https://x.com/infinitefieldx/status/1890437991224520799
- ASXN Unit Protocol analysis: https://newsletter.asxn.xyz/p/unit-protocol
- Impossible Finance HyperUnit analysis: https://blog.impossible.finance/hyperunit-cross-chain-asset-infrastructure-for-hyperliquid/
- blocmates Unit overview: https://www.blocmates.com/articles/unit-the-asset-tokenization-layer-on-hyperliquid
- ChainCatcher Unit analysis: https://www.chaincatcher.com/en/article/2168910
- Delphi Digital HyperUnit analysis: https://members.delphidigital.io/feed/hyperunit-the-infrastructure-powering-native-spot-on-hyperliquid
