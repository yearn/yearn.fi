# Holdings History API

This API calculates historical USD values of a user's Yearn vault positions over the past 90 days.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Frontend                                        │
│                    usePortfolioHistory() hook                               │
│                              │                                               │
│                              ▼                                               │
│                    GET /api/v1/holdings/history/simple?address=0x...        │
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
│                            │                                                 │
│                            ▼                                                 │
│                     ┌──────────┐                                            │
│                     │ yDaemon  │                                            │
│                     │   API    │                                            │
│                     └──────────┘                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Request Handling
```
User Request → API Server → Aggregator → Response
```

### 2. Data Collection (for each day in the 90-day period)

```
┌─────────────────────────────────────────────────────────────────┐
│                     For each timestamp:                          │
│                                                                  │
│  1. Check Cache ──────────────────────────────────────────────► │
│     │                                                            │
│     └─► If cached: Use cached data                              │
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
│     a. Fetch vault metadata (yDaemon) ───────────────────────► │
│        • Token address, decimals                                 │
│                                                                  │
│     b. Fetch Price Per Share (Kong) ─────────────────────────► │
│        • Historical PPS data                                     │
│                                                                  │
│     c. Fetch Token Price (DefiLlama) ────────────────────────► │
│        • Historical USD prices                                   │
│                                                                  │
│  5. Calculate USD Value ─────────────────────────────────────► │
│                                                                  │
│  6. Save to Cache ───────────────────────────────────────────► │
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
| `kong.ts` | Kong API | Fetch historical Price Per Share data |
| `defillama.ts` | DefiLlama API | Fetch historical token prices |
| `ydaemon.ts` | yDaemon API | Fetch vault metadata (token info, decimals) |
| `cache.ts` | PostgreSQL | Cache calculated holdings to avoid recalculation |
| `holdings.ts` | Local | Build position timeline, calculate share balances |
| `aggregator.ts` | Local | Orchestrate all services, main entry point |

### Data Types

```typescript
// API Response
interface HoldingsHistoryResponse {
  address: string
  periodDays: number
  dataPoints: DailyHoldings[]
}

// Daily snapshot
interface DailyHoldings {
  date: string           // "2024-01-15"
  timestamp: number      // Unix timestamp
  totalUsdValue: number  // Total USD across all chains
  chains: ChainHoldings[]
}

// Per-chain breakdown
interface ChainHoldings {
  chainId: number
  chainName: string
  totalUsdValue: number
  vaults: VaultHolding[]
}

// Individual vault position
interface VaultHolding {
  address: string
  shares: string
  usdValue: number
  pricePerShare: number
  underlyingPrice: number
}
```

## API Endpoints

### GET `/api/v1/holdings/history`
Full holdings history with per-chain and per-vault breakdown.

```bash
curl "http://localhost:3001/api/v1/holdings/history?address=0x..."
```

### GET `/api/v1/holdings/history/simple`
Simplified response for charts (date + total value only).

```bash
curl "http://localhost:3001/api/v1/holdings/history/simple?address=0x..."
```

Response:
```json
{
  "address": "0x...",
  "dataPoints": [
    { "date": "2024-01-01", "value": 1000.50 },
    { "date": "2024-01-02", "value": 1005.25 },
    ...
  ]
}
```

### DELETE `/api/v1/holdings/cache`
Clear cached data (useful for forcing recalculation).

```bash
curl -X DELETE "http://localhost:3001/api/v1/holdings/cache?address=0x..."
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
│  │ Save new calculations to cache      │                    │
│  └────────┬────────────────────────────┘                    │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────────────────────────┐                    │
│  │ Merge cached + new data             │                    │
│  │ Return complete 90-day response     │                    │
│  └─────────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS holdings_cache (
  user_address    VARCHAR(42) NOT NULL,
  date            DATE NOT NULL,
  chain_id        INTEGER NOT NULL,
  vault_address   VARCHAR(42) NOT NULL,
  shares          NUMERIC NOT NULL,
  usd_value       NUMERIC NOT NULL,
  price_per_share NUMERIC NOT NULL,
  underlying_price NUMERIC NOT NULL,
  PRIMARY KEY (user_address, date, chain_id, vault_address)
);
```
