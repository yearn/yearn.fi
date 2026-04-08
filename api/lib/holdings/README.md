# Holdings APIs

Calculates historical USD values and portfolio PnL for a user's Yearn vault positions.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Frontend                                        │
│                    usePortfolioHistory() hook                               │
│                              │                                               │
│                              ▼                                               │
│                GET /api/holdings/history|breakdown?address=0x...            │
└─────────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Bun API Server (port 3001)                          │
│                              │                                               │
│                              ▼                                               │
│                    ┌─────────────────┐                                      │
│                    │   Aggregator    │  ◄── Main orchestrator               │
│                    └────────┬────────┘                                      │
│                             │                                                │
│         ┌───────────────────┼───────────────────┐                           │
│         ▼                   ▼                   ▼                           │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│  │   Cache     │    │  Services   │    │  Holdings   │                     │
│  │ (Postgres)  │    │             │    │ Calculator  │                     │
│  └─────────────┘    └──────┬──────┘    └─────────────┘                     │
│                            │                                                 │
│              ┌─────────────┼─────────────┐                                  │
│              ▼             ▼             ▼                                  │
│       ┌──────────┐  ┌──────────┐  ┌──────────┐                             │
│       │  Envio   │  │   Kong   │  │ DefiLlama│                             │
│       │ GraphQL  │  │   API    │  │   API    │                             │
│       └──────────┘  └──────────┘  └──────────┘                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Request Handling
```
User Request → API Server → Aggregator → Response
```

### 2. Data Collection

```
┌─────────────────────────────────────────────────────────────────┐
│                     For 365-day period:                         │
│                                                                  │
│  1. Check Cache ──────────────────────────────────────────────► │
│     │                                                            │
│     └─► If cached: Use cached daily totals                      │
│     └─► If not cached:                                          │
│                                                                  │
│  2. Fetch Events from Envio ─────────────────────────────────► │
│     • V3 Deposits (owner = user)                                │
│     • V3 Withdrawals (owner = user)                             │
│     • V2 Deposits (recipient = user)                            │
│     • V2 Withdrawals (recipient = user)                         │
│     • Transfers In (receiver = user)                            │
│     • Transfers Out (sender = user)                             │
│                                                                  │
│  3. Build Position Timeline ─────────────────────────────────► │
│     • Calculate share balance at each point in time             │
│                                                                  │
│  4. For each vault position:                                     │
│     a. Fetch vault metadata (Kong) ─────────────────────────► │
│        • Vault asset token address, decimals                      │
│                                                                  │
│     b. Fetch Price Per Share (Kong) ────────────────────────► │
│        • Historical PPS timeseries                               │
│                                                                  │
│     c. Fetch Token Price (DefiLlama) ───────────────────────► │
│        • Historical USD prices for the vault asset token         │
│                                                                  │
│  5. Calculate USD Value per day ────────────────────────────► │
│                                                                  │
│  6. Save daily totals to Cache ─────────────────────────────► │
└─────────────────────────────────────────────────────────────────┘
```

## USD Value Calculation

```
USD Value = Shares × Price Per Share × Underlying Token Price

Where:
  • Shares        = User's vault token balance (from events)
  • PPS           = Price Per Share at that timestamp (from Kong)
  • Token Price   = USD price of the vault asset token (from DefiLlama)
```

### Example:
```
User has: 100 yvUSDC shares
PPS:      1.05 (vault has earned 5% yield)
USDC:     $1.00

USD Value = 100 × 1.05 × 1.00 = $105.00
```

For LP-based vaults, the "token price" can be an LP token price rather than a plain asset like USDC. For example, a Curve strategy vault may use the Curve LP token as its asset token, and the USD value is still computed as:

`vault shares × PPS × LP token USD price`

## Components

### Services

| Service | Source | Purpose |
|---------|--------|---------|
| `graphql.ts` | Envio Indexer | Fetch deposit/withdraw/transfer events with pagination |
| `kong.ts` | Kong API | Fetch historical Price Per Share timeseries |
| `vaults.ts` | Kong API | Fetch vault metadata (token info, decimals, staking) |
| `defillama.ts` | DefiLlama API | Fetch historical token prices |
| `cow.ts` | Ethereum RPC + CoW settlement logs | Synthesize known-basis acquisitions for recognized CoW settlement flows |
| `cache.ts` | PostgreSQL | Cache daily USD totals per user + positive token prices + exact price misses |
| `holdings.ts` | Local | Build position timeline, calculate share balances |
| `aggregator.ts` | Local | Orchestrate all services, main entry point |
| `pnl.ts` | Local | Build family ledgers, FIFO lots, and PnL summaries |

