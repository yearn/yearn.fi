# Holdings PnL Logic

This document explains how `GET /api/holdings/pnl` and `GET /api/holdings/pnl/drilldown` work today.

It is written for product engineers and contributors who need to understand the accounting model without reading the full implementation in `api/lib/holdings/services/pnl.ts`.

## Goal

The endpoint answers a practical portfolio question:

> For a given wallet, what vault positions exist now, and how much profit or loss can we attribute to them?

The answer is intentionally conservative when the underlying history is ambiguous.

## What The Endpoint Is

The endpoint is:

- A Yearn vault portfolio PnL calculator
- FIFO-based for known lots
- A wallet-level aggregator across vault families
- Conservative when cost basis cannot be reconstructed

The endpoint is not:

- A tax engine
- A generic ERC20 PnL engine
- A full wallet-wide cash-flow ledger
- A proof that every historical transfer has been classified perfectly

## Public Surfaces

The backend now exposes two PnL shapes:

- `GET /api/holdings/pnl`
  - compact portfolio summary plus one row per vault family
  - intended for overview cards, value tables, filters, and composition views
- `GET /api/holdings/pnl/drilldown`
  - the same valuation basis, but expanded with current lots, realized lot consumption, unknown-basis receipts and withdrawals, and a transaction journal
  - intended for vault drawers, lot timelines, and accounting inspection UI

## Core Idea

The engine models each vault family as a set of share lots.

A lot has:

- A share amount
- A location
  - wallet
  - staked
- An acquisition timestamp
- A cost basis in underlying assets, or `null` when basis is unknown

For known-basis lots, USD basis is derived later from:

- the lot's underlying asset basis
- the lot's acquisition timestamp
- the underlying token price at that acquisition timestamp

Known-basis lots come from indexed deposit / withdrawal context.
Known-basis lots can also come from recognized synthetic acquisition flows, such as supported CoW settlement receipt enrichment on Ethereum mainnet.
Unknown-basis lots usually come from share transfers where the economic source cannot be proven.

## Mental Model

Think in this order:

1. Build raw user-visible events from the indexer.
2. Enrich those events with same-transaction context.
3. Group events into vault families.
4. Build FIFO lots for each family.
5. Value remaining lots at current PPS and token price.
6. Apply an unknown-transfer policy: `strict`, `zero_basis`, or `windfall`.

## Vault Families

The engine does not treat the staking wrapper as a separate investment from the underlying vault.

A family is:

- the underlying vault
- plus its staking wrapper, if one exists

This matters because stake and unstake actions should usually move lots between locations, not create fresh cost basis.

## Data Sources

The PnL endpoint uses four main inputs.

### 1. Envio GraphQL

Used for:

- underlying deposits and withdrawals
- staking deposits and withdrawals
- share transfers in and out

### 2. Transaction-Scoped Enrichment

Address-scoped events are often not enough.

The PnL pipeline therefore also loads additional events from the same transaction hashes so it can understand:

- router flows
- stake / unstake flows
- same-transaction deposit plus transfer combinations
- known migration rollovers

Without that enrichment, many transfers would stay permanently ambiguous.

For a small set of recognized Ethereum mainnet CoW settlement flows, the pipeline also inspects the transaction receipt and settlement logs so it can synthesize a known-basis acquisition instead of treating the received position as an unknown transfer-in.

### 3. Kong PPS

Historical and current price-per-share is used to translate vault shares into underlying asset amounts.

### 4. DefiLlama Prices

Historical and current underlying token prices are used to express PnL in USD.

In this document, "underlying token" means the vault asset token from Kong metadata, not the Yearn share token itself. For some vaults that asset token is an LP token or pool token rather than a plain ERC20 like USDC.

That includes:

- acquisition-time token prices for known lot USD basis
- receipt-time token prices for unknown-lot windfall valuation
- realization-time token prices for realized USD proceeds
- current token prices for current market value

## Processing Flow

The implementation has two major stages.

### Stage 1: Build Family Ledgers

Raw events are normalized into a transaction journal.

The ledger builder tracks:

- wallet lots
- staked lots
- realized entries
- unknown transfer-in entries
- withdrawals that consumed unknown-basis shares
- unmatched transfer-outs

### Stage 2: Materialize API Rows

Each family ledger is then valued into a response row with:

- current value
- known vs unknown basis share counts
- realized PnL
- unrealized PnL
- windfall PnL when applicable
- completeness flags

## How Known Basis Works

### Deposits

Underlying vault `Deposit` events create known-basis lots.

The lot basis is the indexed `assets` amount.
The lot also keeps its acquisition timestamp.

### Withdrawals

Underlying vault `Withdraw` events consume existing lots using FIFO.

For known lots:

- proceeds come from the indexed `assets`
- consumed basis comes from the oldest remaining lots
- realized PnL is `proceeds - consumed_basis`

In USD terms:

- realized proceeds use the underlying token price at the withdrawal timestamp
- consumed basis uses the underlying token price at each consumed lot's acquisition timestamp

