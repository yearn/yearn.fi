# Simple Protocol Return: Annualized % Chart

## One-Line Definition

`Annualized %` shows the wallet's simple protocol return converted into a per-year rate using time-weighted baseline exposure.

## What It Answers

It answers:

> When capital was actually sitting in this wallet, what annualized protocol return rate did it earn?

It does **not** answer:

- last-12-months APY
- current vault APY
- a trailing market return

## How We Calculate It

We first measure baseline capital at work through time:

```text
baselineExposureWeightUsdYears =
  integral over time of (baselineUnderlying * receiptPriceUsd)
  ---------------------------------------------------------------
                              seconds per year
```

Then we annualize total simple growth against that exposure:

```text
annualizedProtocolReturnPct =
  growthWeightUsd / baselineExposureWeightUsdYears * 100
```

Where:

- `growthWeightUsd` is cumulative simple protocol growth so far
- `baselineExposureWeightUsdYears` is dollar-years of baseline capital actually at work

## How To Read It

- Upward moves mean the wallet is earning more growth per unit of time-weighted capital.
- Flat periods mean the effective annualized rate is stable.
- Downward moves can happen when new capital enters and has not had time to earn much yet.

That makes this metric much better than `Cumulative %` for operating wallets where money regularly comes in and goes out.

Each chart point is cumulative up to that date. The timeframe selector changes which dates are shown, not the fact that the value is cumulative.

## Why It Exists

For a payroll or treasury wallet, cumulative receipts can be much larger than the capital that was actually invested at any one time.

Annualizing against time-weighted exposure fixes that.

It gives a better answer to:

> What return rate did this wallet experience while capital was actually in Yearn?

## Main Limitation

It is still a simple protocol-return metric:

- it ignores later asset price moves
- it is not a market PnL figure
- it is not a trailing APY for just the visible chart window

## Best Short Explanation

`Annualized %` is simple protocol growth converted into a per-year rate using time-weighted baseline capital actually at work.