### Data Types

```typescript
// API Response (internal)
interface HoldingsHistoryResponse {
  address: string
  periodDays: number
  dataPoints: Array<{
    date: string        // "2024-01-15"
    timestamp: number   // Unix timestamp (midnight UTC)
    totalUsdValue: number
  }>
}

// Simplified response (from server)
{
  address: string
  version: 'v2' | 'v3' | 'all'
  dataPoints: Array<{
    date: string
    value: number
  }>
}
```

## Vault Versions

The API supports both V2 and V3 Yearn vaults:

| Version | Deposit Event | Withdraw Event | User Field |
|---------|---------------|----------------|------------|
| V3 | `Deposit` | `Withdraw` | `owner` |
| V2 | `V2Deposit` | `V2Withdraw` | `recipient` |

Events are normalized internally to a common format for timeline processing.

## Transfer Events

Transfer events track vault shares moving between addresses (not through deposit/withdraw):

- **Transfers In**: Shares received from another address
- **Transfers Out**: Shares sent to another address

### Special Cases

1. **Mint filtering**: For vaults with indexed deposit events, transfers from `0x000...` (mints) are excluded (already tracked via Deposit events)
2. **Burn filtering**: For vaults with indexed withdraw events, transfers to `0x000...` (burns) are excluded (already tracked via Withdraw events)
3. **Transfer-only vaults**: Some vaults (e.g., staking contracts) don't have indexed Deposit events. For these, mint events ARE included to properly track deposits

### Staking Vaults

Staking vault positions are tracked via the `stakingToVaultMap` in `vaults.ts`. When a user deposits into a staking contract, the system maps the staking address to its underlying vault metadata for proper valuation.

### PnL-Specific Event Enrichment

The PnL endpoint fetches more context than the history endpoint:

1. Address-scoped events for the user
2. Additional transaction-scoped events for the same transaction hashes

That transaction-hash enrichment lets the PnL engine match same-transaction router flows, staking stake/unstake moves, and known migration rollovers even when the economically relevant event was not emitted directly on the user's address filter.

For some recognized Ethereum mainnet CoW settlement transactions, the PnL path also inspects the transaction receipt and settlement logs to synthesize a deposit-like acquisition with known basis. This reduces false partial-cost-basis cases for routed buys into vault asset/share positions.

## API Endpoints

### GET `/api/holdings/history`
Holdings history for charts (date + total value).

The history series ends at the latest settled UTC day, not an intraday "today" point. This keeps the daily series cacheable and avoids recomputing a moving final point on every request. For current portfolio value, use `/api/holdings/pnl`.

```bash
curl "http://localhost:3001/api/holdings/history?address=0x..."
curl "http://localhost:3001/api/holdings/history?address=0x...&fetchType=parallel"
curl "http://localhost:3001/api/holdings/history?address=0x...&paginationMode=all"
```

Query params:
- `address` (required): Ethereum address
- `version` (optional): `v2`, `v3`, or `all` (default: `all`)
- `refresh` (optional, local Bun server only): `true` or `1` to force cache refresh
- `fetchType` (optional): `seq` or `parallel` (default: `seq`)
- `paginationMode` (optional): `paged` or `all` (default: `paged`)

Response:
```json
{
  "address": "0x...",
  "version": "all",
  "dataPoints": [
    { "date": "2024-01-01", "value": 1000.50 },
    { "date": "2024-01-02", "value": 1005.25 }
  ]
}
```

### GET `/api/holdings/breakdown`
Per-vault valuation breakdown for the latest settled holdings-history point.

This endpoint uses the same settled UTC day as the final point on `/api/holdings/history`, so it is useful for explaining why the latest chart value is what it is. It does not use current intraday balances or current intraday prices.

```bash
curl "http://localhost:3001/api/holdings/breakdown?address=0x..."
curl "http://localhost:3001/api/holdings/breakdown?address=0x...&version=v3"
curl "http://localhost:3001/api/holdings/breakdown?address=0x...&fetchType=parallel&paginationMode=all"
```

Query params:
- `address` (required): Ethereum address
- `version` (optional): `v2`, `v3`, or `all` (default: `all`)
- `fetchType` (optional): `seq` or `parallel` (default: `seq`)
- `paginationMode` (optional): `paged` or `all` (default: `paged`)

