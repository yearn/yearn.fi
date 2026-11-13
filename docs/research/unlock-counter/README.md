# Depositor-share unlock counter: Ethereum pilot

Read-only research for the alternative landing hero. No application, upstream data, transaction, commit or push changes were made. The landing page still uses its existing earnings hero.

## Result

Snapshot: **2026-11-04 14:33:59 UTC**, finalized Ethereum block **26342075**. Block hash, raw reads, on-chain versions, underlying asset metadata, source-price observations and selection metadata are in `snapshot.json`.

A $10,000 discovery cutoff gives 36 visible active Yearn V3 vaults across four qualifying chains at this inventory capture: Ethereum 25, Katana 6, Base 4, Arbitrum 1. A $1,000 cutoff also includes Polygon and gives 48 vaults. Raising the cutoff from $1,000 to $10,000 removes 12 entries and $37,312.62 of gross listed TVL (approximately 0.029%). This is selection sensitivity, not a deduplicated network TVL claim.

The report includes non-overlapping, TVL-sorted buckets: $1k–under $10k (12), $10k–under $25k (6), $25k–under $100k (2), and $100k+ (28). Each vault appears once, with chain and contract address; the summary table retains cumulative cutoff counts. Memberships are retained in `snapshot.json` and collected on future runs. The initial lists were reconstructed from the retained discovery inventory; every cutoff count and gross sum matches the original snapshot.

Selection requires `v3`, `inclusion.isYearn`, `type === 'Yearn Vault'`, not hidden, not retired, finite listed `tvl >= cutoff`. The inventory is not block-pinned; actual state reads are pinned. Every priced Ethereum candidate also exceeds $10k using the measured holder conversion value; the unpriced candidate remains unavailable. V2, hidden vaults, special wrappers without this metadata type and partner-only contracts are outside this pilot. These exclusions need an explicit coverage decision before aggregate publication.

## Representative results

| Vault | Non-self holder value | USD/s at snapshot | Next hour | Next 24 hours | Total remaining unlock |
| --- | ---: | ---: | ---: | ---: | ---: |
| USDC-1 | $18,229,742.73 | $0.033921 | $122.12 | $2,931.27 | $13,534.91 |
| WETH-1 | $10,741,878.34 | $0.016977 | $61.12 | $1,466.99 | $8,931.21 |
| Morpho Yearn OG USDC Compounder | $7,466,729.03 | $0.016008 | $57.63 | $1,383.33 | $3,118.02 |
| Yearn BOLD | $7,577,251.94 | $0 | $0 | $0 | $0 |
| Staked yBOLD | $7,500,138.91 | $0.026143 | $27.61 | $27.61 | $27.61 |
| Compound V3 USD Lender | $15,541.71 | $0 | $0 | $0 | $0 |

Values are at frozen snapshot prices and assume no intervening transactions or new reports. Staked yBOLD finishes in 1,056 seconds (~17.6 minutes), so its initial rate must not be extrapolated for a full hour or day. Zero scheduled unlocking does not establish zero economic yield: underlying strategies may accrue value before their next report.

Rows must not be summed as unique capital. Staked yBOLD holds Yearn BOLD shares, and the snapshot finds seven nonzero direct candidate-to-candidate positions, including dust. Strategy-routed ownership and other-chain positions remain unresolved.

## Accounting

For the supported deployed V3 allocator / Tokenized Strategy versions:

- `A = totalAssets()` in raw underlying units.
- `S0 = totalSupply()` is effective supply, already excluding unlocked shares.
- `L0 = balanceOf(vault)` is the remaining effective self-held share balance, also already excluding unlocked shares.
- `H = S0 - L0` is shares held by all non-self accounts. This includes smart-contract holders, custodians and fee recipients; it is not an EOA-only balance or net-of-fee-recipient inventory.
- `U0 = unlockedShares()`; raw self-held shares are `L0 + U0`.
- The scheduled unlock rate is scaled by `10^12` and is denominated in raw shares, not asset units.
- Before expiry, compute absolute scheduled unlocked shares from `rate * (t - lastProfitUpdate or lastReport) / 10^12`, subtract `U0`, clamp between zero and `L0`.
- At/after `fullProfitUnlockDate`, all `L0` remaining shares are unlocked. A zero end date or zero remaining self balance contributes no scheduled unlock.
- `V_assets(t) = floor(H * A / (S0 - additionalUnlocked(t)))`.
- `V_usd(t) = V_assets(t) / 10^assetDecimals * snapshotAssetUsdPrice`.

