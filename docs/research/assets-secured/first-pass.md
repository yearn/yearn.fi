# Assets secured: first calculation

Status: **incomplete; not suitable for the landing-page total**. Captured October 23, 2026.

These are gross candidate balances, not net additions to endorsed TVL. Kong USD valuations are dated October 19, 2026 (1792368000); swBTC is a separate October 23 on-chain observation with a contemporaneous external price.

| Candidate group | Gross USD |
| --- | ---: |
| Katana pre-deposits | 166,943,503.11 |
| capUSDC | 24,417,878.26 |
| Savings crvUSD | 14,695,108.83 |
| Other hidden vaults requiring classification | 6,056,945.16 |
| Term Finance meta vaults | 4,058,271.93 |
| Swell swBTC | 471,311.73 |

Gross candidate arithmetic sum: **$ 216,643,019.02**, excluding the endorsed baseline and Octant. This is neither a lower bound nor a final total: scope exclusions and overlap deductions remain outstanding.

## Evidence and reconciliation findings

- Full public Kong inventory contains 2,226 entries, including unrelated ERC-4626 protocols. Summing the whole inventory is invalid.
- Fourteen Katana pre-deposit entries found, eleven with positive balances. The eight large pre-deposit vaults allocate to STB depositor contracts that also appear individually in Kong. Counting both doubles the same assets.
- All 54 positive-balance hidden entries were snapshotted. Other-hidden group includes yETH Recovery, Coinflakes and smaller deployments; inclusion requires contract and scope review.
- capUSDC and both Term meta vaults expose downstream strategy debts. Those strategies must be mapped through to endorsed vaults before adding net incremental exposure.
- Savings crvUSD has no reported strategy debts, but other counted vaults can hold scrvUSD directly or through pools. Incoming exposure must also be reconciled.
- swBTC is absent from the fetched Kong list and its snapshot endpoint returns 404. Direct Ethereum reads succeeded at block 26257254: totalAssets 580102791, WBTC (8 decimals), API version 3.0.2.
- Public Kong aggregate TVL returned $147,803,380.56. It must not be substituted for or added to the landing snapshot ($208,172,781.17) without reconciling scope and dates.
- Octant: official core repository located, but its main-branch tree has no production deployment manifest. Documentation HTTP fetch was denied (403). No Octant balance is assumed to be zero.

## Remaining work before publication

1. Resolve Octant production factory/vault inventory from official application configuration or deployment records.
2. Validate complete Term deployment coverage beyond the two known meta vaults.
3. Classify all hidden vaults and reconcile external partner contracts already present in that set.
4. Fetch a common-date endorsed constituent set and map direct, indirect, LP and bridge overlaps with candidate partners.
5. Revalue constituent assets consistently and calculate capped overlap deductions; publish a net union only after coverage review.

## Sources

- https://kong.yearn.fi/api/rest/list/vaults
- https://kong.yearn.fi/api/rest/tvl
- https://kong.yearn.fi/api/rest/snapshot/1/0x7B5A0182E400b241b317e781a4e9dEdFc1429822
- https://developers.term.finance/periphery-contracts/curated-vaults/deployed-contracts/ethereum
- https://github.com/golemfoundation/octant-v2-core
- https://coins.llama.fi/prices/current/ethereum:0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599

Raw evidence is stored beside this report. collect-snapshots.py refreshes hidden-vault snapshots against the saved Kong inventory. Refresh the inventory first when performing a new run.
