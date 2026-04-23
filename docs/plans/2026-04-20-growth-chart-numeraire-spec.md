# Growth Chart Numeraire Spec

Date: 2026-04-20

## Problem

The current `Growth` chart is aggregated in receipt-time USD.

That works well when a wallet is effectively all stablecoins, because the displayed unit matches the user's mental model.

It works less well for mixed wallets:

- if the wallet is mostly ETH-like, a USD growth line is technically valid but not always intuitive
- if the wallet contains multiple unrelated assets, there is no honest single "native underlying growth" unit
- `Cumulative %` and `Annualized %` are useful rate charts, but they are not a substitute for "growth in a chosen denomination"

The product needs a more robust default for mixed wallets without pretending that mixed underlyings can be summed natively.

## Goals

1. Make the `Growth` chart choose a better default display mode based on the wallet's open-position composition.
2. Keep a single simple chart surface for users:
   - default intelligently
   - allow explicit override
3. Preserve the existing simple protocol-return framing:
   - protocol growth only
   - asset price moves excluded after receipt
4. Support mixed wallets honestly by defaulting to `Index` when no single denomination dominates.

## Non-Goals

1. Do not create a fake aggregate chart in "native underlying units" for mixed wallets.
2. Do not stack raw native units from different assets on the same y-axis.
3. Do not introduce full mark-to-market PnL into this chart.
4. Do not implement arbitrary custom-asset denomination in v1.

## Product Decision

The `Growth` chart becomes a **display-mode chart** with a selector:

- `Auto`
- `Index`
- `USD`
- `ETH`

`Auto` resolves to one of the other three modes based on the wallet's current open-position mix.

### Auto Resolution

Use the wallet's **current open lots only**, not historical receipts and not already exited positions.

Use **open baseline weight in receipt-time USD** as the composition measure.

This aligns with the simple-return accounting model and avoids introducing current spot-price dependency just to choose a default display mode.

Auto resolves as:

- `USD` if stable open baseline weight is `>= 90%`
- `ETH` if ETH-family open baseline weight is `>= 90%`
- `Index` otherwise

### Why Open Baseline Weight

Open baseline weight is the cleanest measure for this purpose because:

- it represents capital currently at work
- it ignores already exited positions
- it stays aligned with the simple-return lot model
- it does not require an extra mark-to-market pricing layer

## UI Behavior

### Top-Level Tabs

Replace the current top-level chart tabs:

- `Balance`
- `Growth`
- `Cumulative %`
- `Annualized %`
- `Growth Index`

with:

- `Balance`
- `Growth`
- `Cumulative %`
- `Annualized %`

`Growth Index` becomes one display mode inside `Growth`, not a separate top-level tab.

### Growth Display Selector

When the active tab is `Growth`, show:

- `Auto`
- `Index`
- `USD`
- `ETH`

The selector should match the existing vault-page selector styling.

### Auto Copy

When `Auto` is selected, show a small explanatory line under the chart title:

- `Auto: stable-dominant portfolio, showing USD`
- `Auto: ETH-dominant portfolio, showing ETH`
- `Auto: mixed portfolio, showing Index`

### Rendering Behavior

- `Index`
  - render the current aggregate wallet line
  - render the existing comparison family lines
- `USD`
  - render a single aggregate growth line
- `ETH`
  - render a single aggregate growth line

Family comparison lines remain index-only in v1. This keeps the first version clear and avoids overloading the chart.

## Metric Definitions

### 1. Growth in USD

This is the existing `growthWeightUsd`.

For each lot:

```text
growthWeightUsd = growthUnderlying * receiptPriceUsd
```

Aggregate wallet growth is:

```text
walletGrowthUsd = sum(growthWeightUsd across all vault families)
```

This remains the definition of `Growth` when display mode is `USD`.

### 2. Growth in ETH

Add an ETH-equivalent growth series using receipt-time ETH conversion.

For each lot:

```text
receiptPriceEth = receiptPriceUsd / receiptEthPriceUsd
growthWeightEth = growthUnderlying * receiptPriceEth
```

Aggregate wallet growth is:

```text
walletGrowthEth = sum(growthWeightEth across all vault families)
```

Important:

- this is **ETH-equivalent protocol growth**
- it is not current mark-to-market ETH value
- it still excludes later asset price moves by using receipt-time conversion

### 3. Growth Index

Keep the current flow-neutral index logic.

Per interval:

```text
deltaGrowth = growthWeightUsd[t] - growthWeightUsd[t-1]
deltaExposureYears = exposureYears[t] - exposureYears[t-1]
intervalYears = deltaSeconds / secondsPerYear

intervalReturn = deltaGrowth * intervalYears / deltaExposureYears
nextIndex = previousIndex * (1 + intervalReturn)
```

The index:

- starts at `100`
- compounds through time
- does not step down just because a new position opens

## Classification Rules

### Stable

Use the existing vault metadata `category === 'stable'`.

