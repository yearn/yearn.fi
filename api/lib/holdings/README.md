# Holdings History API

Calculates historical USD values of a user's Yearn vault positions over the past 365 days (1 year).

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Frontend                                        │
│                    usePortfolioHistory() hook                               │
│                              │                                               │
│                              ▼                                               │
│                    GET /api/holdings/history?address=0x...                  │
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
│        • Token address, decimals                                 │
│                                                                  │
│     b. Fetch Price Per Share (Kong) ────────────────────────► │
│        • Historical PPS timeseries                               │
│                                                                  │
│     c. Fetch Token Price (DefiLlama) ───────────────────────► │
│        • Historical USD prices                                   │
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
  • Token Price   = USD price of underlying token (from DefiLlama)
```

### Example:
```
User has: 100 yvUSDC shares
PPS:      1.05 (vault has earned 5% yield)
USDC:     $1.00

USD Value = 100 × 1.05 × 1.00 = $105.00
```

## Components

### Services

| Service | Source | Purpose |
|---------|--------|---------|
| `graphql.ts` | Envio Indexer | Fetch deposit/withdraw/transfer events with pagination |
| `kong.ts` | Kong API | Fetch historical Price Per Share timeseries |
| `vaults.ts` | Kong API | Fetch vault metadata (token info, decimals, staking) |
| `defillama.ts` | DefiLlama API | Fetch historical token prices |
| `cache.ts` | PostgreSQL | Cache daily USD totals per user + token prices |
| `holdings.ts` | Local | Build position timeline, calculate share balances |
| `aggregator.ts` | Local | Orchestrate all services, main entry point |

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

## API Endpoints

### GET `/api/holdings/history`
Holdings history for charts (date + total value).

```bash
curl "http://localhost:3001/api/holdings/history?address=0x..."
```

Query params:
- `address` (required): Ethereum address
- `version` (optional): `v2`, `v3`, or `all` (default: `all`)
- `refresh` (optional): `true` or `1` to force cache refresh

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

### GET `/api/holdings/pnl`
FIFO-based realized and unrealized PnL for the user’s vault activity.

```bash
curl "http://localhost:3001/api/holdings/pnl?address=0x..."
```

Query params:
- `address` (required): Ethereum address
- `version` (optional): `v2`, `v3`, or `all` (default: `all`)

Response:
```json
{
  "address": "0x...",
  "version": "all",
  "summary": {
    "totalVaults": 5,
    "totalCurrentValueUsd": 1500.0,
    "totalRealizedPnlUsd": 120.5,
    "totalUnrealizedPnlUsd": 45.25,
    "totalPnlUsd": 165.75,
    "isComplete": true
  },
  "vaults": [
    {
      "chainId": 1,
      "vaultAddress": "0x...",
      "status": "ok",
      "costBasisStatus": "complete",
      "realizedPnlUsd": 12.5,
      "unrealizedPnlUsd": 4.25,
      "currentValueUsd": 105.0,
      "metadata": {
        "symbol": "USDC",
        "decimals": 6,
        "tokenAddress": "0x..."
      }
    }
  ]
}
```

Notes:
- Deposits create FIFO lots using the indexed `assets` and `shares` values.
- Withdrawals realize PnL from the oldest remaining lots first.
- Same-transaction migrations can carry basis into a new vault lot when the transfer-in can be matched to an indexed withdrawal source.
- Plain share transfers may leave some lots with unknown cost basis. Those vaults are returned with `costBasisStatus: "partial"` and the unmatched portion is reported in `unknownCostBasisValueUsd`.

### GET `/api/holdings/breakdown`
Current vault positions with detailed breakdown (not cached).

```bash
curl "http://localhost:3001/api/holdings/breakdown?address=0x..."
```

Response:
```json
{
  "address": "0x...",
  "summary": {
    "totalVaults": 5,
    "vaultsWithShares": 2,
    "totalUsdValue": 1500.00
  },
  "vaults": [
    {
      "chainId": 1,
      "vaultAddress": "0x...",
      "shares": "1000000000000000000",
      "sharesFormatted": 1.0,
      "pricePerShare": 1.05,
      "tokenPrice": 1.00,
      "usdValue": 1.05,
      "metadata": {
        "symbol": "USDC",
        "decimals": 18,
        "tokenAddress": "0x..."
      },
      "status": "ok"
    }
  ]
}
```

### GET `/api/holdings/debug`
Debug endpoint for inspecting raw events.

```bash
curl "http://localhost:3001/api/holdings/debug?address=0x...&vault=0x..."
```

### POST `/api/admin/invalidate-cache`
Protected endpoint to invalidate cache when new vaults are indexed.

```bash
curl -X POST "http://localhost:3001/api/admin/invalidate-cache" \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"vaults": [{"address": "0x...", "chainId": 1}]}'
```

Request body:
```json
{
  "vaults": [
    { "address": "0xac37729b76db6438ce62042ae1270ee574ca7571", "chainId": 1 },
    { "address": "0x7fd8af959b54a677a1d8f92265bd0714274c56a3", "chainId": 8453 }
  ]
}
```

Response:
```json
{
  "success": true,
  "invalidated": 2,
  "vaults": ["1:0xac37729b...", "8453:0x7fd8af9..."],
  "timestamp": "2026-03-07T12:00:00Z"
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
| `DATABASE_URL` | No | `null` | PostgreSQL connection string (caching disabled if not set) |
| `ADMIN_SECRET` | No | `null` | Secret for admin endpoints (cache invalidation). Use 32+ char random string. |

**Note**: Kong and DefiLlama base URLs are hardcoded:
- Kong: `https://kong.yearn.fi`
- DefiLlama: `https://coins.llama.fi`

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

### Future Option: Parallel Batch Fetching

The codebase includes `fetchUserEventsParallel()` which uses pre-computed counts from the indexer to fetch all batches in parallel. This requires:
- `UserEventCounts` entity in the indexer schema
- Event handlers that increment counts as events are processed

To enable, the indexer must expose `UserEventCounts_by_pk` with fields:
- `depositCount`, `withdrawCount` (V3 events)
- `v2DepositCount`, `v2WithdrawCount` (V2 events)
- `transferInCount`, `transferOutCount` (Transfer events)

### maxTimestamp Optimization

When only calculating a few missing days, the `maxTimestamp` parameter limits event fetching:

```typescript
// Only fetch events up to end of last missing day
const maxTimestamp = Math.max(...missingTimestamps) + 86400
const events = await fetchUserEvents(userAddress, version, maxTimestamp)
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
│  ┌───────────────────────────────────────┐                  │
│  │ Found: Days 1-360 cached              │                  │
│  │ Missing: Days 361-365                 │                  │
│  │ Today: Always recalculated            │                  │
│  └────────┬──────────────────────────────┘                  │
│           │                                                  │
│           ▼                                                  │
│  ┌───────────────────────────────────────┐                  │
│  │ Only calculate missing days (361-365) │                  │
│  │ Fetch events with maxTimestamp filter │                  │
│  │ Save new daily totals to cache        │                  │
│  └────────┬──────────────────────────────┘                  │
│           │                                                  │
│           ▼                                                  │
│  ┌───────────────────────────────────────┐                  │
│  │ Merge cached + new data               │                  │
│  │ Return complete 365-day response      │                  │
│  └───────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### Why Today is Always Recalculated

Today's value uses the latest available Price Per Share from Kong, which may update throughout the day. Recalculating ensures users see current values.

### Cache Layers

1. **PostgreSQL** (server):
   - Daily totals cached per user (today recalculated on each request)
   - Token prices cached globally (shared across all users)
2. **HTTP Cache-Control** (CDN): `s-maxage=300, stale-while-revalidate=600`
3. **TanStack Query** (client): 4-hour cache duration

## Database Schema

```sql
-- User daily totals (one row per user per day)
CREATE TABLE IF NOT EXISTS holdings_totals (
  user_address VARCHAR(42) NOT NULL,
  date         DATE NOT NULL,
  usd_value    NUMERIC NOT NULL,
  updated_at   TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_address, date)
);

-- Token price cache (shared across all users)
CREATE TABLE IF NOT EXISTS token_prices (
  token_key  VARCHAR(100) NOT NULL,  -- e.g., "ethereum:0xa0b8..."
  timestamp  INTEGER NOT NULL,        -- Unix timestamp (midnight UTC)
  price      NUMERIC NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_vault_invalidations_time ON vault_invalidations(invalidated_at);
```

- `holdings_totals`: ~365 rows per user for full history
- `token_prices`: Shared cache, reduces DefiLlama API calls from ~45s to ~100ms for repeat requests
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