Response (abridged):
```json
{
  "address": "0x...",
  "version": "all",
  "date": "2026-04-07",
  "timestamp": 1775529600,
  "summary": {
    "totalVaults": 3,
    "vaultsWithShares": 2,
    "totalUsdValue": 1250.5,
    "missingMetadata": 0,
    "missingPps": 0,
    "missingPrice": 1
  },
  "vaults": [
    {
      "chainId": 1,
      "vaultAddress": "0x...",
      "shares": "1000000000000000000",
      "sharesFormatted": 1,
      "pricePerShare": 1.05,
      "tokenPrice": 1,
      "usdValue": 1.05,
      "metadata": {
        "symbol": "USDC",
        "decimals": 18,
        "tokenAddress": "0x..."
      },
      "status": "ok"
    }
  ],
  "issues": {
    "missingMetadata": [],
    "missingPps": [],
    "missingPrice": ["1:0x..."]
  }
}
```

### GET `/api/holdings/pnl`
FIFO-based realized and unrealized PnL for the user’s vault activity.

For the dedicated accounting-model walkthrough, see [`PNL.md`](./PNL.md).

```bash
curl "http://localhost:3001/api/holdings/pnl?address=0x..."
curl "http://localhost:3001/api/holdings/pnl?address=0x...&unknownMode=windfall"
curl "http://localhost:3001/api/holdings/pnl?address=0x...&fetchType=parallel"
curl "http://localhost:3001/api/holdings/pnl?address=0x...&paginationMode=all"
```

Query params:
- `address` (required): Ethereum address
- `version` (optional): `v2`, `v3`, or `all` (default: `all`)
- `unknownMode` (optional): `strict`, `zero_basis`, or `windfall` (default: `windfall`)
- `fetchType` (optional): `seq` or `parallel` (default: `seq`)
- `paginationMode` (optional): `paged` or `all` (default: `paged`)

Response (abridged):
```json
{
  "address": "0x...",
  "version": "all",
  "unknownTransferInPnlMode": "windfall",
  "generatedAt": "2026-03-16T12:00:00.000Z",
  "summary": {
    "totalVaults": 5,
    "completeVaults": 4,
    "partialVaults": 1,
    "totalCurrentValueUsd": 1500.0,
    "totalUnknownCostBasisValueUsd": 0,
    "totalWindfallPnlUsd": 100.0,
    "totalRealizedPnlUsd": 20.5,
    "totalUnrealizedPnlUsd": 45.25,
    "totalPnlUsd": 65.75,
    "totalEconomicGainUsd": 165.75,
    "byCategory": {
      "stable": {
        "totalPnlUsd": 40.0,
        "totalEconomicGainUsd": 60.0
      },
      "volatile": {
        "totalPnlUsd": 25.75,
        "totalEconomicGainUsd": 105.75
      }
    },
    "isComplete": false
  },
  "vaults": [
    {
      "chainId": 1,
      "vaultAddress": "0x...",
      "status": "ok",
      "costBasisStatus": "partial",
      "unknownTransferInPnlMode": "windfall",
      "currentUnderlying": 105.0,
      "knownCostBasisUnderlying": 100.0,
      "knownCostBasisUsd": 100.0,
      "unknownCostBasisValueUsd": 0,
      "windfallPnlUsd": 100.0,
      "realizedPnlUsd": 12.5,
      "unrealizedPnlUsd": 4.25,
      "totalPnlUsd": 16.75,
      "totalEconomicGainUsd": 116.75,
      "currentValueUsd": 105.0,
      "metadata": {
        "symbol": "USDC",
        "decimals": 6,
        "assetDecimals": 6,
        "tokenAddress": "0x...",
        "category": "stable"
      }
    }
  ]
}
```

The live response also includes:

- share balances
- vault-share vs staked-share splits
- per-vault event counts
- explicit underlying amounts (`currentUnderlying`, `vaultUnderlying`, `stakedUnderlying`)
- explicit known-basis metrics (`knownCostBasisUnderlying`, `knownCostBasisUsd`, `currentKnownUnderlying`, `currentUnknownUnderlying`)

