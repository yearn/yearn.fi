# Simple Protocol Return: Growth Index Chart

## One-Line Definition

`Growth Index` is the flow-neutral performance chart. It starts at `100` and compounds simple protocol return through time without stepping down when new positions are opened.

## What It Answers

It answers:

> How did protocol return compound through time, after neutralizing deposits and withdrawals?

It does **not** answer:

- total balance
- dollar PnL
- a sum of the family lines

## How We Calculate It

At each interval between two chart points:

```text
deltaGrowth = growthWeightUsd[t] - growthWeightUsd[t-1]
deltaExposureYears = exposureYears[t] - exposureYears[t-1]
intervalYears = secondsBetweenPoints / secondsPerYear

intervalReturn = deltaGrowth * intervalYears / deltaExposureYears
nextIndex = previousIndex * (1 + intervalReturn)
```

The index:

- starts at `100` once the wallet has capital at work
- compounds interval by interval
- stays level if there is no incremental protocol return

## Why It Behaves Better Than Cumulative %

`Cumulative %` can step down when a large new position opens, because the denominator jumps.

`Growth Index` avoids that by compounding interval returns instead of re-dividing cumulative growth by cumulative baseline at every point.

That makes it the best single chart for comparing protocol-return behavior through time.

## How To Read It

- `100` means the starting level
- `110` means protocol return has compounded about 10% from the start level
- `125` means about 25% compounded protocol-return growth from the start level

The wallet line is:

- the aggregate portfolio-level index
- not the sum of the vault lines
- not an equal-weight average of the vault lines

The family lines are:

- the largest selected vault families
- normalized to the same starting scale
- shown only while that vault still has an open position

## Why It Is Useful

This is the best chart for mixed wallets, especially when a wallet contains volatile assets and raw dollar `Growth` is hard to interpret.

It gives you one clean answer to:

> Did protocol return keep compounding, and which vaults did better or worse?

## Best Short Explanation

`Growth Index` is a normalized, flow-neutral protocol-return chart that starts at `100` and compounds through time.