### Unrealized PnL

For known lots that still remain:

- current underlying value = `shares * current PPS`
- unrealized PnL = `current underlying value - remaining cost basis`

In USD terms:

- current value uses the current underlying token price
- remaining basis uses the acquisition-time token price of each remaining lot
- unrealized USD PnL = `current value USD - remaining basis USD`

This means the endpoint now captures both:

- vault/share performance via PPS changes
- underlying token price changes between deposit and withdrawal / current time

## How Staking Works

Staking deposits and withdrawals are not treated as new investments by default.

Instead, they usually mean:

- wallet shares moved into staked location
- or staked shares moved back to wallet location

The lot should stay the same. Only its location changes.

This avoids fake realized PnL when the user simply wraps or unwraps a Yearn position.

## How Router Flows Work

Some transactions do not emit the economically useful event directly on the user address.

Example:

- user interacts with a router
- router deposits into the vault
- shares are transferred to a staking wrapper
- the user only appears on part of that flow

The tx-hash enrichment step lets the engine inspect the whole transaction and attribute basis to the correct family.

For recognized CoW settlement buys, the engine can synthesize a deposit-like acquisition from the receipt by combining:

- the settlement trade log
- the asset transfer into the vault
- the share mint from the vault

This lets the destination position start as a known-basis lot instead of a partial transfer-in when the flow is sufficiently unambiguous.

## How Migrations Work

The engine supports recognized migration paths.

There are two broad cases:

### Same-Family Rollovers

These are transactions where shares exit and re-enter within the same family in a way that should preserve basis.

### Known Cross-Family Migrators

For specific migrator flows, basis can be rolled from a source family into a destination family.

If the source side cannot be reconstructed confidently, the destination side remains partial.

## Plain Transfers

Plain transfers are the hardest part of the model.

If shares arrive and the engine cannot prove where their basis came from, those shares become unknown-basis lots.

If shares leave and the engine cannot match them to known or unknown lots cleanly, the ledger records unmatched transfer-out state.

This is why the endpoint exposes completeness metadata instead of pretending every vault is fully known.

## Unknown Transfer-In Modes

The endpoint supports three policies for unknown transfer-ins.

Query param:

```text
unknownMode=strict|zero_basis|windfall
```

Default:

```text
windfall
```

## Request Controls

The PnL endpoint also exposes event-loading controls for debugging and benchmarking:

```text
fetchType=seq|parallel
paginationMode=paged|all
```

Defaults:

```text
fetchType=seq
paginationMode=paged
```

### `fetchType`

- `seq`
  - address-scoped event families paginate with the normal `1000`-row page walker
- `parallel`
  - address-scoped event families first try GraphQL aggregate counts, then request multiple `1000`-row pages in parallel

This only affects the address-scoped family fetch path. Transaction-hash enrichment still happens afterwards.

### `paginationMode`

- `paged`
  - use normal `limit/offset` pagination with `1000`-row pages
- `all`
  - request each address-scoped and `transactionFrom` event family in a single query using a large hard limit instead of paging

`all` is intended for experimentation. It bypasses the aggregate count preflight, but it uses a fixed single-query limit internally, so it should be treated as a benchmarking/debug option rather than a universally safe default.

### `strict`

Use this when you want the most conservative answer.

Behavior:

- unknown-basis shares do not contribute to realized or unrealized PnL
- their current value is reported in `unknownCostBasisValueUsd`
- `totalPnlUsd` only reflects lots with known basis

### `zero_basis`

Use this when you want an upper-bound estimate and are willing to assume unknown transfers were free economically.

Behavior:

- unknown-basis shares are treated as if basis were zero
- the full value of those shares flows into realized or unrealized PnL

### `windfall`

This is the default because it preserves the same economic assumption as `zero_basis`, but with better attribution.

Behavior:

- receipt-time fair value of unknown shares goes to `windfallPnlUsd`
- only the market move after receipt goes to `totalPnlUsd`
- `totalEconomicGainUsd = totalPnlUsd + totalWindfallPnlUsd`

### Simple Example

Assume:

- unknown shares are received when worth `$1,000`
- later they are worth `$1,150`

Results:

```text
strict:
  totalPnlUsd = 0
  unknownCostBasisValueUsd = 1,150

zero_basis:
  totalPnlUsd = 1,150
  totalEconomicGainUsd = 1,150

windfall:
  totalWindfallPnlUsd = 1,000
  totalPnlUsd = 150
  totalEconomicGainUsd = 1,150
```

## Known-Basis USD Example

Assume:

- a user deposits into a WETH vault
- deposit receives shares representing `1 WETH`
- WETH is `$2,000` at deposit time
- PPS is unchanged
- later those shares still represent `1 WETH`
- WETH is now `$3,000`

Then:

- underlying unrealized PnL = `0 WETH`
- unrealized USD PnL = `$1,000`

That is intentional. The endpoint now reports full USD mark-to-market PnL for known-basis lots, not only asset-denominated vault performance.

