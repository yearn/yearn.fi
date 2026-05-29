# Simple Protocol Return: Cumulative % Chart

## One-Line Definition

`Cumulative %` shows total protocol growth so far divided by the total baseline capital that has entered the wallet so far, using receipt-time USD weighting.

## What It Answers

It answers:

> Relative to all baseline capital that has passed through this wallet, how much protocol return has been earned so far?

It does **not** answer:

- trailing return for just the visible chart window
- a flow-neutral performance index
- annualized yield

## How We Calculate It

At each point in time:

```text
baselineWeightUsd = sum(baselineUnderlying * receiptPriceUsd)
growthWeightUsd = sum(growthUnderlying * receiptPriceUsd)

cumulativeReturnPct = growthWeightUsd / baselineWeightUsd * 100
```

`baselineWeightUsd` includes both:

- baseline from lots that are still open
- baseline from lots that were already exited

So this is a cumulative return on all baseline capital seen so far.

## How To Read It

- Upward moves mean protocol growth is compounding faster than baseline is increasing.
- Flat periods mean growth is not changing much relative to the existing baseline.
- Downward moves can happen when new capital enters the wallet.

That last point is important:

- a new deposit increases the denominator immediately
- but it does not bring instant growth with it
- so the percentage can step down even when the wallet did nothing wrong

Each chart point is cumulative up to that date. The timeframe selector changes which dates are shown, not the fact that the value is cumulative.

## Why It Is Useful

This is the cleanest answer to:

> Across all the capital that has passed through this wallet, what simple protocol return has Yearn produced?

It is especially useful for stablecoin wallets where the receipt-time USD weighting is easy to reason about.

## Main Limitation

Because new inflows increase the denominator, `Cumulative %` is not the best chart for flow-neutral performance comparisons.

That is why `Growth Index` exists.

## Best Short Explanation

`Cumulative %` is total simple protocol growth divided by total baseline capital received so far.