This is the book conversion value of all non-self-held shares. It does not simulate `maxWithdraw`, queue liquidity, exit hooks, individual exit costs, unrealized losses or the successful simultaneous redemption of every holder. The requested “current redeemable value” should be understood as this share-conversion value for the pilot; immediate liquid redemption capacity would be a separate metric.

The instantaneous USD/s derivative is `A * H * (rate / 10^12) / S0^2`, adjusted for asset decimals and USD price. The full schedule is slightly nonlinear. `unlockSharesPerSecond * pricePerShare` alone does not capture the exact holder-value derivative because effective supply changes as shares unlock.

### Version detail

The existing landing source excerpt differs from the self-balance semantics of the selected deployments. Official allocator tags v3.0.2, v3.0.3 and v3.0.4 and Tokenized Strategy v3.0.4 have effective self-balance getters. Do not subtract `unlockedShares()` from `balanceOf(vault)` a second time. On-chain API versions matched the inventory for all 25 rows. Unknown versions require their own validation rather than silent fallback.

Sources:
- https://github.com/yearn/yearn-vaults-v3/blob/v3.0.2/contracts/VaultV3.vy
- https://github.com/yearn/yearn-vaults-v3/blob/v3.0.3/contracts/VaultV3.vy
- https://github.com/yearn/yearn-vaults-v3/blob/v3.0.4/contracts/VaultV3.vy
- https://github.com/yearn/tokenized-strategy/blob/v3.0.4/src/TokenizedStrategy.sol
- Inventory: https://kong.yearn.fi/api/rest/list/vaults
- Prices: https://coins.llama.fi/prices/historical/1793802839/ethereum:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48

## Validation

`verification.json` records **100/100 exact matches** between the model and on-chain `convertToAssets(H)` evaluated at pinned storage with block timestamp overrides: snapshot, +1 hour, +24 hours and after the schedule ends, for all 25 candidates. This is read-only `eth_call`, not a fork transaction or chain mutation. All initial full-supply conversions also matched `totalAssets()`. Asset decimal metadata matches share decimals for the selected rows.

Contract asset arithmetic stays in BigInt through integer share accounting and rounding. USD presentation uses floating-point numbers, adequate for this mockup but not an accounting ledger. All model projections assume fixed state other than timestamp-dependent unlocking. New reports, deposits, withdrawals, configuration changes, losses, rebases and changing underlying share prices require a refreshed snapshot or additional modeling.

Historical price observations have their own timestamps, up to 8,066 seconds from the pinned block, and minimum reported confidence 0.95. They are frozen for this research. Sturdy pxETH Compounder has no price in this response and remains unavailable in USD. No $1 or zero substitution was used.

## Files and running

- `collect.mjs`: read-only inventory, finalized/pinned multicall reads, prices and direct candidate holdings; captures public data only.
- `model.mjs`: integer share-value projection and USD conversion.
- `calculate.mjs`: per-vault results and forward comparisons.
- `verify.mjs`: independent contract-execution comparison using block timestamp overrides.
- `model.test.mjs`: tests for captured-state agreement, schedule expiry, monotonicity, unavailable prices and unsupported input.
- `report.html` / `report.mjs`: review table and interactive seven-day timeline; no live-source calls from the browser.

From this checkout, with installed workspace dependencies:

```sh
# Supply an Ethereum RPC through ETHEREUM_RPC_URL if required.
node docs/research/unlock-counter/collect.mjs
node docs/research/unlock-counter/calculate.mjs
node docs/research/unlock-counter/verify.mjs
/usr/bin/node --test docs/research/unlock-counter/model.test.mjs
python3 -m http.server 4792 --bind 127.0.0.1 --directory docs/research/unlock-counter
```

`SNAPSHOT_BLOCK=26342075` repeats the same block for collection; external inventory and price responses may change. `collect.mjs` overwrites the artifacts intentionally; keep the original snapshot when comparing captures.

## Proposed next boundary

