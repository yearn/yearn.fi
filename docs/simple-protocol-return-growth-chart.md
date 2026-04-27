# Simple Protocol Return: Growth Chart

## One-Line Definition

`Growth` shows how much protocol yield the wallet has earned so far, converted into USD using the underlying token price at the time each lot entered the wallet.

## What It Answers

It answers:

> How much value did Yearn add while this wallet held vault shares?

It does **not** answer:

- current mark-to-market PnL
- real USD profit after the asset price moved
- tax/accounting profit

## How We Calculate It

For each receipt lot, we store:

- `baselineUnderlying`
- `receiptPriceUsd`

For an open lot at time `t`:

```text
currentUnderlying = sharesRemaining * PPS(t)
growthUnderlying = currentUnderlying - baselineUnderlyingRemaining
growthWeightUsd = growthUnderlying * receiptPriceUsd
```

For an exited lot:

```text
exitUnderlying = withdrawal assets, or shares exited * PPS(exit)
realizedGrowthUnderlying = exitUnderlying - baselineUnderlyingConsumed
realizedGrowthWeightUsd = realizedGrowthUnderlying * receiptPriceUsd
```

The chart point is the sum of realized and unrealized `growthWeightUsd` across all vault families.

## How To Read It

- Upward moves mean PPS increased on positions the wallet was holding.
- A flat line means no additional protocol growth was earned in that period.
- Deposits should add new baseline, not instant growth.
- Exits should realize existing growth, not create fake jumps.

Each chart point is cumulative up to that date. The timeframe selector changes which dates are shown, not the fact that the value is cumulative.

## Why It Can Look Strange On Volatile Wallets

The chart is USD-shaped, but it is **not** using the current asset price.

It uses the price at receipt time:

```text
growthWeightUsd = protocol-added underlying * receipt-time USD price
```

That means a volatile vault can show positive `Growth` even if the current market value of the position is down.

For stablecoin vaults this is intuitive.
For ETH-like or mixed wallets it is often better to pair this chart with `Growth Index`.

## Best Short Explanation

`Growth` is protocol-earned value, expressed in receipt-time dollars, while the wallet held the vault shares.
