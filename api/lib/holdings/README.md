# Holdings APIs

Calculates historical USD values, per-day breakdowns, activity, and protocol-return history for a user's Yearn vault positions.

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
| `cache.ts` | PostgreSQL | Cache daily USD totals per user + positive token prices + exact price misses |
| `holdings.ts` | Local | Build position timeline, calculate share balances |
| `aggregator.ts` | Local | Orchestrate all services, main entry point |
| `pnlEvents.ts` | Local | Normalize indexed events into shared raw event records |
| `pnlSimple.ts` | Local | Build protocol-return exposure history without cost-basis reconstruction |

### Data Types

```typescript
// API Response (internal)
interface HoldingsHistoryResponse {
  address: string
  periodDays: number
  dataPoints: Array<{
    date: string        // "2024-01-15"
    timestamp: number   // Unix timestamp (end of the settled UTC day)
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

### Protocol Return Event Context

Protocol-return history starts from the same settled address-scoped context as holdings history:

1. Address-scoped events for the user
2. Vault metadata, including staking-to-family mapping
3. PPS timelines with in-flight request dedupe
4. Historical token prices using the shared UTC-day price cache

For protocol-return history, transaction-scoped enrichment is limited to the event context needed to match stake/unstake and same-transaction vault share movements. It does not build FIFO cost-basis lots or accounting PnL.

## API Endpoints

### GET `/api/holdings/history`
Holdings history for charts (date + total value).

The history series ends at the latest settled UTC day, not an intraday "today" point. This keeps the daily series cacheable and avoids recomputing a moving final point on every request.
Vaults with `isHidden=true` in authoritative Kong metadata are excluded from history totals and do not contribute to chart points.

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
Vaults with `isHidden=true` in authoritative Kong metadata are excluded from the returned rows.

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

### GET `/api/holdings/protocol-return/history`
Protocol-return history for the user’s vault exposure.

This route is not a cost-basis PnL engine. It measures how much Yearn increased the user’s withdrawable underlying amount while the user held vault shares. Receipt-time token prices are used only to weight different assets into one portfolio percentage.

The old `/api/holdings/pnl/simple-history` path is kept as a temporary compatibility alias.
Vaults with `isHidden=true` in authoritative Kong metadata are excluded.

```bash
curl "http://localhost:3001/api/holdings/protocol-return/history?address=0x..."
curl "http://localhost:3001/api/holdings/protocol-return/history?address=0x...&version=v3"
curl "http://localhost:3001/api/holdings/protocol-return/history?address=0x...&timeframe=all"
curl "http://localhost:3001/api/holdings/protocol-return/history?address=0x...&chainId=1&vault=0x..."
```

Query params:
- `address` (required): Ethereum address
- `version` (optional): `v2`, `v3`, or `all` (default: `all`)
- `timeframe` (optional): `1y` or `all` (default: `1y`)
- `vault` + `chainId` (optional): limit response to one vault family
- `fetchType` (optional): `seq` or `parallel` (default: `seq`)
- `paginationMode` (optional): `paged` or `all` (default: `paged`)

Metric model:

```text
baselineUnderlying = shares received * PPS at receipt
growthUnderlying = withdrawable underlying now-or-at-exit - baselineUnderlying
baselineWeightUsd = baselineUnderlying * receiptTokenPriceUsd
growthWeightUsd = growthUnderlying * receiptTokenPriceUsd
protocolReturnPct = growthWeightUsd / baselineWeightUsd * 100
```

Because both numerator and denominator use the same receipt-time token price, later asset price movement does not affect `protocolReturnPct`.

Response (abridged):

```json
{
  "address": "0x...",
  "version": "all",
  "timeframe": "1y",
  "summary": {
    "totalVaults": 5,
    "completeVaults": 5,
    "partialVaults": 0,
    "recommendedGrowthDisplay": "usd",
    "recommendedGrowthDisplayReason": "stable_dominant",
    "isComplete": true
  },
  "dataPoints": [
    {
      "date": "2026-04-07",
      "timestamp": 1775529600,
      "growthWeightUsd": 100,
      "growthWeightEth": null,
      "protocolReturnPct": 10,
      "annualizedProtocolReturnPct": 12,
      "growthIndex": 1.1
    }
  ]
}
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

### Event Fetch Controls

Holdings routes expose request-time controls for benchmarking alternate address-scoped fetch strategies:

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

The history series ends at the latest settled UTC day rather than an intraday moving "today" point.

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
  timestamp  INTEGER NOT NULL,        -- Unix timestamp (end of the settled UTC day)
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
