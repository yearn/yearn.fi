# Integrated curation research pilot

This extension was merged from the isolated side pilot after checking that its parent dataset, DB graph, pinned route receipts and shared accounting model matched the main-thread baseline. Its regenerated aggregate, entries and allocations match the side pilot exactly. Only curation implementation, receipt and review assets were imported; copied parent files, screenshots, logs and dependencies were excluded.

`multichain-pilot-depositor-value.json` is the primary combined research dataset and equals `curation-pilot-depositor-value.json`. The existing `multichain.html` preview includes the curation rows and labels the two growth components separately. `curation.html` provides the family breakdown. The original Yearn-only baseline is preserved in `pre-curation-pilot.json`; its global ledger and per-chain files remain unchanged. Curation outputs use `curation-ledger-*.json` and `curation-chain-<id>-pilot.json`, preventing regeneration from overwriting the earlier evidence.

Open `curation-preview.html` directly as a local file. Its data and interaction code are embedded; it requires no server or external fetches. `curation-pilot-depositor-value.json` is the expanded static dataset.

## Results

At the original November 4, 2026 09:33:59 EST snapshot:

- Previous global-ownership known depositor value: $144,425,222.31.
- New combined known depositor value: **$157,667,049.03**.
- Curation addition after overlap deductions: **$13,241,826.72**.
- Combined first-minute average estimated growth: **$0.236693889/second**.
- Scheduled Yearn component: $0.213465666/second.
- Projected Morpho net accrual component: $0.023228223/second.
- Next-hour modeled increase: $785.59; next-day comparison: $17,295.28.

The DB curation catalogue has 53 candidate deployments after excluding discovery-only affiliations outside the published DB selection. Twenty-one qualify under the same $10k rule: 11 Morpho V1 and 10 Morpho V2, of which 20 have accepted historical asset prices. Added gross holder value is $53,267,732.48, with $40,025,905.76 of internal share value deducted. The combined set has 178 roots and 145 valued roots. Thirty-three valuations remain unavailable, including the unpriced Yearn Stonk USDG position on Robinhood Chain. Missing values are not zeros.

## Accounting and projection

The copied parent global pilot supplies 157 Yearn V2/V3 roots and its updated DB graph. Curation candidates come from the published graph plus unavailable-node identities, classified with the yearn-data event catalogue. The graph is pinned to dataset `4a8caca4b3901493b2f691a7c1b5174cb5fa46e223e2439175b4934cb5311505`; identities are used for discovery, never historical dollar allocations. Existing validated routes are preserved. Twelve additional mapped routes are read at the pilot blocks. Morpho V2 adapter membership and adapter `realAssets()` budgets are checked. All roots run through `yearn_data.tvl.account` in one ledger, retaining direct and cross-chain share attribution.

Curation projections use the deployed contract's authoritative `convertToAssets(exactShares)` at the common timestamp and every published future curve point. No `totalAssets / totalSupply` approximation is used. This includes virtual shares and pending performance/management fee dilution without assuming every deployment has identical internal fee code. After ownership attribution is frozen, the exact external and attributed share quantities are queried again. All 4,620 requested projection conversions succeeded. No transactions are sent and no database writes occur.

Yearn's component remains scheduled release of existing reported profits. Morpho's component is future-timestamp, fixed-state net share growth, including adapter interest and V2 `maxRate` recognition. It is not guaranteed interest or a forecast of future market activity, and V2 buffer release is not separately attributed from new interest here. Asset prices, positions and configuration stay fixed; no future reports, deposits, withdrawals or losses are invented. Fee-driven negative share growth is permitted by the model. The one-hour display interpolates between sampled contract-backed points, with schedule-expiry boundaries retained.

Published metrics uses the prior UTC close, about 14.6 hours before this snapshot. Its $19.63m curation contribution is not a matched-time expected increment: for example, WETH ARM has about $393k at the pilot block versus $6.69m at the published close. Several curation rows also revalue or move during that interval. The total remains a scoped, incomplete holder-value subtotal, not complete or certified unique network TVL.

## Files and reproduction

- `collect-curation.mjs`: classify/screen the curation selection and read pinned contract state/prices.
- `collect-curation-routes.mjs`: read additional DB-mapped holders and adapter budgets.
- `quote-curation.mjs`: exact-share baseline and future conversions.
- `generate-curation-pilot.mjs`: canonical ledger attribution, frozen shares, family growth breakdown and static response.
- `curation-snapshot.json`, `curation-ownership-routes.json`, `curation-projection-verification.json`: provenance and read receipts.
- `curation-ledger-inputs.json`, `curation-ledger-audit.json`: canonical accounting inputs and output.

Run the following commands from this research directory. Collection uses `/usr/bin/node --env-file=<configured-env>` and requires `METRICS_SOURCE` or `CURATION_CATALOGUE_FILE` to locate the DB event catalogue. For quote planning use `QUOTE_PHASE=baseline`, followed by `PHASE=plan` generation, then the full quote pass and final generation. The generator requires `METRICS_SOURCE` and `METRICS_PYTHON` pointing at the local yearn-data checkout and Python environment. RPC URLs and credentials are not recorded in the artifacts.

```sh
/usr/bin/node --test --experimental-test-isolation=none model.test.mjs pilot.test.mjs expanded.test.mjs multichain.test.mjs global-pilot.test.mjs curation.test.mjs curation-integration.test.mjs
python3 build-curation-preview.py
```

The full integrated research suite passes, covering original models, exact-share quote coverage, price gaps, nested Morpho ownership, cross-chain share budgets and aggregate reconciliation.
