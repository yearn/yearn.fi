# Holdings History API

Calculates historical USD values of a user's Yearn vault positions over the past 90 days.

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
│                     For 90-day period:                          │
│                                                                  │
│  1. Check Cache ──────────────────────────────────────────────► │
│     │                                                            │
│     └─► If cached: Use cached daily totals                      │
│     └─► If not cached:                                          │
│                                                                  │
│  2. Fetch Events from Envio ─────────────────────────────────► │
│     • Deposits                                                   │
│     • Withdrawals                                                │
│     • Transfers In                                               │
│     • Transfers Out                                              │
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
| `graphql.ts` | Envio Indexer | Fetch deposit/withdraw/transfer events |
| `kong.ts` | Kong API | Fetch historical Price Per Share timeseries |
| `vaults.ts` | Kong API | Fetch vault metadata (token info, decimals) |
| `defillama.ts` | DefiLlama API | Fetch historical token prices |
| `cache.ts` | PostgreSQL | Cache daily USD totals per user |
| `holdings.ts` | Local | Build position timeline, calculate share balances |
| `aggregator.ts` | Local | Orchestrate all services, main entry point |

### Data Types

```typescript
// API Response
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

## API Endpoints

### GET `/api/holdings/history`
Holdings history for charts (date + total value).

```bash
curl "http://localhost:3001/api/holdings/history?address=0x..."
```

Query params:
- `address` (required): Ethereum address
- `version` (optional): `v2`, `v3`, or `all` (default: `all`)

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
| `ENVIO_PASSWORD` | No | `testing` | Envio Hasura admin secret |
| `DATABASE_URL` | No | `null` | PostgreSQL connection string (caching disabled if not set) |

## Caching Strategy

The cache stores **daily USD totals per user** (not per-vault breakdowns).

```
┌─────────────────────────────────────────────────────────────┐
│                    Cache Lookup Flow                         │
│                                                              │
│  Request for 90 days of data                                │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────┐                                        │
│  │ Check DB cache  │                                        │
│  │ for date range  │                                        │
│  └────────┬────────┘                                        │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────────────────────────┐                    │
│  │ Found: Days 1-85 cached             │                    │
│  │ Missing: Days 86-90                 │                    │
│  └────────┬────────────────────────────┘                    │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────────────────────────┐                    │
│  │ Only calculate missing days (86-90) │                    │
│  │ Save new daily totals to cache      │                    │
│  └────────┬────────────────────────────┘                    │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────────────────────────┐                    │
│  │ Merge cached + new data             │                    │
│  │ Return complete 90-day response     │                    │
│  └─────────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

### Cache Layers

1. **PostgreSQL** (server): Daily totals cached permanently per user
2. **HTTP Cache-Control** (CDN): `s-maxage=300, stale-while-revalidate=600`
3. **TanStack Query** (client): 5-minute stale time

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS holdings_totals (
  user_address VARCHAR(42) NOT NULL,
  date         DATE NOT NULL,
  usd_value    NUMERIC NOT NULL,
  updated_at   TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_address, date)
);
```

One row per user per day = ~90 rows per user for full history.
