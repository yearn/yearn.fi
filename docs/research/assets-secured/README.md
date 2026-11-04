# Assets secured — reconciled working estimate

**Working subtotal: $200,443,826.64 at October 21, 2026 UTC close.**
Status: incomplete coverage; approximately $200m, not a certified complete total. The landing-page mockup uses the approved $369,349,929 recorded-value placeholder described below.

| Component | USD |
| --- | ---: |
| Existing V1/V2/V3 net baseline, excluding curation | 155,372,779.85 |
| Net additional Ethereum candidates | 45,071,046.79 |
| Working subtotal | 200,443,826.64 |

Ethereum reads use block 26244424, matching baseline timestamp 1792627199. Baseline dataset: 8abc7c4e167136de10b7c81d3ce0fc68e6dded920a6b58b4f797de604820c703. Candidate prices are independently sourced at the same close; provider differences remain a qualification.

## Material findings

### Katana pre-deposits

The eight large source vaults retain nominal debt after migration. Their STB depositor strategies have zero underlying-token balance, zero vault-share balance and zero valueOfVault. Verified bridgeFunds code sends vault shares to the bridge for the Katana receiver without updating the strategy's recorded asset balance in that function. The working subtotal excludes these source-side residual balances. This is not a claim that the bridged assets disappeared or proof of all destination allocations. The user subsequently approved counting mainnet backing and active L2 representations as separate contract-layer exposure. Current backing attribution remains unresolved; see the policy update below.

### Octant

Found 15 deployments from all paginated StrategyDeploy events of the three official mainnet factories. Their dated gross assets total $1,216,625.66. Morpho wrappers hold shares in the already-counted Yearn compounder 0x074134A2784F4F66b6ceD6f68849382990Ff3215. After ownership deductions, the additional amount is $11,666.06, predominantly Sky wrappers.

The largest funded deployment is SHUGrantPool, 0xb21FbD35AC45caC1D5011b74Ce06b31f8EB2C377. The other SHUGrantPool deployment has zero recorded assets at the selected block.

Official registry (default branch is develop, not main):
https://github.com/golemfoundation/octant-v2-core/blob/develop/script/helpers/DeployedAddresses.sol

Factories:
- Sky: 0xbe5352d0eCdB13D9f74c244B634FdD729480Bb6F
- Morpho: 0x052d20B0e0b141988bD32772C735085e45F357c1
- Yearn V3: 0x6D8c4E4A158083E30B53ba7df3cFB885fC096fF6

The third factory has no events in the retrieved explorer index. Source checks of 32 MultistrategyVault search matches did not identify Octant/Yearn implementations. This does not prove absence of independently deployed forks; coverage outside the official factories remains unconfirmed.

### Other overlaps

- Savings crvUSD: direct holdings plus proportional Curve LP exposure are deducted. The material Curve overlap is about $375,810; whole pool balances are not deducted.
- yETH Recovery and Arbitrum FRAX-VST are already in the baseline, not extra additions.
- A small hidden-vault-to-hidden-vault ownership is deducted once with caps.
- Term reserve targets were checked through the verified strategyState getter. The largest strategy's reserve is MetaMorphoV1_1, outside the contracts-only baseline, so its existence alone does not create a deduction.

### Existing page TVL scope

The page's existing TVL source includes curation despite the endorsed-vault display label. At this close, curation contributes $51,810,570.83, excluded here. Thus this broader contracts metric can be smaller than the page's stale, differently scoped $208m figure. The old figure must not be added to the partner balances.

## Remaining limitations

- Baseline explicitly reports missing prices and known-candidate overlap mapping scope; the resulting amount is a known subtotal.
- Seventeen non-Ethereum hidden vaults were revalued at the same close: $12,915.50 gross. Their overlaps are not yet reconciled and they are excluded here. The remaining failed non-Ethereum read is a vault already in the baseline.
- Official-factory Octant coverage is established, but independent deployments and complete Term product coverage are not certified.
- Getter-based discovery cannot establish absence of every indirect, collateral or cross-chain exposure. No numeric error bound is claimed for those unknowns.
- Cross-chain overlap is explicitly allowed for this metric. Destination-side entitlement and current backing attribution are not complete.

## Evidence and reproduction

Run python3 docs/research/assets-secured/calculate.py to reproduce calculation.json offline. That file contains the full addition/deduction ledger and explicit limitations.

- baseline-graph.json: dated Yearn Data graph and coverage diagnostics.
- dated-candidates.json: Ethereum balances, tokens and dated prices.
- candidate-overlaps.json: downstream getters and actual share ownership.
- incoming-holdings.json: baseline holders and asset-contract holdings, including failed-call counts.
- lp-overlaps.json: proportional Curve exposure.
- octant-deployments.json: factory events and transaction hashes.
- katana-live-claims.json: source-side bridge balance checks.
- other-chains.json: dated Base, Arbitrum, Gnosis and Sonic reads.
- stb-verified-source.json: verified depositor code from Blockscout.
- first-pass.md: superseded discovery-stage calculation.

Public evidence sources:
- https://yearn-data-api-preview.vercel.app/api/tvl/graph
- https://kong.yearn.fi/api/rest/list/vaults
- https://eth.blockscout.com/api/v2/addresses/0x052d20B0e0b141988bD32772C735085e45F357c1/logs
- https://eth.blockscout.com/api/v2/smart-contracts/0x63a028963907F5a0c1cEb7e47100f52DfC611117
- https://developers.term.finance/periphery-contracts/curated-vaults/deployed-contracts/ethereum

Collectors perform read-only calls. No upstream data publication, production changes or transactions were made.

## Approved scope update — October 23, 2026

The user explicitly permits counting mainnet backing and its active Katana representation together for Total assets secured. This is contract-layer exposure, not deduplicated TVL. Ordinary duplicate inventory entries and vault/strategy nesting are still reconciled; this exception does not authorize double-counting all wrappers.

The previous $200.44m subtotal is therefore an incomplete subtotal under the newly approved scope, not the final answer.

Simply restoring the eight pre-deposit vaults' dated recorded balances adds $168,906,102.10, giving a **recorded-value scenario of $369,349,928.74**. This scenario is not validated current assets secured and must not be published as such.

Read-only calls at Ethereum block 26244424 to the four destination VaultBridge contracts found:

| Mainnet backing asset | Vault totalAssets, USD | Bridge-held shares converted to underlying, USD |
| --- | ---: | ---: |
| USDC | 6,633,553.19 | 6,142,858.57 |
| WETH | 5,214,049.82 | 4,462,229.62 |
| USDT | 2,504,196.64 | 2,169,065.45 |
| WBTC | 12,281,892.13 | 12,146,591.52 |
| Total | 26,633,691.78 | 24,920,745.16 |

These are aggregate contract observations, not attribution to the original pre-deposit deposits. They cannot automatically be added in full, nor used to infer a loss. The material mismatch with retained pre-deposit accounting means migrations, withdrawals, upgrades and entitlement ownership need tracing before a current contribution is selected.

Evidence: mainnet-bridge-backing.json includes the four contract addresses, pinned block, balances, conversions and price inputs. The landing-page mockup displays $369,349,929 as an approved preliminary placeholder. This does not resolve the outstanding attribution and coverage checks; the data must be confirmed and updated before production.