Notes:
- Deposits create FIFO lots using the indexed `assets` and `shares` values.
- Known-basis USD PnL is true mark-to-market PnL: deposit lots keep their acquisition timestamp, and USD basis is valued using the underlying token price at deposit time.
- Withdrawals realize PnL from the oldest remaining lots first.
- `totalPnlUsd = totalRealizedPnlUsd + totalUnrealizedPnlUsd`.
- `totalEconomicGainUsd = totalPnlUsd + totalWindfallPnlUsd`.
- Some recognized reward-distribution flows are treated as explicit zero-basis reward receipts rather than unknown transfers. Those shares are considered economically free, but they stay `costBasisStatus: "complete"` and contribute to normal realized / unrealized PnL instead of `windfallPnlUsd`.
- `summary.byCategory.stable` and `summary.byCategory.volatile` split `totalPnlUsd` and `totalEconomicGainUsd` by Kong vault category while the top-level summary remains the portfolio-wide total.
- Staking wrappers are collapsed into the underlying vault family. Staked shares and directly held vault shares share the same FIFO lots and only change location.
- Underlying vault `Deposit` and `Withdraw` events define cost basis and realized proceeds. Staking `Deposit` and `Withdraw` events are treated as stake or unstake moves, not as economic entries.
- Same-transaction router flows can carry basis into or out of a staking vault family when the transfer can be matched to an indexed underlying vault deposit or withdrawal in the same transaction.
- Recognized vault-to-vault rollover transactions can roll basis from a source family into a destination family, including known migrator flows, supported Enso-mediated rollovers on Ethereum mainnet, and supported compatible nested-vault paths where one Yearn vault token is the asset of another Yearn vault. The current compatible nested-vault allowlist includes the `ysyBOLD <-> yBOLD` path on Ethereum mainnet. When source basis cannot be reconstructed, the destination shares stay partial / unknown-basis.
- Plain share transfers may leave some lots with unknown cost basis. Those vaults are returned with `costBasisStatus: "partial"`. In `strict` mode, the unmatched current portion is reported in `unknownCostBasisValueUsd`; in `zero_basis` and `windfall`, that value is zeroed and the economics are attributed according to `unknownTransferInPnlMode`.
- The endpoint keeps families with non-zero current shares even if they only arrived through transfers, but transfer-only families with zero remaining shares may still be omitted. Those transfer-only holdings are marked partial and prioritized for current-value completeness over full historical price reconstruction.
- `isComplete` becomes `false` when at least one returned vault still has partial / unknown basis.

### GET `/api/holdings/pnl/drilldown`
Lot-level drilldown for the PnL engine. This is the "excessive" companion to `/api/holdings/pnl`.

Use it when the frontend needs current lots, realized lot consumption, unknown-basis receipts / withdrawals, or a transaction journal showing how the family lot state changed over time.

```bash
curl "http://localhost:3001/api/holdings/pnl/drilldown?address=0x..."
curl "http://localhost:3001/api/holdings/pnl/drilldown?address=0x...&vault=0x..."
curl "http://localhost:3001/api/holdings/pnl/drilldown?address=0x...&unknownMode=windfall"
```

Query params:
- `address` (required): Ethereum address
- `vault` (optional): family vault or staking vault address to limit the response to one family
- `version` (optional): `v2`, `v3`, or `all` (default: `all`)
- `unknownMode` (optional): `strict`, `zero_basis`, or `windfall` (default: `windfall`)
- `fetchType` (optional): `seq` or `parallel` (default: `seq`)
- `paginationMode` (optional): `paged` or `all` (default: `paged`)

Response additions per vault:
- `currentLots.vault` and `currentLots.staked`
- `realizedEntries` with consumed lots and USD/underlying proceeds/basis/PnL
- `rewardTransferInEntries` for recognized zero-basis reward receipts
- `unknownTransferInEntries` with receipt-time valuation
- `unknownWithdrawalEntries` with proceeds and consumed unknown lots
- `journal` rows with before/after lot summaries for vault-share and staked-share locations

Notes:
- `rewardTransferInEntries` are known-basis receipts with `costBasis = 0`, so they are not affected by `unknownMode`.
- The drilldown journal includes `rewardInVaultShares` / `rewardInStakedShares` and the transaction hash. If the UI wants explorer links for reward rows, it should join the reward entry to the matching journal row.

The drilldown response uses the same summary fields and top-level identity fields as `/api/holdings/pnl`, but each vault row is expanded for UI drilldown rather than table rendering.

### Unknown Transfer-In Modes

Unknown share transfers can be interpreted three ways:

- `strict`
  - Unknown shares do not contribute to PnL.
  - Their current value is reported in `unknownCostBasisValueUsd`.
- `zero_basis`
  - Unknown shares are treated as if they were acquired for zero cost.
  - Receipt-time value and any later market move both end up inside realized / unrealized PnL.
- `windfall` (default)
  - Unknown shares are still treated as free economically, but the gain is split into two parts.
  - Receipt-time fair value is isolated in `windfallPnlUsd`.
  - `totalPnlUsd` only tracks market movement after receipt.
  - `totalEconomicGainUsd = totalPnlUsd + totalWindfallPnlUsd`.

`zero_basis` and `windfall` can report the same `totalEconomicGainUsd`. The difference is attribution:

- `zero_basis` books the full gain as market PnL.
- `windfall` books receipt-time value as windfall and only the post-receipt move as market PnL.

Example:

```text
Unknown shares received at $1,000 value and later worth $1,150

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

## Supported Chains

| Chain | ID | DefiLlama Prefix |
|-------|-----|-----------------|
| Ethereum | 1 | ethereum |
| Base | 8453 | base |
| Arbitrum | 42161 | arbitrum |
| Polygon | 137 | polygon |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENVIO_GRAPHQL_URL` | No | `http://localhost:8080/v1/graphql` | Envio indexer GraphQL endpoint |
| `ENVIO_PASSWORD` | No | `''` (empty) | Envio Hasura admin secret (header skipped if empty or 'testing') |
| `DATABASE_URL_PREVIEW` | No | `null` | Preview PostgreSQL connection string. Used in preference to `DATABASE_URL` when set. |
| `DATABASE_URL` | No | `null` | Default PostgreSQL connection string (caching disabled if neither DB env var is set) |
| `ETHEREUM_RPC_URL` | No | `https://ethereum-rpc.publicnode.com` | Mainnet RPC used for receipt-level enrichment such as CoW settlement decoding |
| `DEFILLAMA_API_KEY` | No | `''` (empty) | Enables the paid DefiLlama GET route at `https://pro-api.llama.fi/{key}/coins/batchHistorical?coins=...` |
| `ADMIN_SECRET` | No | `null` | Secret for admin endpoints (cache invalidation). Use 32+ char random string. |

**Note**: Kong and DefiLlama base URLs are hardcoded:
- Kong: `https://kong.yearn.fi`
- DefiLlama free: `https://coins.llama.fi`
- DefiLlama pro: `https://pro-api.llama.fi`

## Pagination & Performance

### The 1000 Result Limit

Envio's hosted service enforces a **hard limit of 1000 results per query**. This is server-side and cannot be increased by requesting a larger `limit` parameter. Users with extensive transaction history require pagination to fetch all events.

### Current Solution: Sequential Pagination

Each event type is fetched with sequential pagination - pages are fetched one after another until fewer than `BATCH_SIZE` (1000) results are returned:

```
Query: User has 3,500 transfers
  │
  ├─► Fetch offset=0, limit=1000 → 1000 results (continue)
  ├─► Fetch offset=1000, limit=1000 → 1000 results (continue)
  ├─► Fetch offset=2000, limit=1000 → 1000 results (continue)
  └─► Fetch offset=3000, limit=1000 → 500 results (done!)
```

All 6 event types (V3 deposits/withdrawals, V2 deposits/withdrawals, transfers in/out) are fetched in parallel, but each type paginates sequentially within itself.

### PnL Fetch Controls

The PnL endpoint exposes request-time controls for benchmarking alternate address-scoped fetch strategies:

- `fetchType=seq|parallel`
  - `seq`: normal `1000`-row sequential pagination
  - `parallel`: try GraphQL aggregate counts first, then fetch address-scoped pages concurrently

- `paginationMode=paged|all`
  - `paged`: normal `limit/offset` pagination
  - `all`: issue one large query per event family instead of paging

`parallel` depends on these aggregate roots being available on the GraphQL schema:
- `Deposit_aggregate`, `Withdraw_aggregate`
- `V2Deposit_aggregate`, `V2Withdraw_aggregate`
- `Transfer_aggregate`

If aggregate roots are unavailable in a given environment, the code falls back to sequential pagination. `paginationMode=all` bypasses the aggregate preflight entirely and is meant for experimentation rather than as a production default.

### maxTimestamp Optimization