So:

- `zero_basis` and `windfall` can have the same economic gain
- they differ only in how that gain is classified

## Response Fields

### Summary

- `totalCurrentValueUsd`
  - Sum of current vault values for returned rows
- `totalUnknownCostBasisValueUsd`
  - Current value of unknown-basis holdings in `strict` mode
- `totalWindfallPnlUsd`
  - Receipt-time value isolated by `windfall` mode
- `totalRealizedPnlUsd`
  - PnL from lots that have exited through recognized withdrawal flows
- `totalUnrealizedPnlUsd`
  - PnL on lots that are still held
- `totalPnlUsd`
  - `totalRealizedPnlUsd + totalUnrealizedPnlUsd`
- `totalEconomicGainUsd`
  - `totalPnlUsd + totalWindfallPnlUsd`

### Per-Vault Completeness

- `status`
  - `ok`, `missing_metadata`, `missing_price`, or `missing_pps`
- `costBasisStatus`
  - `complete` or `partial`

A vault is `partial` when the engine still has ambiguity, such as:

- unknown transfer-in shares
- withdrawals that consumed unknown-basis shares
- unmatched transfer-outs

### Per-Vault Current/Basis Fields

The compact endpoint now also exposes explicit basis and underlying fields:

- `currentUnderlying`
  - current underlying asset amount represented by all current shares
- `walletUnderlying`
  - current underlying amount still in the wallet location
- `stakedUnderlying`
  - current underlying amount in the staking location
- `currentKnownUnderlying`
  - current underlying amount attributed to known-basis lots
- `currentUnknownUnderlying`
  - current underlying amount attributed to unknown-basis lots
- `knownCostBasisUnderlying`
  - summed underlying asset basis from known lots
- `knownCostBasisUsd`
  - USD-marked basis of known lots using acquisition-time token prices

These fields are useful for UI without forcing a drilldown request.

### Drilldown Fields

The drilldown endpoint adds per-vault:

- `currentLots.wallet`
- `currentLots.staked`
- `realizedEntries`
- `unknownTransferInEntries`
- `unknownWithdrawalEntries`
- `journal`

The journal is transaction-oriented. It records:

- the computed vault-family view for that transaction
- whether the wallet had direct address activity in that transaction
- realized / wrapped / unwrapped / unknown-transfer deltas
- lot summaries before and after the transaction for wallet and staked locations

## What Is Covered Well Today

The current implementation is strong on:

- direct deposit / withdraw accounting
- FIFO cost basis for known lots
- staking wrap and unwrap handling
- same-transaction router context, when events can be linked by tx hash
- known migration paths
- explicit treatment of unknown basis instead of silently inventing numbers

## What Is Still Conservative Or Incomplete

The current implementation is not fully complete in the absolute sense.

Known limitations:

- unrecognized migration paths still fall back to partial basis
- ambiguous transfer provenance still falls back to unknown basis
- families with no direct interaction but non-zero current shares are still surfaced as partial holdings, with current value prioritized over full historical transfer receipt pricing
- transfer-only families with zero current shares can still be omitted from the response
- missing metadata, PPS, or token prices can block full valuation for a family

This is why the response exposes:

- `status`
- `costBasisStatus`
- `isComplete`

Those fields are part of the design, not an accident.

## Practical Reading Guide

If you are debugging one wallet:

1. Check `summary.isComplete`.
2. Find vaults with `costBasisStatus: "partial"`.
3. Look at:
   - `unknownCostBasisShares`
   - `unknownCostBasisValueUsd`
   - `windfallPnlUsd`
   - `eventCounts`
4. Call `/api/holdings/pnl/drilldown` for the relevant vault family.
5. Use debug mode only when you also want server-side logs or transaction-specific log tables.

## Code Map

The main files are:

- `api/lib/holdings/services/graphql.ts`
  - fetches address-scoped and tx-scoped PnL events
- `api/lib/holdings/services/pnl.ts`
  - orchestrates event loading, ledger construction, and response materialization
- `api/lib/holdings/services/pnlTypes.ts`
  - shared PnL event, ledger, and response types
- `api/lib/holdings/services/pnlShared.ts`
  - shared numeric and key helpers used across the PnL pipeline
- `api/lib/holdings/services/pnlValuation.ts`
  - summary building, missing-metadata materialization, and unknown-mode valuation logic
- `api/lib/holdings/services/pnl.test.ts`
  - core lot, staking, migration, and ledger behavior
- `api/lib/holdings/services/pnl.modes.test.ts`
  - `strict`, `zero_basis`, and `windfall` behavior

## Bottom Line

The current PnL engine is featureful and intentionally conservative.

It is good at not inventing certainty where the chain history is ambiguous.
It is not a perfectly complete reconstruction of every vault transfer path.

When you read the output:

- `strict` answers “what can we prove?”
- `zero_basis` answers “what if unknown transfers were free?”
- `windfall` answers “what is the same economic gain, but split into receipt-time value and later market PnL?”