Use $10k as an initial threshold, then recheck eligibility against priced non-self share value at each publication. Resolve selected vault/strategy ownership before adding values together. Extend the pilot to the other qualifying chains and make V2/special-wrapper coverage explicit. Keep asset prices and provenance timestamped. Refresh a shared schedule snapshot periodically; browsers use its timestamp and schedule, stop expired contributions, and display unavailable/stale coverage explicitly. The aggregate and landing hero are not changed by this research.

## Overlap and recognition follow-up

`overlap-trace.json` reads 53 paths at the same pilot block: selected parents' default queues plus observed direct candidate holdings. The queue is not an exhaustive historical strategy list. `trace-overlaps.mjs` records each parent debt, child holdings, both unlock settings and future timestamp-only conversions.

Confirmed examples:

- USDC-1 → USDC to sUSDS Lender: child unlock period 0; parent 864,000 seconds (10 days). Strategy gains can be immediate at the child report and then locked by the parent report.
- USDC-1 → USDC to USDS Depositor: child 259,200 seconds (3 days); parent 10 days. Over the next hour the parent's child position appreciates by 54.944803 USDC, but parent totalAssets stays fixed without a report.
- yvUSD → Morpho Yearn OG USDC Compounder: child 3 days, parent 5 days. Parent-held position increases by 54.777492 USDC over an hour while parent recorded assets stay fixed. Its own current unlock schedule is a separate existing report schedule.
- Yearn BOLD → three Liquity Stability Pool strategies: child and parent unlock periods are zero. A zero scheduled derivative between reports does not mean zero economic yield.
- Staked yBOLD → Yearn BOLD: parent asset() is the child share token. This is underlying-share repricing, not same-asset strategy debt. A complete USD projection must propagate child share prices; child schedule happens to be inactive at this snapshot.

Of Morpho Yearn OG USDC's non-self shares, yvUSD holds 95.003575%, USDC-2 holds 3.576103%. The residual after only these known direct holdings is 1.420322%, reducing the whole-holder $0.0160077915/s to $0.0002273622/s for that residual. This is a partial example, not proof those remaining shares all belong outside the counted system. Do not sum full child and parent schedules as external-holder appreciation. Do not infer future parent reports from child unlocking.

The canonical metrics API's summary and filtered graph are retained in `metrics-summary.json` / `metrics-graph.json`. Source implementation in yearn-data uses `totalAssets()` for V2/V3 gross valuation and its existing `account()` ledger for direct and strategy-routed ownership, shared-holder budgets and caps. Reuse that ledger rather than creating a second independent TVL deduction system. Graph flow USD and deducted USD are distinct; displayed edges cannot simply be summed.

The inspected publication ends October 29, 2026 23:59:59 UTC and reports incomplete known-subtotal coverage. It is not a current November 4 baseline. No older ownership ratio is applied to the new pilot. The raw summary includes locked profits in totalAssets, unlike the requested non-self depositor-share baseline. Adding the same existing locked profits as future growth to unadjusted TVL would double count them. Derive the share-value baseline using matched-dated ledger inputs, or explicitly choose a different metric definition.

Proposed aggregate: identify counted external holder positions using the full ownership graph, compute their share conversions through time, propagate share-token underlying prices where applicable, then sum the USD differences. Retain report-gated debt at its recorded value between reports. Reuse matched timestamps, scope, ownership budgets and price policy for both baseline and growth. The $10k root cutoff must not prune intermediate nodes or internal holders needed to attribute selected roots. A final all-network total or unlock rate has not been published.

## Static aggregate pilot

`pilot-depositor-value.json` is the proposed static response shape. At the November 4 pilot block:

| Item | USD |
| --- | ---: |
| Unadjusted non-self holder subtotal, with the selected share-token underlying repriced on-chain | 109,885,967.09 |
| Observed attributed internal share value | 26,874,124.14 |
| Overlap-adjusted known subtotal | **83,011,842.95** |
| Starting rate, average over the first 60 seconds | **0.123903 per second** |
| Projected gain over one hour | **379.56** |
| Projected gain over 24 hours | **8,475.56** |

This is a closed 25-root Ethereum pilot with 24 valued roots. The complete total remains null; Sturdy pxETH has no USD price. V2, other chains, hidden/retired/sub-cutoff roots and unknown historical allocations are outside this cut. Holders outside the selected root set are external to this pilot even if they are other Yearn contracts. This subtotal is not an all-network TVL claim or a mathematically certified lower bound.

### Attributing the overlaps