### ETH-Family

Add a new backend classifier for ETH-like underlyings using a maintained allowlist.

The v1 allowlist should match normalized token symbol and optionally token address where needed.

Seed list:

- `ETH`
- `WETH`
- `STETH`
- `WSTETH`
- `RETH`
- `FRXETH`
- `SFRXETH`
- `EETH`
- `WEETH`
- `EZETH`
- `METH`
- `MSETH`

Classification order:

1. `stable`
2. `eth_family`
3. `other`

This keeps stablecoin vaults from being mislabeled by symbol collisions.

## Backend Changes

### 1. Extend Simple History Response

Extend `HoldingsPnLSimpleHistoryPoint` with:

- `growthWeightEth: number | null`

Extend the history response summary with:

- `recommendedGrowthDisplay: 'usd' | 'eth' | 'index'`
- `recommendedGrowthDisplayReason: 'stable_dominant' | 'eth_dominant' | 'mixed'`
- `openBaselineCompositionUsd`
  - `stable`
  - `ethFamily`
  - `other`

### 2. Compute ETH-Equivalent Growth

Fetch receipt-time ETH/USD prices alongside receipt-time token prices.

The simplest path is to treat mainnet WETH as the ETH numeraire source and fetch the same receipt buckets already used for token prices.

For each lot:

- compute `receiptPriceEth`
- carry realized and unrealized ETH-equivalent growth in parallel to USD-equivalent growth

### 3. Compute Recommended Growth Display

At the latest timestamp:

- inspect open lots only
- group open baseline weight into:
  - stable
  - ethFamily
  - other

Then resolve the recommended display mode using the `90%` thresholds above.

### 4. Keep Index Logic Unchanged

The current `growthIndex` logic already solves the mixed-wallet default problem well.

Do not change its math in this spec.

## Frontend Changes

### 1. Replace Growth Index Tab

Remove the separate `Growth Index` top-level tab.

Move that chart renderer under `Growth` mode = `Index`.

### 2. Add Growth Display Mode State

Add frontend state:

- `growthDisplayMode: 'auto' | 'index' | 'usd' | 'eth'`

When `auto` is selected:

- resolve the effective display mode from the backend recommendation
- show the explanatory helper copy

### 3. Render By Effective Mode

When active tab is `Growth`:

- `effectiveMode === 'index'`
  - render the current index chart
- `effectiveMode === 'usd'`
  - render aggregate `growthWeightUsd`
- `effectiveMode === 'eth'`
  - render aggregate `growthWeightEth`

### 4. Keep Balance Selector Separate

The existing `Balance` tab denomination selector remains separate.

`Balance` and `Growth` should not share the same denomination state because they answer different questions.

## API Shape Sketch

```ts
type TRecommendedGrowthDisplay = 'usd' | 'eth' | 'index'
type TRecommendedGrowthDisplayReason = 'stable_dominant' | 'eth_dominant' | 'mixed'

type TProtocolReturnHistoryPoint = {
  date: string
  growthWeightUsd: number
  growthWeightEth: number | null
  protocolReturnPct: number | null
  annualizedProtocolReturnPct: number | null
  growthIndex: number | null
}

type TProtocolReturnHistorySummary = {
  recommendedGrowthDisplay: TRecommendedGrowthDisplay
  recommendedGrowthDisplayReason: TRecommendedGrowthDisplayReason
  openBaselineCompositionUsd: {
    stable: number
    ethFamily: number
    other: number
  }
}
```

## Acceptance Criteria

1. Stable-dominant wallets open `Growth` in `Auto -> USD`.
2. ETH-dominant wallets open `Growth` in `Auto -> ETH`.
3. Mixed wallets open `Growth` in `Auto -> Index`.
4. Switching between `Auto`, `Index`, `USD`, and `ETH` does not refetch unrelated chart data.
5. `Index` mode preserves the current wallet + family-line comparison behavior.
6. `USD` and `ETH` modes render aggregate growth without fake jumps from deposits.
7. The chart tooltip and subtitle clearly state which display mode is active.

## Future Extensions

### 1. Custom Asset Denominations

The ETH-equivalent logic generalizes naturally:

```text
receiptPriceNumeraire = receiptPriceUsd / receiptNumeraireUsd
growthWeightNumeraire = growthUnderlying * receiptPriceNumeraire
```

Once the backend can fetch historical prices for an arbitrary supported numeraire token, the selector can be extended beyond `ETH`.

This is out of scope for v1.

### 2. Contribution View

Add a separate `Contribution` chart later:

- stacked by vault family
- denominated in the selected numeraire
- valid only because all series are converted into a common numeraire first

This should not be confused with stacking native units.

### 3. Threshold Tuning

The `90%` dominance threshold is intentionally conservative.

If user testing suggests wallets with `80-90%` dominance still feel obviously stable- or ETH-denominated, the threshold can be lowered later without changing the overall design.