When only calculating a few missing days, the `maxTimestamp` parameter limits event fetching:

```typescript
// Only fetch events up to end of last missing day
const maxTimestamp = Math.max(...missingTimestamps) + 86400
const events = await fetchUserEvents(userAddress, 'all', maxTimestamp, fetchType, paginationMode)
```

## Caching Strategy

The cache stores **daily USD totals per user** (not per-vault breakdowns).

```
┌─────────────────────────────────────────────────────────────┐
│                    Cache Lookup Flow                         │
│                                                              │
│  Request for 365 days of data                               │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────┐                                        │
│  │ Check DB cache  │                                        │
│  │ for date range  │                                        │
│  └────────┬────────┘                                        │
│           │                                                  │
│           ▼                                                  │
│  ┌──────────────────────────────────────────────┐           │
│  │ If all settled UTC days are cached           │           │
│  │ → return directly from cache                 │           │
│  └──────────────────────────────────────────────┘           │
│  ┌──────────────────────────────────────────────┐           │
│  │ If some settled days are missing             │           │
│  │ → fetch only up to the last missing day      │           │
│  │ → calculate missing days                     │           │
│  │ → save new daily totals to cache             │           │
│  └──────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

The history series ends at the latest settled UTC day rather than an intraday moving "today" point. Current portfolio value should come from `/api/holdings/pnl`.

### Cache Layers

1. **PostgreSQL** (server):
   - Daily totals cached per user and vault version
   - Token prices cached globally (shared across all users)
   - Exact token/timestamp price misses cached globally with TTL to suppress repeated unsupported DefiLlama fetches
2. **HTTP Cache-Control** (CDN): `s-maxage=300, stale-while-revalidate=600`
3. **TanStack Query** (client): 4-hour cache duration

## Database Schema

```sql
-- User daily totals (one row per user per day)
CREATE TABLE IF NOT EXISTS holdings_totals (
  user_address_hash VARCHAR(64) NOT NULL,
  version           VARCHAR(8) NOT NULL DEFAULT 'all',
  date              DATE NOT NULL,
  usd_value         NUMERIC NOT NULL,
  updated_at        TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_address_hash, version, date)
);

-- Token price cache (shared across all users)
CREATE TABLE IF NOT EXISTS token_prices (
  token_key  VARCHAR(100) NOT NULL,  -- e.g., "ethereum:0xa0b8..."
  timestamp  INTEGER NOT NULL,        -- Unix timestamp (midnight UTC)
  price      NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (token_key, timestamp)
);

-- Exact token/timestamp misses for unsupported DefiLlama points
CREATE TABLE IF NOT EXISTS token_price_misses (
  token_key  VARCHAR(100) NOT NULL,
  timestamp  INTEGER NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (token_key, timestamp)
);

-- Vault invalidation timestamps (for cache invalidation)
CREATE TABLE IF NOT EXISTS vault_invalidations (
  vault_address  VARCHAR(42) NOT NULL,
  chain_id       INTEGER NOT NULL,
  invalidated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (vault_address, chain_id)
);

CREATE INDEX IF NOT EXISTS idx_token_prices_token_key ON token_prices(token_key);
CREATE INDEX IF NOT EXISTS idx_token_price_misses_token_key ON token_price_misses(token_key);
CREATE INDEX IF NOT EXISTS idx_token_price_misses_expires_at ON token_price_misses(expires_at);
CREATE INDEX IF NOT EXISTS idx_vault_invalidations_time ON vault_invalidations(invalidated_at);
```

- `holdings_totals`: ~365 rows per hashed user key for full history
- `token_prices`: Shared positive-price cache, reduces DefiLlama API calls for exact timestamp hits
- `token_price_misses`: Shared negative cache for exact unsupported price points, currently stored with a 7-day TTL
- `vault_invalidations`: Tracks when vaults were invalidated for lazy cache refresh

## Cache Invalidation

When new vaults are added to the indexer, cached data becomes stale. The system uses **lazy per-vault invalidation**:

1. After deploying indexer with new vault, call `POST /api/admin/invalidate-cache` with the vault addresses
2. This records invalidation timestamps in `vault_invalidations` table
3. On user requests, the system checks if any of the user's vaults were invalidated after their cache was written
4. If stale, the user's cache is cleared and recalculated

This approach:
- Only refreshes cache for users who hold the newly-indexed vault
- Refresh happens lazily on next request (after client cache expires)
- No need to know affected users upfront