`collect-internal-holdings.mjs` checks 1,725 same-block child/holder pairs spanning selected roots and observed strategy holders. It finds 11 nonzero balances and no unavailable reads. Ten positions receive nonzero internal attribution; the Spark route has zero recorded parent debt and receives zero budget.

`generate-pilot.mjs` uses `apply-ledger.py` to call the existing `yearn_data.tvl.account` implementation, identified by source commit and code hash. Inputs use current pilot gross assets, debt budgets, underlying conversions and prices; no older publication's dollar values or ownership ratios are reused. `pilot-ledger-inputs.json` and `pilot-ledger-audit.json` retain both sides of that call.

The share-value view has one deliberate difference from the TVL dollar ledger: direct internal ownership excludes the observed child shares in full (or totalAssets child-share units for a wrapper), even when recorded parent debt or its own locking makes the parent's current redeemable value smaller. Otherwise the wrapper's locked value would appear as external child value, and its unlocking could be cancelled by a moving dollar deduction. Routed ownership through unselected strategies uses the canonical engine's shared-holder debt budgets and caps. The remaining routed residual is an accounting allocation, not proof that every residual share is owned by an external wallet.

Translate the routed dollar allocation to atomic child-share quantities at the snapshot using Decimal arithmetic, then freeze those quantities. Each child's non-self shares minus incoming attributed shares supplies its external pilot share quantity. All future points value these same positions with the unlock model. Reapplying moving dollar caps at every future point is intentionally avoided. Directly owned positions must not be counted again via an intermediary. Share-conservation tests enforce this.

The Staked yBOLD underlying share token is priced through Yearn BOLD's on-chain conversion and the BOLD quote, rather than a separately timed yBOLD price quote. Other base asset prices are frozen. The one-hour response includes 60-second points plus exact schedule-expiry boundaries; consumers interpolate only within that range and request a fresh snapshot afterward. The 24-hour result is a separate comparison under the same fixed-state assumptions, not a live validity extension.

The rate is a first-minute average of the fully adjusted projection, not a raw sum of contract `profitUnlockingRate` values and not a constant extrapolation over the next day. In particular, Staked yBOLD's remaining $27.61 schedule expires within the first hour.

### Reproduce and verify

```sh
node --env-file=<local-env-file> docs/research/unlock-counter/collect-internal-holdings.mjs
METRICS_SOURCE=<yearn-data-checkout> METRICS_PYTHON=<yearn-data-python> \
  /usr/bin/node docs/research/unlock-counter/generate-pilot.mjs
/usr/bin/node --test --experimental-test-isolation=none \
  docs/research/unlock-counter/model.test.mjs \
  docs/research/unlock-counter/pilot.test.mjs
```

Ten tests cover captured conversions, schedule caps, unavailable states, root/aggregate reconciliation, internal share conservation, shared-holder limits and retention of wrapper unlocking. The original 100 future-timestamp contract comparisons continue to validate the per-vault projection model. The static aggregate itself remains a scoped ownership pilot, not production-validated reporting.

## Expanded V2 and factory pilot

`expanded-pilot-depositor-value.json` extends the same Ethereum block and $10k root cutoff to 95 V2 vaults, including 38 tagged factory vaults and 48 funded retired V2 vaults. Retirement does not remove depositor capital. Together with the original 25 V3 roots, the selection contains 120 roots: 107 priced and 13 with unavailable prices. Another 69 funded V2 candidates have unknown cutoff eligibility because their prices are missing. These are listed separately, never assumed to be zero.

| Measure | Original V3 | Expanded V2/V3 |
| --- | ---: | ---: |
| Adjusted known depositor value | $83,011,842.95 | $128,983,759.58 |
| Attributed overlap removed | $26,874,124.14 | $54,413,376.07 |
| First-minute average unlock rate | $0.123903/s | $0.206016/s |
| One-hour scheduled increase | $379.56 | $675.16 |
| 24-hour scheduled increase | $8,475.56 | $14,645.80 |

V2 uses shares multiplied by free funds (total assets minus remaining locked profit), divided by total supply. The remaining lock decays from lastReport at the version-specific degradation rate. Version 0.3.0 has no profit lock; 0.3.2 and 0.3.5 expose the historical `lockedProfitDegration` spelling. Raw reads and explicit normalization provenance are retained. All 380 V2 pricePerShare checks match contract execution at the snapshot and three future timestamps. Original V3 checks remain preserved.

