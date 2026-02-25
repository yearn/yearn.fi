# Protocol Risk Assessment: Midas mHYPER

- **Assessment Date:** February 7, 2026
- **Token:** mHYPER
- **Chain:** Ethereum (also deployed on Monad, Plasma)
- **Token Address:** [`0x9b5528528656DBC094765E2abB79F293c21191B9`](https://etherscan.io/token/0x9b5528528656dbc094765e2abb79f293c21191b9)
- **Final Score: 3.3/5.0**

## Overview + Links

mHYPER is a tokenized certificate (Liquid Yield Token / LYT) issued by Midas Software GmbH, a German-incorporated tokenization platform. It references the performance of **market-neutral, stablecoin-focused strategies** managed by [Hyperithm](https://www.hyperithm.com/), a digital asset management firm based in Tokyo and Seoul.

mHYPER is **not** a stablecoin — its value floats based on strategy performance. Yield is auto-compounded into the token price (NAV), updated on-chain weekly via a custom oracle. The token has appreciated from $1.00 at inception to ~$1.077 as of February 2026.

The yield strategy includes:
- Leveraged USDe positions on **Aave**
- Stablecoin farming on **Pendle**
- Basis trading on **Hyperliquid**
- Liquidity provision on **Morpho** vaults
- Carry trades, liquidation arbitrage, reward farming

Legally, mHYPER tokens are structured as **subordinated debt instruments** of Midas Software GmbH. Investors have no legal or beneficial interest in the underlying assets — claims are subordinated to the issuer (Qualified Subordination). This is weaker than bankruptcy-remote SPV structures; in insolvency, tokenholder claims rank below all other creditors.

**Key Stats:**
- **mHYPER Market Cap:** ~$43.67M
- **Total Supply:** ~40,557,474 mHYPER
- **Holders:** ~387 addresses
- **APY:** ~9.24%
- **Midas Platform TVL:** ~$275M (per DeFiLlama, combined Midas RWA + Hyperithm entries)
- **KYC Required:** Yes (greenlist enforced on-chain)

**Links:**

- [Midas Documentation](https://docs.midas.app/)
- [Midas App - mHYPER](https://midas.app/mhyper)
- [Midas Audits](https://docs.midas.app/resources/audits)
- [Midas Smart Contract Addresses](https://docs.midas.app/resources/smart-contracts-addresses)
- [Hyperithm Website](https://www.hyperithm.com/)
- [FMA-Approved Base Prospectus (July 2024)](https://www.mfsa.mt/wp-content/uploads/2024/11/Midas-Software-GmbH-Base-Prospectus-Document-dated-17-July-2024.pdf)
- [Hacken Audit Report](https://hacken.io/audits/midas/sca-midas-vault-dec2023/)
- [Sherlock Audit Contest #1 (May 2024)](https://audits.sherlock.xyz/contests/332)
- [Sherlock Audit Contest #2 (Aug 2024)](https://github.com/sherlock-audit/2024-08-midas-minter-redeemer-judging)
- [Serenity Research - mHYPER Review](https://serenityresearch.substack.com/p/serenity-premium-on-chain-hedge-funds-1a5)
- [Fordefi Custody Case Study](https://www.fordefi.com/customer-stories/how-midas-brings-tokenized-investment-opportunities-on-chain-with-fordefis-defi-native-custody-2ti85)
- [Etherscan - mHYPER](https://etherscan.io/token/0x9b5528528656dbc094765e2abb79f293c21191b9)

## Contract Addresses

All contracts use OpenZeppelin's `TransparentUpgradeableProxy` pattern with a shared `ProxyAdmin`.

| Contract | Proxy Address | Implementation Address |
|----------|--------------|----------------------|
| **mHYPER Token** | [0x9b5528528656DBC094765E2abB79F293c21191B9](https://etherscan.io/address/0x9b5528528656DBC094765E2abB79F293c21191B9) | [0xE4386180dF7285E7D78794148E1B31c9EDfb0689](https://etherscan.io/address/0xE4386180dF7285E7D78794148E1B31c9EDfb0689) |
| **mHYPER/USD Oracle** (CustomAggregatorFeed) | [0x43881B05C3BE68B2d33eb70aDdF9F666C5005f68](https://etherscan.io/address/0x43881B05C3BE68B2d33eb70aDdF9F666C5005f68) | [0xFcA6c2087e6321385745f3080D586d088a7f707f](https://etherscan.io/address/0xFcA6c2087e6321385745f3080D586d088a7f707f) |
| **mHYPER DataFeed** | [0x92004DCC5359eD67f287F32d12715A37916deCdE](https://etherscan.io/address/0x92004DCC5359eD67f287F32d12715A37916deCdE) | [0xE3240302aCEc5922b8549509615c16a97C05654A](https://etherscan.io/address/0xE3240302aCEc5922b8549509615c16a97C05654A) |
| **DepositVault** | [0x6Be2f55816efd0d91f52720f096006d63c366e98](https://etherscan.io/address/0x6Be2f55816efd0d91f52720f096006d63c366e98) | [0x570C15bC5faF98531A8b351d69E22E41e3505E47](https://etherscan.io/address/0x570C15bC5faF98531A8b351d69E22E41e3505E47) |
| **RedemptionVaultWithSwapper** | [0xbA9FD2850965053Ffab368Df8AA7eD2486f11024](https://etherscan.io/address/0xbA9FD2850965053Ffab368Df8AA7eD2486f11024) | [0xd2B5f8f1DED3D6e00965b8215b57A33c21101c63](https://etherscan.io/address/0xd2B5f8f1DED3D6e00965b8215b57A33c21101c63) |
| **MidasAccessControl** | [0x0312A9D1Ff2372DDEdCBB21e4B6389aFc919aC4B](https://etherscan.io/address/0x0312A9D1Ff2372DDEdCBB21e4B6389aFc919aC4B) | [0xDd5a54bA2ab379a5e642c58f98ad793a183960e2](https://etherscan.io/address/0xDd5a54bA2ab379a5e642c58f98ad793a183960e2) |
| **ProxyAdmin** (shared) | [0xbf25b58cB8DfaD688F7BcB2b87D71C23A6600AaC](https://etherscan.io/address/0xbf25b58cB8DfaD688F7BcB2b87D71C23A6600AaC) | N/A |
| **Tokens Receiver** | [0xF356c5e9F69DaDB332Bb098C7Ed960Db1d3376DD](https://etherscan.io/address/0xF356c5e9F69DaDB332Bb098C7Ed960Db1d3376DD) | N/A |
| **Deployer** | [0xa0819ae43115420beb161193b8d8ba64c9f9facc](https://etherscan.io/address/0xa0819ae43115420beb161193b8d8ba64c9f9facc) | N/A |

**Other Chain Deployments:**
- **mHYPER (Monad):** `0xd90f6bfed23ffde40106fc4498dd2e9edb95e4e7`
- **mHYPER (Plasma):** `0xb31bea5c2a43f942a3800558b1aa25978da75f8a`

## Audits and Due Diligence Disclosures

**Audit Status:** Moderate — audits cover the shared Midas infrastructure (vaults, tokens, access control), but no mHYPER-specific audit exists. mHYPER extends `mTBILL` and uses the same audited vault architecture.

| Audit | Firm | Date | Scope | Link |
|-------|------|------|-------|------|
| Midas Vault Audit | **Hacken** | Dec 2023 - Jan 2024 | mTBILL token, DepositVault, RedemptionVault, ManageableVault, access control (15 contracts) | [Report](https://hacken.io/audits/midas/sca-midas-vault-dec2023/) |
| Midas Audit Contest #1 | **Sherlock** | May 2024 | DepositVault, RedemptionVault, MidasAccessControl, DataFeed | [Contest](https://audits.sherlock.xyz/contests/332) |
| Midas Minter/Redeemer Contest #2 | **Sherlock** | Aug 2024 | Instant mint/redeem, BUIDL integration, new oracles. Prize pool: 36,500 USDC | [Judging](https://github.com/sherlock-audit/2024-08-midas-minter-redeemer-judging) |

**Hacken Audit Results (Dec 2023):**
- Security Score: 10/10 (post-fix). 100% branch coverage
- 0 Critical, 1 High (Accepted — USD tokens with custom decimals), 2 Medium (1 fixed: missing oracle refresh; 1 accepted: 1:1 price assumption), 1 Low (permissive role for token burning — accepted), 4 Observations
- **Critical note:** Auditors explicitly flagged the protocol as **"highly centralized"** with system admins controlling all critical roles

**Sherlock Contest #1 (May 2024):**
- 1 High (blacklist bypass via `renounceRole` — acknowledged), 2 Medium (corruptible upgradability pattern — fixed; excessive vault admin permissions — acknowledged)

**Sherlock Contest #2 (Aug 2024):**
- 1 High (reclassified to Medium — RedemptionVaultWithBUIDL initialization DoS), 6 Medium (BUIDL balance handling, standard redemption allowance gaps, spec/code discrepancies)

**Smart Contract Complexity:** Low-Moderate
- mHYPER extends mTBILL (simple ERC-20 with pausable, role-controlled mint/burn)
- Standard OpenZeppelin TransparentUpgradeableProxy pattern
- Custom oracle (CustomAggregatorFeed) wrapping Chainlink's AggregatorV3 interface — **not** a Chainlink data feed
- Role-based access control via shared MidasAccessControl contract

**Note:** Audits are from 2023-2024 and mHYPER was launched July 2025 — there may be unaudited changes to the vault architecture since then.

### Bug Bounty

- Listed on [HackerOne](https://hackerone.com/midas) — no explicit maximum payout specified
- Contact: security@mid.as. Response SLA: 24 hours acknowledgment, 30 days to address. Rewards at Midas's discretion
- Not listed on Immunefi — the HackerOne program is the only ongoing bounty. The lack of a guaranteed payout weakens its deterrent effect

## Historical Track Record

- **Production History:** mHYPER token created on Ethereum [July 15, 2025](https://etherscan.io/tx/0x8dd0b1216e7970be06bd897ed57ebfba3f4213ec63d68aa622740608e93ffd5f) (~7 months in production). Midas platform launched with mTBILL in mid-2024 (~20 months total)
- **TVL Growth:** Midas grew from ~$4M (July 2024) to ~$275M (February 2026)
- **mHYPER Market Cap:** ~$43.67M with ~387 holders
- **Price History:** mHYPER has traded between $1.024 (ATL, Sep 2025) and $1.077 (ATH, Feb 2026) — steady appreciation consistent with yield accrual
- **Concentration Risk:** Only ~387 holders suggests significant concentration among few large depositors
- **Incidents:**
  - **Stream Finance Incident (Nov 2025):** Stream Finance lost $93M due to fund misappropriation by an external asset manager. Stream held a $75M leveraged position in mHYPER via Morpho. **mHYPER itself was not exploited** — the incident was at the Stream Finance level. mHYPER successfully processed **over $150M in redemptions within 48 hours**, demonstrating the redemption mechanism functions under stress. Hyperithm confirmed Stream fully unwound its position
  - **Recursive Lending Concerns (Oct 2025):** YieldFi (yUSD) and Stream Finance (xUSD) positions reportedly made up ~30% of mHYPER's $263M TVL, raising circular lending concerns. Hyperithm responded that exposure to both was **fully removed**
  - No reported hacks, exploits, or security incidents on rekt.news
- **Note:** Midas Capital (hacked in 2023) is a **completely different project** from Midas (midas.app)

**Hyperithm Track Record:**
- Founded January 2018 (7+ years operating history)
- Co-founded by Sangrok Oh (ex-Morgan Stanley) and Woojun Lloyd Lee (Forbes 30 Under 30)
- Backed by Coinbase Ventures, Samsung Next, Hashed, Kakao, Naver. $11M Series B (Aug 2021)
- Dual regulatory registration: SPBQII in Japan (FSA), VASP in South Korea (KoFIU)
- **Concern:** Co-CEO Sangrok Oh held $3M+ in TRUMP meme coin, attended Trump dinner as [13th-largest holder](https://www.koreaherald.com/article/10488051) (May 2025) — raises questions about risk management culture for a firm claiming market-neutral positioning
- **Concern:** Alleged failure to file mandatory risk assessment with South Korean regulators before launching a new product (Dec 2025) — [reported by crypto media](https://cryptorank.io/news/feed/18676-hyperithm-regulatory-filing-accusation), no official regulatory action confirmed

## Funds Management

mHYPER delegates 100% of funds to Hyperithm, who deploys them across multiple DeFi protocols using market-neutral, stablecoin-focused strategies.

- **Fund Manager:** Hyperithm (Tokyo/Seoul, founded 2018, AUM $300M+)
- **Strategy:** Multi-chain stablecoin yield — leveraged USDe on Aave, farming on Pendle, basis trading on Hyperliquid, Morpho vault liquidity, carry trades, liquidation arbitrage
- **Strategy Execution:** Off-chain by Hyperithm with discretionary investment decisions
- **Custody:** Fordefi MPC custody with tri-party quorum (Midas + Hyperithm + independent signer). Fordefi is the primary custodian for LYT products; Midas also uses Fireblocks for other product lines
- **Monitoring:** NAV updates provided by Hyperithm, reviewed by Midas, then published on-chain weekly

### Accessibility

- **KYC Required:** Yes — users must complete KYC/AML screening (1-4 business days). Once approved, added to on-chain greenlist via `Greenlistable` contract. Chainalysis Oracle integration for sanctions screening
- **Minting:** Deposit USDC, receive mHYPER tokens. Default mode is instant issuance
- **Redemption:** Two modes:
  - **Instant:** Atomic on-chain at oracle price (when liquidity is available in the RedemptionVaultWithSwapper). **0.50% instant redemption fee.** Liquidity target: 1-2% of circulating supply, replenished within 2 business days. May be temporarily unavailable
  - **Standard:** 1-7 business day queue (fallback when instant capacity is insufficient). Subject to Risk Manager setting aside funds
- **Fees:** 0% management fee, 10% performance fee (from yield), 0% standard mint/redeem fees, 0.50% instant redemption fee
- **Geographic Restrictions:** Not available to US persons, UK, China, and sanctioned countries. IP screening with VPN detection

### Collateralization

- **Backing Model:** Off-chain / hybrid — mHYPER is a **subordinated debt instrument** of Midas Software GmbH, not a direct claim on underlying assets
- **Collateral Quality:** Strategies target stablecoin-focused, market-neutral positions across Aave (blue-chip), Pendle (established), Hyperliquid (newer, centralized perps DEX), Morpho (established). Includes leveraged positions and basis trading
- **Verifiability:** Limited — the underlying strategy positions are managed off-chain. Hyperithm discloses some wallet addresses on a transparency page, but full portfolio composition requires off-chain reporting
- **Risk Curation:** Hyperithm has discretion over allocation within the broad strategy framework. Midas enforces policy limits via Fordefi policy engine (address, asset, contract method, notional size)
- **Tri-Party Governance (via Fordefi):** Midas Treasury + Hyperithm (Asset Manager) + Independent Oversight Signer. Operations within predefined rules clear automatically; anything outside routes to three-party quorum. No single group can act unilaterally for custody operations
- **Legal Structure:** LYT holders are **subordinate creditors** of Midas Software GmbH (EUR 25,000 share capital). This is weaker than bankruptcy-remote SPV structures
- **Previous Recursive Lending:** ~30% of TVL was from circular lending loops (since addressed, but structural risk remains)

### Provability

- **Reserve Transparency:** Hybrid. Strategy wallets are partially on-chain, but full portfolio composition requires off-chain reporting. Token holders cannot independently verify that reserves match the reported NAV
- **NAV/Price Updates:** Token price updated **weekly** by Midas via a privileged role on the `CustomAggregatorFeed` oracle. Current price: ~$1.077 (round 63, 8 decimals). This is **not** programmatic — it is admin-reported. The exchange rate is determined off-chain; users cannot know the exact amount of tokens they will receive beforehand (flagged by auditors)
- **Verification Agent:** Midas's documentation references [Ankura Trust Company](https://docs.midas.app/defi-integration/price-oracle) as a verification agent for off-chain assets (confirmed for mTBILL/mBTC). Whether Ankura specifically covers mHYPER could not be independently confirmed. The daily attestation reports referenced by Midas appear to be self-generated
- **Third-Party Verification:** For Morpho integration, eOracle independently verifies and publishes pricing. Steakhouse applies market discounts for liquidation optimization. No Chainlink Proof of Reserve, no Merkle proofs. The oracle wraps the Chainlink AggregatorV3 interface but is **not** a Chainlink data feed

## Liquidity Risk

- **DEX Liquidity:** Very thin — ~$32K total on Uniswap V4 (mHYPER/USDC 0.2% pool). 24h volume ~$7.6K. Not a viable exit for any meaningful position size
- **Primary Exit:** Via Midas redemption vaults (instant or standard mode)
- **Instant Redemption:** Available when liquidity exists in the RedemptionVaultWithSwapper. DepositVault currently holds ~$463K USDC. Instant redemption liquidity target is only 1-2% of circulating supply (~$437K-$874K). May be temporarily unavailable
- **Standard Redemption:** 1-7 business day queue when instant capacity is insufficient
- **Pendle:** ~$5.53M TVL in mHYPER Pendle pools (yield tokenization, not direct swap liquidity)
- **Stress Test:** mHYPER processed $150M+ in redemptions in 48 hours when Stream Finance unwound its $75M leveraged position. This is a positive signal for the redemption mechanism but required standard (non-instant) processing and active coordination
- **Large Holder Impact:** With ~387 holders and $43M market cap, average position is ~$111K. Large holders likely face multi-day standard redemption queues

## Centralization & Control Risks

### Governance

- **Contract Upgradeability:** Yes — all contracts use `TransparentUpgradeableProxy` with a shared `ProxyAdmin` at [0xbf25b58c...](https://etherscan.io/address/0xbf25b58cB8DfaD688F7BcB2b87D71C23A6600AaC)
- **ProxyAdmin Owner:** [`MidasTimelockController`](https://etherscan.io/address/0xE3EEe3e0D2398799C884a47FC40C029C8e241852) — a verified OpenZeppelin `TimelockController` with a **48-hour minimum delay**. Contract upgrades must be proposed, wait 48 hours, then executed
- **Timelock Proposer/Executor:** Gnosis Safe [0xB60842E9...](https://etherscan.io/address/0xB60842E9DaBCd1C52e354ac30E82a97661cB7E89) — **1/3 threshold** (any single signer can propose/execute). 3 signers:
  - `0x8003544D...` — EOA, funded by Midas deployer (active, 109 txns)
  - `0x82B30194...` — Nested Gnosis Safe (3/7 threshold, 7 signers)
  - `0xC50BD843...` — Dormant EOA (0 ETH, no transactions)
- **Access Control:** Role-based via `MidasAccessControl` ([0x0312A9D1...](https://etherscan.io/address/0x0312A9D1Ff2372DDEdCBB21e4B6389aFc919aC4B))
- **DEFAULT_ADMIN_ROLE holder:** The same 1/3 Gnosis Safe ([0xB60842E9...](https://etherscan.io/address/0xB60842E9DaBCd1C52e354ac30E82a97661cB7E89)) holds `DEFAULT_ADMIN_ROLE` directly — **role changes (mint/burn/pause/blacklist grants) bypass the timelock** and can be executed immediately
- **Governance Model:** No on-chain governance. Midas controls all admin functions
- **Privileged Roles:**
  1. **`M_HYPER_MINT_OPERATOR_ROLE`** — Can mint unlimited mHYPER tokens
  2. **`M_HYPER_BURN_OPERATOR_ROLE`** — Can burn mHYPER tokens from any address
  3. **`M_HYPER_PAUSE_OPERATOR_ROLE`** — Can pause/unpause the contract (freezing all transfers)
  4. **`DEFAULT_ADMIN_ROLE`** — Can grant/revoke all other roles (held by 1/3 Safe, no timelock)
  5. **ProxyAdmin owner** — Can upgrade all contract implementations (via 48hr timelock)
  6. **Oracle updater** — Can set the NAV price via `CustomAggregatorFeed`
  7. **Blacklist operator** — Can blacklist addresses from interacting with the token
- **Fund Seizure:** Yes — the burn operator can burn tokens from any address. The blacklist operator can freeze specific addresses. The pause operator can freeze all activity. Role grants bypass the timelock, so a compromised 1/3 Safe signer could grant themselves these roles immediately
- **Audit Assessment:** Hacken auditors explicitly flagged the protocol as **"highly centralized"** with system admins controlling all critical roles

### Programmability

- **System Operations:** Primarily off-chain. Strategy execution, NAV calculation, and redemption processing are handled by Midas/Hyperithm off-chain
- **Oracle/NAV Updates:** Manual — privileged role updates the `CustomAggregatorFeed` weekly. Not programmatic
- **PPS Definition:** The oracle price IS the PPS. It is updated by an admin role, not computed on-chain from reserves
- **Off-Chain Dependencies:** Critical
  - Hyperithm's strategy execution and NAV reporting
  - Midas's redemption processing
  - KYC/AML verification (greenlist management)
  - Fordefi for MPC custody and transaction signing

### External Dependencies

- **Hyperithm (Critical):** Strategy management, NAV calculation, risk monitoring. Single external dependency for core value proposition. If Hyperithm fails or misreports, token holders have no on-chain recourse
- **Fordefi (Critical):** MPC custody of underlying assets with tri-party governance. All fund movements depend on it
- **Strategy Counterparties (Critical):**
  - **Aave** — Leveraged USDe positions (blue-chip, high trust)
  - **Pendle** — Yield token farming (established)
  - **Hyperliquid** — Basis trading (newer, centralized perps DEX)
  - **Morpho** — Vault liquidity provision (established)
- **Stablecoin Dependencies:** USDC, USDe (Ethena) — depegging events could impact strategy performance
- **Oracle:** Self-reported NAV via custom contract. No independent oracle feed
- **Criticality:** Failure of Fordefi would prevent fund movements. Failure of underlying DeFi protocols could cause direct losses. Strategy diversification across multiple protocols provides some mitigation. The tri-party governance via Fordefi provides some protection, but ultimately Midas Software GmbH controls the on-chain system

## Operational Risk

- **Team Transparency:** Fully doxxed. Dennis Dinkelmeyer (CEO, ex-Goldman Sachs), Fabrice Grinda (Executive Chairman, co-founded OLX, FJ Labs), Romain Bourgois (CPO, ex-Ondo Finance). Team includes alumni from Goldman Sachs, Anchorage Digital, Capital Group
- **Investors:** Framework Ventures (lead), BlockTower, HV Capital, Coinbase Ventures, GSR, Hack VC, Cathay Ledger, 6th Man Ventures, FJ Labs, Lattice Capital. $8.75M seed (March 2024)
- **Documentation Quality:** Comprehensive docs at docs.midas.app covering token mechanics, fees, risk management, smart contracts. Base Prospectus publicly available (approved by FMA Liechtenstein, July 2024). Multiple Final Terms documents filed with MFSA Malta. Note: docs are behind Cloudflare protection
- **Legal Structure:** Midas Software GmbH (Germany), sole shareholder Midas Protocol Limited (London, UK). EUR 25,000 share capital. Incorporated June 2023. BaFin-regulated, MiCA compliant. However, the issuer states it is **not required to be licensed or authorized** under current securities laws and operates **without supervision** by any authority
- **Incident Response:** During the Stream Finance incident, Midas/Hyperithm processed $150M+ in redemptions within 48 hours and communicated publicly. Demonstrated operational capability under stress
- **Hyperithm Concerns:** Alleged regulatory filing failure in South Korea (Dec 2025, per crypto media). Co-CEO's $3M+ TRUMP meme coin position raises risk management culture questions

## Monitoring

1. **Oracle/NAV Updates (CRITICAL)**
   - **Contract:** [0x43881B05C3BE68B2d33eb70aDdF9F666C5005f68](https://etherscan.io/address/0x43881B05C3BE68B2d33eb70aDdF9F666C5005f68) (CustomAggregatorFeed)
   - **Monitor:** `AnswerUpdated` events, `latestRoundData()` values
   - **Alert:** Price decrease >1%, stale price (>10 days without update), unexpected large price jumps
   - **Frequency:** Daily

2. **Access Control Changes (CRITICAL)**
   - **Contract:** [0x0312A9D1Ff2372DDEdCBB21e4B6389aFc919aC4B](https://etherscan.io/address/0x0312A9D1Ff2372DDEdCBB21e4B6389aFc919aC4B) (MidasAccessControl)
   - **Monitor:** `RoleGranted`, `RoleRevoked` events
   - **Alert:** Any role change
   - **Frequency:** Hourly

3. **Contract Upgrades (CRITICAL)**
   - **Contract:** [0xbf25b58cB8DfaD688F7BcB2b87D71C23A6600AaC](https://etherscan.io/address/0xbf25b58cB8DfaD688F7BcB2b87D71C23A6600AaC) (ProxyAdmin)
   - **Monitor:** `Upgraded` events on all proxy contracts
   - **Alert:** Any implementation change
   - **Frequency:** Hourly

4. **Token Supply & Transfers (MANDATORY)**
   - **Contract:** [0x9b5528528656DBC094765E2abB79F293c21191B9](https://etherscan.io/address/0x9b5528528656DBC094765E2abB79F293c21191B9) (mHYPER)
   - **Monitor:** `Paused`/`Unpaused` events, large mint/burn events, `Blacklisted` events
   - **Alert:** Pause events, mints >$1M, any blacklist changes
   - **Frequency:** Hourly

5. **Vault Activity (MANDATORY)**
   - **Contract:** [0x6Be2f55816efd0d91f52720f096006d63c366e98](https://etherscan.io/address/0x6Be2f55816efd0d91f52720f096006d63c366e98) (DepositVault)
   - **Contract:** [0xbA9FD2850965053Ffab368Df8AA7eD2486f11024](https://etherscan.io/address/0xbA9FD2850965053Ffab368Df8AA7eD2486f11024) (RedemptionVaultWithSwapper)
   - **Monitor:** Large deposits/redemptions, vault USDC balance
   - **Alert:** Redemptions >$5M, vault balance <$100K
   - **Frequency:** Daily

6. **External Protocol Health (RECOMMENDED)**
   - Monitor Aave, Pendle, Hyperliquid, Morpho, and Ethena (USDe) for incidents that could impact mHYPER's underlying positions
   - Monitor overall Midas TVL and other LYT redemption patterns for signs of platform-wide stress

## Risk Summary

### Key Strengths

- **Doxxed team with institutional backing** — Goldman Sachs / Morgan Stanley alumni, backed by Coinbase Ventures, Framework Ventures, BlockTower
- **Institutional-grade custody** — Fordefi MPC with tri-party governance prevents unilateral fund access
- **Regulatory compliance** — FMA-approved prospectus, German GmbH legal structure, KYC enforcement on-chain
- **Proven redemption capacity** — Processed $150M+ in redemptions within 48 hours under stress (Stream Finance incident)
- **Multiple audits** — Hacken + two Sherlock contests on shared vault infrastructure. Clean track record (~7 months mHYPER, ~20 months Midas platform)

### Key Risks

- **Off-chain NAV / opaque reserves** — Token holders cannot independently verify that underlying assets match the reported NAV. Oracle is admin-updated weekly, not programmatic
- **Subordinated debt structure** — Investors have no claim on underlying assets. In insolvency, token holders are subordinated creditors of a GmbH with EUR 25,000 share capital
- **Weak multisig and partial timelock** — Contract upgrades have a 48-hour timelock, but role changes (mint/burn/pause/blacklist grants) bypass it entirely. The controlling 1/3 Gnosis Safe means any single signer can grant themselves powerful roles immediately
- **Thin on-chain liquidity** — ~$32K on Uniswap, ~$7.6K daily volume. Exit is entirely dependent on Midas's redemption infrastructure (1-7 days)
- **Concentration risk** — ~387 holders with $43M market cap; single entity (Stream Finance) previously held a $75M leveraged position

### Critical Risks

- **Single-party NAV reporting** — Hyperithm reports NAV, Midas publishes on-chain. No confirmed independent third-party verification for mHYPER specifically (Ankura Trust confirmed for mTBILL/mBTC but unconfirmed for mHYPER). A misreported NAV would directly affect all token holders
- **Role changes bypass timelock** — While contract upgrades have a 48-hour timelock, the 1/3 Gnosis Safe can grant mint/burn/pause/blacklist roles immediately. A single compromised signer could grant themselves these roles and seize or freeze all user funds without any delay
- **Hyperithm risk factors** — Alleged regulatory filing failure in South Korea; co-CEO's large speculative meme coin position contrasts with claimed market-neutral positioning

---

## Risk Score Assessment

**Scoring Guidelines:**
- Be conservative: when uncertain between two scores, choose the higher (riskier) one
- Use decimals (e.g., 2.5) when a subcategory falls between scores
- Prioritize on-chain evidence over documentation claims

### Critical Risk Gates

- [ ] **No audit** → **PASS** — Three audits (Hacken + two Sherlock contests) cover the shared vault infrastructure
- [ ] **Unverifiable reserves** → **BORDERLINE PASS** — Reserves are managed off-chain by Hyperithm. NAV is admin-reported. No independent on-chain verification of underlying assets. However, Midas provides attestation reports, has an FMA-approved prospectus, and the tri-party custody model prevents unilateral fund access. Scoring conservatively but not auto-failing
- [ ] **Total centralization** → **PASS** — Role-based access control, tri-party governance via Fordefi, 48-hour timelock on contract upgrades. Not a single EOA. However, 1/3 multisig threshold and role changes bypass the timelock

**Result:** Protocol passes critical gates. Proceeding to category scoring with conservative bias given the borderline reserves gate.

---

### Category Scoring (1-5 scale, 1 = safest)

#### 1. Audits & Historical Track Record (Weight: 20%)

**Audits:**
- 3 audits: 1 Hacken (reputable but not top-tier) + 2 Sherlock contests (broad coverage)
- Audits cover shared Midas infrastructure, not mHYPER-specific code
- Several findings accepted rather than fixed
- Audits are 18-24 months old relative to current mHYPER deployment
- Bug bounty present on HackerOne but with no guaranteed payout — weak deterrent

**Time in Production:**
- mHYPER: ~7 months (July 2025)
- Midas platform: ~20 months
- TVL ~$43M for mHYPER, ~$275M for Midas total
- No security incidents. Survived one major stress event (Stream Finance)

**Score: 3.0/5** — Multiple audits on vault infrastructure but some findings accepted not fixed, no mHYPER-specific audit, bug bounty without guaranteed payouts, and short production history for mHYPER specifically. Clean operational history partially offsets.

#### 2. Centralization & Control Risks (Weight: 30%)

**Subcategory A: Governance — 3.5**
- Upgradeable proxy contracts with **48-hour timelock** on upgrades via `MidasTimelockController` — users have time to react to proposed upgrades
- However, role changes (mint/burn/pause/blacklist grants) bypass the timelock entirely
- Controlling multisig is a **1/3 Gnosis Safe** — any single signer can act. One signer is a nested 3/7 Safe, one is a dormant EOA
- Admin controls all critical roles (flagged by auditors as "highly centralized")
- Tri-party custody model (Fordefi) is a positive but applies only to fund movements, not contract administration
- No on-chain governance mechanism

**Subcategory B: Programmability — 4.0**
- Strategy execution fully off-chain (Hyperithm)
- NAV/oracle admin-updated weekly, not programmatic
- PPS is admin-reported (not computed on-chain from reserves)
- Redemption partially off-chain (standard redemptions processed by Midas team)
- Users cannot independently compute or verify the exchange rate on-chain

**Subcategory C: External Dependencies — 3.5**
- Hyperithm: single critical dependency for strategy management and NAV calculation
- Fordefi: critical custody infrastructure
- Strategy counterparties: Aave (blue-chip), Pendle (established), Hyperliquid (newer), Morpho (established)
- Stablecoin exposure: USDC, USDe (carries its own depeg risk)
- Diversification across multiple protocols provides some resilience
- Failure of Hyperithm or Fordefi would break core functionality

**Centralization Score = (3.5 + 4.0 + 3.5) / 3 = 3.67**

**Score: 3.7/5** — High centralization driven by off-chain operations, admin-controlled NAV, weak 1/3 multisig, and single-party dependency on Hyperithm. The 48-hour timelock on upgrades is a meaningful positive, but role changes bypass it. Tri-party custody partially mitigates but is itself an off-chain trust assumption.

#### 3. Funds Management (Weight: 30%)

**Subcategory A: Collateralization — 3.5**
- Tokens are subordinated debt instruments — not direct claims on collateral
- Strategies are stablecoin-focused but managed off-chain with discretionary authority by Hyperithm
- Includes leveraged positions across multiple protocols
- No on-chain collateral verification; no over-collateralization requirement
- Tri-party custody via Fordefi prevents unilateral fund access
- Previous recursive lending concerns (~30% of TVL) addressed but indicates structural vulnerability
- EUR 25,000 share capital provides minimal corporate protection

**Subcategory B: Provability — 3.5**
- NAV reported by Hyperithm, published by Midas weekly via admin-controlled oracle
- Reserve transparency is hybrid: some strategy wallets on-chain, full portfolio off-chain
- Ankura Trust serves as verification agent for Midas's off-chain assets (confirmed for mTBILL/mBTC), but specific coverage of mHYPER unconfirmed
- No Chainlink Proof of Reserve, no Merkle proofs
- For Morpho integration, eOracle provides independent price verification
- Token holders cannot independently compute the NAV

**Funds Management Score = (3.5 + 3.5) / 2 = 3.5**

**Score: 3.5/5** — Off-chain funds management with admin-reported NAV and subordinated debt structure. Some verification infrastructure exists (Ankura for broader Midas, eOracle for Morpho) but not independently confirmed for mHYPER specifically. Leveraged strategy positions add risk.

#### 4. Liquidity Risk (Weight: 15%)

- **Exit Mechanism:** Instant redemption at oracle price (0.50% fee) when available, otherwise standard redemption in 1-7 business days
- **DEX Liquidity:** Very thin — ~$32K total on Uniswap V4, ~$7.6K daily volume. Not viable for any meaningful size
- **Instant Redemption Capacity:** DepositVault holds ~$463K USDC. Liquidity target 1-2% of circulating supply. May be temporarily disabled
- **Pendle:** ~$5.53M TVL in mHYPER pools (yield tokenization, not direct exit liquidity)
- **Stress Performance:** Processed $150M+ in 48 hours during Stream Finance incident, but via standard redemption requiring active coordination
- **Large Holder Impact:** ~387 holders, average ~$111K. Significant exits require multi-day standard redemption path

**Score: 3.0/5** — Redemption mechanism works (proven under $150M stress), but entirely dependent on Midas infrastructure. No meaningful secondary market. Standard redemptions take up to 7 business days. Adjusted -0.5 for demonstrated stress resilience.

#### 5. Operational Risk (Weight: 5%)

- **Team:** Fully doxxed with strong institutional backgrounds (Goldman Sachs, Morgan Stanley, Ondo Finance, OLX). Well-funded ($8.75M from top crypto VCs)
- **Hyperithm:** Established fund manager (founded 2018), backed by Coinbase Ventures, Samsung Next. Dual-registered (Japan FSA, South Korea KoFIU). Concerns around co-CEO's TRUMP meme coin position and alleged regulatory filing failure
- **Documentation:** Comprehensive docs, publicly available prospectus, weekly reports
- **Legal:** German GmbH with FMA-approved prospectus, MiCA compliant. BUT: EUR 25,000 share capital (thin), newly incorporated (2023), states it operates "without supervision" by any authority

**Score: 1.5/5** — Strong team transparency and institutional credibility. Well-documented and regulated. Minor concerns about Hyperithm regulatory compliance and the thinly capitalized legal entity.

### Final Score Calculation

```
Final Score = (Centralization × 0.30) + (Funds Mgmt × 0.30) + (Audits × 0.20) + (Liquidity × 0.15) + (Operational × 0.05)
            = (3.7 × 0.30) + (3.5 × 0.30) + (3.0 × 0.20) + (3.0 × 0.15) + (1.5 × 0.05)
            = 1.11 + 1.05 + 0.60 + 0.45 + 0.075
            = 3.285
            ≈ 3.3
```

| Category | Score | Weight | Weighted |
|----------|-------|--------|----------|
| Audits & Historical | 3.0 | 20% | 0.60 |
| Centralization & Control | 3.7 | 30% | 1.11 |
| Funds Management | 3.5 | 30% | 1.05 |
| Liquidity Risk | 3.0 | 15% | 0.45 |
| Operational Risk | 1.5 | 5% | 0.075 |
| **Final Score** | | | **3.3/5.0** |

### Risk Tier

| Final Score | Risk Tier | Recommendation |
|------------|-----------|----------------|
| 1.0-1.5 | Minimal Risk | Approved, high confidence |
| 1.5-2.5 | Low Risk | Approved with standard monitoring |
| **2.5-3.5** | **Medium Risk** | **Approved with enhanced monitoring** |
| 3.5-4.5 | Elevated Risk | Limited approval, strict limits |
| 4.5-5.0 | High Risk | Not recommended |

**Final Risk Tier: Medium Risk (3.3/5.0)**

**Recommendation:** Approved with **enhanced monitoring** and strict exposure limits.

**Required Conditions:**
1. **Limited Exposure** — Cap allocation at 10-15% of vault with gradual ramp-up
2. **Enhanced Monitoring** — Real-time alerts on oracle updates, role changes, contract upgrades, and vault activity (see Monitoring section)
3. **Verify Multisig Configuration** — Confirm the ProxyAdmin owner and role holder multisig setup before deployment
4. **Monthly NAV Cross-Check** — Independently estimate NAV from known strategy positions where possible
5. **Quarterly Reassessment** — Given the off-chain nature and evolving regulatory landscape

**Key Concerns Driving the Score:**
- Off-chain NAV reporting with no confirmed independent verification for mHYPER
- Role changes (mint/burn/pause/blacklist grants) bypass the 48-hour timelock; 1/3 multisig threshold
- Subordinated debt structure (no direct claim on assets)
- Thin secondary market liquidity
- Single-party dependency on Hyperithm for strategy and NAV

**Mitigating Factors:**
- Strong team and institutional backing
- Clean ~7-month track record (mHYPER) / ~20-month (Midas platform)
- Proven redemption under stress ($150M+ in 48 hours)
- Institutional-grade custody (Fordefi tri-party MPC)
- FMA-approved prospectus and German legal entity
- Multiple audits on shared infrastructure

---

## Reassessment Triggers

- **Time-based**: Reassess in 3 months (May 2026)
- **TVL-based**: Reassess if mHYPER market cap changes by more than 50%
- **Incident-based**: Reassess after any exploit, NAV discrepancy, governance change, contract upgrade, or regulatory action
- **Hyperithm regulatory outcome**: Reassess when South Korean regulatory filing matter is resolved
- **Timelock expansion**: If Midas extends the 48-hour timelock to cover role changes (not just upgrades) or increases the 1/3 multisig threshold, reassess for potential score improvement
- **Audit**: If new audit covering current mHYPER contracts is published, reassess
- **Ankura verification**: If Ankura Trust coverage for mHYPER is confirmed or denied, adjust Provability score accordingly