The expanded holder scan covers 42,240 pairs with 40 positive balances, no unavailable reads, and 30 nonzero attributed positions. V2 allocator routes into V3 children are deducted using the same snapshot ownership rules; for example, the USDC allocator route removes approximately $4.70m. Self-referential graph edges are excluded. Other-chain, hidden and sub-cutoff roots remain outside this closed pilot. The subtotal is incomplete and is not a full-network TVL claim.

Expanded artifacts use the `expanded-` prefix. Collection and verification are in `collect-v2.mjs` and `verify-v2.mjs`; `merge-v2.mjs` combines the selections. Run the shared trace, holdings and generation scripts with `PILOT_PREFIX=expanded-`. Use `/usr/bin/node` for generation with `METRICS_SOURCE` and `METRICS_PYTHON` pointing at the local yearn-data checkout and Python environment. No upstream database is modified. Add `expanded.test.mjs` to the test command above.

## Multichain extension

`multichain.html` and `multichain-pilot-depositor-value.json` extend the pilot to every chain with visible in-scope inventory: Ethereum, Optimism, Polygon, Fantom, Base, Arbitrum and Katana. The original Ethereum snapshot and subtotal are preserved. Each new chain uses the nearest block at or before the original common timestamp, November 4, 2026 14:33:59 UTC. Block timestamps differ by at most 14 seconds. Models advance the block state to that common timestamp before calculating baseline and growth; asset quotes stay fixed at their historical block-time values.

| Chain | Priced / selected roots | Adjusted known value | Starting USD / second | Overlap removed |
| --- | ---: | ---: | ---: | ---: |
| Ethereum | 107 / 120 | $128,983,759.58 | $0.206016 | $54,413,376.07 |
| Optimism | 4 / 14 | $129,779.66 | $0.000000 | $0.31 |
| Polygon | 0 / 0 | $0.00 | $0.000000 | $0.00 |
| Fantom | 2 / 9 | $60,075.96 | $0.000000 | $0.00 |
| Base | 4 / 6 | $2,060,395.95 | $0.003196 | $1,952,914.56 |
| Arbitrum | 2 / 2 | $39,972.41 | $0.000021 | $0.00 |
| Katana | 6 / 6 | $14,083,918.96 | $0.004813 | $829,555.42 |
| **Combined** | **125 / 157** | **$145,357,902.52** | **$0.214046** | **$57,195,846.37** |

The combined scheduled gain is $704.06 over one hour and $15,339.66 over 24 hours. Polygon was screened but no root qualifies under the $10k rule; zero here is only a contribution to this selected pilot. Thirty-two selected roots have unavailable USD values. Another 153 funded candidates have unknown cutoff eligibility. These are retained as distinct coverage gaps, not assumed dollar zeros. New-chain price acceptance requires a positive DefiLlama historical quote, confidence >=0.9, and a timestamp within 24 hours. Mainnet retains the original pilot quotes. Fantom bridged assets are not assigned an assumed dollar peg.

### Ownership and verification boundaries

Each chain reuses the canonical Yearn Data ownership engine with its actual chain ID. Same addresses on different chains are separate identities. The scans cover 43,365 root/holder pairs in total; 36 positions receive nonzero internal attribution. This extends chain-local direct and strategy-routed overlap adjustments, not a complete bridge/migration census. Unobserved cross-chain routes, historical allocations and adapters remain unresolved. The combined subtotal is not certified unique global capital or complete Yearn TVL. Other original pilot exclusions still apply.

All new selected roots match captured contract conversions. In addition to Ethereum's 480 prior comparisons, 112 new snapshot/future timestamp-override comparisons pass on Optimism, Base, Arbitrum and Katana. Fantom's provider cannot route timestamp-override calls: its nine snapshot calls pass without overrides, and every selected Fantom schedule has zero remaining locked profit, so the fixed-state future projection is constant. The JSON records this exhausted-schedule proof separately rather than claiming future contract verification. Polygon has no selected contract checks. Eighteen local model/accounting tests cover reconciliation, share conservation, chain identity, snapshot alignment, missing states and verification receipts.

### Reproduce a chain

```sh
PILOT_CHAIN_ID=8453 /usr/bin/node --env-file=<local-env-file> docs/research/unlock-counter/collect-chain.mjs
PILOT_CHAIN_ID=8453 /usr/bin/node --env-file=<local-env-file> docs/research/unlock-counter/verify-chain.mjs
PILOT_CHAIN_ID=8453 PILOT_PREFIX=chain-8453- SKIP_FUTURE=1 \
  /usr/bin/node --env-file=<local-env-file> docs/research/unlock-counter/trace-overlaps.mjs
PILOT_CHAIN_ID=8453 PILOT_PREFIX=chain-8453- \
  /usr/bin/node --env-file=<local-env-file> docs/research/unlock-counter/collect-internal-holdings.mjs
PILOT_PREFIX=chain-8453- METRICS_SOURCE=<yearn-data-checkout> METRICS_PYTHON=<yearn-data-python> \
  /usr/bin/node docs/research/unlock-counter/generate-pilot.mjs
/usr/bin/node docs/research/unlock-counter/combine-chains.mjs
```

Use the same steps for chain IDs 10, 137, 250, 42161 and 747474; Fantom verification requires `NO_TIMESTAMP_OVERRIDES=1`, which refuses any active schedule. The collector reads `/tmp/unlock-inventory.json` by default, or `INVENTORY_FILE`; retain the original Kong inventory for reproducible selection. RPC credentials come from configured environment variables and are omitted from all artifacts. No transactions or database writes occur. Add `multichain.test.mjs` to the test command above. The combined one-hour curve is the sum of chain curves at a union of their timestamps, with linear interpolation inside each published curve.

## Unified DB graph regeneration

The primary multichain JSON and report now use model `global-fixed-share-attribution-db-graph-v3`. The previous chain-local result is retained in `multichain-chain-local-pilot.json`; its original per-chain artifacts remain unchanged. The same 157 roots, asset quotes and November 4 block states are used, isolating the ownership change from market movement or scope expansion.

The updated DB dataset `4a8caca4b3901493b2f691a7c1b5174cb5fa46e223e2439175b4934cb5311505` supplies route identities, including source-chain strategy and destination-chain remote holder. Its November 3 dollar balances and allocation percentages are not copied. `collect-db-ownership.mjs` rechecks all 48 distinct route balances and recorded debt budgets at the stored pilot blocks; all reads succeed. The existing direct/queue scan supplements DB mappings. Parents or children outside the selected pilot are retained as scope exclusions rather than silently expanding the headline.

`generate-global-pilot.mjs` passes all selected chains and positions to the canonical ownership engine in one call. Position identities include source chain, destination chain and remote holder. Routed allocation uses the canonical shared-holder budgets and caps; direct holdings retain the exact-share exclusion rule. The resulting atomic share quantities remain fixed throughout the future projection. No older dollar deduction is subtracted from a newer baseline or repeatedly applied as the child unlocks.

The newly recognized route is Ethereum USD yVault → Ethereum strategy `0xc5b16e7efe1ca05714477b8edcab4dee9b93a27c` → Katana holder `0xefeebaacdc5640a123fe282652503ea4fd499d14` → vbUSDC. The holder owns `907045043491` atomic vbUSDC shares at the pinned Katana block. The canonical recorded-debt cap attributes `906331399954` atomic shares internally, worth $932,680.21 at the pilot prices. Residual unreported appreciation remains subject to the original budget-policy limitation. The source Ethereum and destination Katana blocks have the same timestamp for this route.

| Measure | Previous chain-local pilot | Unified graph pilot |
| --- | ---: | ---: |
| Known depositor value | $145,357,902.52 | **$144,425,222.31** |
| Starting unlock USD / second | $0.214046 | **$0.213466** |
| One-hour scheduled increase | $704.06 | **$701.97** |
| 24-hour scheduled increase | $15,339.66 | **$15,289.50** |
| Attributed overlap removed | $57,195,846.37 | **$58,128,526.58** |

Only vbUSDC changes, from $5,686,672.19 to $4,753,991.98 of external share value. Its existing local holding deduction remains; the cross-chain deduction is additional. This is not expected to equal the DB's $5,063,567.26 vbUSDC headline, which has different local-route coverage, quote timing and valuation semantics. Coverage remains 125 valued roots, 32 unavailable selected values and 153 unknown-cutoff candidates. One cross-chain route and 37 nonzero attributed positions are included. The result remains scoped and incomplete, not complete all-network unique TVL.

Evidence: `db-ownership-routes.json`, `db-ownership-graph.json`, `db-ownership-summary.json`, `global-pilot-ledger-inputs.json`, `global-pilot-ledger-audit.json`. Per-chain projections are emitted as `global-chain-<id>-pilot.json` from the unified attribution. The report filters incoming overlap rows by destination chain, including remote source parents.

```sh
/usr/bin/node --env-file=<local-env-file> docs/research/unlock-counter/collect-db-ownership.mjs
METRICS_SOURCE=<yearn-data-checkout> METRICS_PYTHON=<yearn-data-python> \
  /usr/bin/node docs/research/unlock-counter/generate-global-pilot.mjs
```

Use `combine-chains.mjs` to reproduce the archived chain-local model. It writes `multichain-chain-local-pilot.json`; `generate-global-pilot.mjs` writes the subsequent Yearn-only `pre-curation-pilot.json`. Neither replaces the primary combined dataset. The DB route collection reads the preserved chain-local snapshot manifest. Add `global-pilot.test.mjs` to the test command. Twenty-three tests validate the previous models plus pinned cross-chain provenance, fixed shares, canonical budget caps and rate/curve reconciliation.


## Curation integrated into the primary dataset

The combined primary dataset is now `multichain-pilot-depositor-value.json`, mirrored as `curation-pilot-depositor-value.json`. It adds 21 DB-selected Morpho roots (11 V1, 10 V2) to the preserved unified Yearn-only baseline. Known depositor value is **$157,667,049.03**, a net addition of **$13,241,826.72** after **$40,025,905.76** of internal curation holder value is deducted. Coverage is **145 valued / 178 selected**, with **33 unavailable** values; Yearn Stonk USDG on Robinhood Chain remains explicitly unpriced. Six catalogue-only deployments, including vault-bridge contracts, stay excluded.

Growth is labeled **estimated share-value growth**, comprising **$0.213465666/s** scheduled Yearn profit unlocking and **$0.023228223/s** projected Morpho net accrual, **$0.236693889/s** combined over the first minute. The next-hour modeled increase is **$785.59**. The Morpho component uses 4,620 successful fee-aware exact-share contract calls, not an assets/supply approximation. V2 maxRate recognition includes buffered release and new interest without separating them. Positions, prices and configuration stay fixed, and fee-driven negative share growth is permitted.

All 60 ownership routes, including the existing cross-chain route and 12 additional curation routes, feed one canonical ledger. External shares stay frozen after attribution. Parent baseline and DB graph equality were checked before integration, and the main generator reproduces the side pilot's aggregate, entries and allocations exactly. See [CURATION-README.md](CURATION-README.md) for reproduction and limitations.

`curation.html` adds the family breakdown, and `curation-preview.html` embeds the current JSON and script for standalone local review. Build it with `python3 docs/research/unlock-counter/build-curation-preview.py`. New proof and per-chain outputs use the `curation-` namespace; no copied parent ledger artifacts are imported. The existing metrics reconciliation remains a labeled comparison against the Yearn-only baseline, not against the combined curation result.

## TVL hero prototype and chain display names

Chain ID 4663 is displayed as **Robinhood Chain** throughout research data, scripts, documentation and embedded previews. The historical pricing provider namespace in the collector remains a separate lookup identifier; changing a display name does not manufacture the missing USDG quote. Robinhood Chain's unpriced root remains unavailable.

The landing hero consumes `apps/yearn/public/concepts/lifetime/hero-tvl.json`, generated by `build-hero-counter.mjs` from the latest published metrics known TVL and the approved curation pilot rate. It uses a capture-time canonical anchor and an illustrative constant rate, rather than replaying a finished historical one-hour curve at today's clock. Metrics as-of, growth as-of and capture timestamps remain distinct. The old weekly lifetime-earnings extrapolation is removed from the hero; other landing metrics retain their own dated snapshot.

This counter estimates presentation growth rather than reporting a fresh on-chain TVL value each frame. It does not backfill growth from the earlier metrics close. The source limitations explicitly state that metrics TVL already includes locked profit and that extrapolating the pilot's first-minute growth indefinitely is a mockup assumption. Identical source versions retain their anchor during regeneration. Add `hero-counter.test.mjs` to the full research test command.
