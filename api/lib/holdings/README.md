# Holdings APIs

Calculates historical holdings value, per-vault breakdowns, recent activity, and protocol-return history for Yearn vault positions.

## Runtime Shape

```
Frontend hooks
  │
  ├─ GET /api/holdings/history
  ├─ GET /api/holdings/progress
  ├─ GET /api/holdings/breakdown
  ├─ GET /api/holdings/activity
  └─ GET /api/holdings/protocol-return/history
      │
      ▼
Holdings services
  │
  ├─ Envio GraphQL: deposits, withdrawals, transfers
  ├─ Kong: vault metadata and historical PPS
  ├─ yearn-prices or DefiLlama: historical token prices
  └─ PostgreSQL: optional server-side cache, progress, rate limits, invalidations
```

In production, files under `api/` run as Vercel functions. In local development, `api/server.ts` exposes the same holdings routes on the Bun API server at `localhost:3001` and adds local-only debug and refresh controls.

## Core Model

### Holdings Value

```text
USD value = vault shares * price per share * vault asset USD price
```

- `vault shares`: reconstructed from indexed deposits, withdrawals, and transfers.
- `price per share`: fetched from Kong historical PPS data.
- `vault asset USD price`: fetched from yearn-prices when configured, otherwise DefiLlama.

LP and nested-vault assets are valued the same way: the vault asset token receives a USD price, then vault shares and PPS convert the user's position into that asset amount.

### Settled Daily History

History endpoints return settled UTC days only. The latest point is the previous settled UTC day, not an intraday moving "today" point.

- `timeframe=1y`: last `365` settled UTC days.
- `timeframe=all`: supported range from `2024-01-01T00:00:00Z` through the latest settled UTC day.

The API internally values each day at `23:59:59 UTC`.

## Services

| Service | Source | Purpose |
|---------|--------|---------|
| `graphql.ts` | Envio indexer | Fetch V2/V3 deposits, withdrawals, and transfers with paged or experimental all-at-once modes |
| `settledHoldingsContext.ts` | Local orchestration | Build reusable settled event, timeline, metadata, raw PnL, and PPS contexts |
| `vaults.ts` | Kong | Fetch global vault metadata, staking-to-family mappings, hidden flags, and snapshot fallback metadata |
| `kong.ts` | Kong | Fetch historical PPS timelines with request dedupe and retries |
| `defillama.ts` | yearn-prices / DefiLlama | Switchable historical price client with request batching and retries |
| `nestedVaultPrices.ts` | Local | Expand and derive nested vault asset pricing where a vault asset is another Yearn vault |
| `aggregator.ts` | Local | Holdings history, ETH-denominated history, and breakdown calculations |
| `activity.ts` | Local | Recent user activity classification: deposit, withdraw, stake, unstake |
| `pnlEvents.ts` | Local | Shared raw event records for protocol-return history |
| `pnlSimple.ts` | Local | Protocol-return exposure history without FIFO cost-basis accounting |
| `cache.ts` | PostgreSQL | Daily totals, rate limits, and lazy vault invalidation |

## Event Semantics

The API supports Yearn V2 and V3 vaults.

| Version | Deposit event | Withdraw event | User field |
|---------|---------------|----------------|------------|
| V3 | `Deposit` | `Withdraw` | `owner` |
| V2 | `V2Deposit` | `V2Withdraw` | `recipient` |

Transfers are also indexed to account for share movement not represented by direct deposits or withdrawals.

- Transfers in: user received vault shares.
- Transfers out: user sent vault shares.
- Mint transfers are excluded when deposit events already cover the vault.
- Burn transfers are excluded when withdraw events already cover the vault.
- Transfer-only vaults keep mint/burn transfers because there may be no indexed deposit/withdraw events.
- Staking vaults are mapped to the underlying family vault through Kong metadata and local staking mappings.
- Vaults marked `isHidden=true` in authoritative Kong metadata are excluded from holdings totals, breakdown rows, activity rows, and protocol-return history.

## Price Provider

`defillama.ts` is intentionally still named for compatibility, but it now selects between yearn-prices and DefiLlama.

Provider selection:

- `HOLDINGS_PRICE_PROVIDER=auto`: use yearn-prices when `YEARN_PRICES_API_KEY` or `API_KEY_PORTFOLIO` is present; otherwise use DefiLlama.
- `HOLDINGS_PRICE_PROVIDER=yearn-prices`: require yearn-prices credentials and fail fast if missing.
- `HOLDINGS_PRICE_PROVIDER=defillama`: force DefiLlama.

yearn-prices behavior:

- Base URL defaults to `https://prices.yearn.dev`.
- API key is sent as `Authorization: Bearer <key>`.
- `YEARN_PRICES_API_KEY` has priority; `API_KEY_PORTFOLIO` is the fallback.
- Timestamps are normalized to UTC day end before the API request.
- Contiguous daily histories up to `366` days use `/api/prices/rangeHistorical`.
- Sparse or single-day lookups use `/api/prices/batchHistorical`.
- Returned UTC day-end prices are materialized back onto the originally requested timestamps for the response map.
- Prices are not read from or written to the local database.

DefiLlama behavior:

- Free route: `https://coins.llama.fi/batchHistorical?coins=...`.
- Pro route is used when `DEFILLAMA_API_KEY` is set: `https://pro-api.llama.fi/{key}/coins/batchHistorical?coins=...`.
- Strict timestamp mode only accepts exact or near-exact prior prices; UTC-day mode accepts prices within the day window.
- Prices and misses are not read from or written to the local database.

## Endpoints

All public holdings routes support CORS, `GET`, and `OPTIONS`. When database caching is enabled, they rate-limit by forwarded IP, falling back to a simple header fingerprint.

### `GET /api/holdings/history`

Daily holdings chart.

Examples:

```bash
curl "http://localhost:3001/api/holdings/history?address=0x..."
curl "http://localhost:3001/api/holdings/history?address=0x...&denomination=eth&timeframe=all"
curl "http://localhost:3001/api/holdings/history?address=0x...&vaults=1:0x...,1:0x..."
```

Query params:

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `address` | Yes | - | User EVM address |
| `version` | No | `all` | `v2`, `v3`, or `all` |
| `denomination` | No | `usd` | `usd` or `eth` |
| `timeframe` | No | `1y` | `1y` or `all` |
| `vault` + `chainId` | No | - | Single family vault filter |
| `vaults` | No | - | Comma-separated multi-vault filter, e.g. `1:0xvault,8453:0xvault` |
| `fetchType` | No | `seq` | `seq` or `parallel` |
| `paginationMode` | No | `paged` | `paged` or `all` |
| `refresh` | Local only | `false` | `true` or `1` clears the user's cached totals before computing |
| `debug`, `debugLots`, `debugVault`, `debugTx` | Local only | - | Debug logging controls in `api/server.ts` |

Response:

```json
{
  "address": "0x...",
  "version": "all",
  "denomination": "usd",
  "timeframe": "1y",
  "dataPoints": [
    { "date": "2026-05-05", "value": 1000.5 },
    { "date": "2026-05-06", "value": 1005.25 }
  ]
}
```

Returns `404` when the wallet has no non-zero history points for the request.

### `GET /api/holdings/breakdown`

Per-vault valuation for a settled UTC date. Without `date`, it uses the latest settled holdings-history day.

Examples:

```bash
curl "http://localhost:3001/api/holdings/breakdown?address=0x..."
curl "http://localhost:3001/api/holdings/breakdown?address=0x...&date=2026-05-06"
```

Query params:

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `address` | Yes | - | User EVM address |
| `date` | No | latest settled UTC day | UTC date in `YYYY-MM-DD` format |
| `version` | No | `all` | `v2`, `v3`, or `all` |
| `fetchType` | No | `seq` | `seq` or `parallel` |
| `paginationMode` | No | `paged` | `paged` or `all` |
| `debug`, `debugLots`, `debugVault`, `debugTx` | Local only | - | Debug logging controls in `api/server.ts` |

Response is intentionally verbose because it is used to explain the latest chart point:

```json
{
  "address": "0x...",
  "version": "all",
  "date": "2026-05-06",
  "timestamp": 1778111999,
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

### `GET /api/holdings/activity`

Recent classified vault activity.

```bash
curl "http://localhost:3001/api/holdings/activity?address=0x..."
curl "http://localhost:3001/api/holdings/activity?address=0x...&limit=20&offset=20"
```

Query params:

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `address` | Yes | - | User EVM address |
| `version` | No | `all` | `v2`, `v3`, or `all` |
| `limit` | No | `10` | Integer clamped to `1..50` |
| `offset` | No | `0` | Non-negative integer |

Response:

```json
{
  "address": "0x...",
  "version": "all",
  "limit": 10,
  "offset": 0,
  "pageInfo": {
    "hasMore": true,
    "nextOffset": 10
  },
  "entries": [
    {
      "chainId": 1,
      "txHash": "0x...",
      "timestamp": 1778111999,
      "action": "deposit",
      "vaultAddress": "0x...",
      "familyVaultAddress": "0x...",
      "assetSymbol": "USDC",
      "assetAmount": "1000000",
      "assetAmountFormatted": 1,
      "shareAmount": "1000000",
      "shareAmountFormatted": 1,
      "status": "ok"
    }
  ]
}
```

Activity classification merges address-scoped events with transaction-scoped context, so router-mediated staking, unstaking, deposit, and withdraw flows can be represented as user actions.

### `GET /api/holdings/protocol-return/history`

Protocol-return history for a user's vault exposure. This is not a cost-basis PnL engine. It measures how much Yearn changed the user's withdrawable underlying amount while the user held vault shares. Receipt-time token prices weight different assets into one portfolio percentage.

The compatibility alias `/api/holdings/pnl/simple-history` routes to the same handler.

Examples:

```bash
curl "http://localhost:3001/api/holdings/protocol-return/history?address=0x..."
curl "http://localhost:3001/api/holdings/protocol-return/history?address=0x...&timeframe=all"
curl "http://localhost:3001/api/holdings/protocol-return/history?address=0x...&vaults=1:0x...,1:0x..."
```

Query params:

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `address` | Yes | - | User EVM address |
| `version` | No | `all` | `v2`, `v3`, or `all` |
| `timeframe` | No | `1y` | `1y` or `all` |
| `vault` + `chainId` | No | - | Single family vault filter |
| `vaults` | No | - | Comma-separated multi-vault filter |
| `fetchType` | No | `seq` | `seq` or `parallel` |
| `paginationMode` | No | `paged` | `paged` or `all` |
| `debug`, `debugLots`, `debugVault`, `debugTx` | Local only | - | Debug logging controls in `api/server.ts` |

Metric model:

```text
baselineUnderlying = shares received * PPS at receipt
growthUnderlying = withdrawable underlying now-or-at-exit - baselineUnderlying
baselineWeightUsd = baselineUnderlying * receiptTokenPriceUsd
growthWeightUsd = growthUnderlying * receiptTokenPriceUsd
protocolReturnPct = growthWeightUsd / baselineWeightUsd * 100
```

Because numerator and denominator use the same receipt-time token price, later asset price movement does not affect `protocolReturnPct`.

Response:

```json
{
  "address": "0x...",
  "version": "all",
  "timeframe": "1y",
  "generatedAt": "2026-05-07T00:00:00.000Z",
  "summary": {
    "totalVaults": 5,
    "completeVaults": 5,
    "partialVaults": 0,
    "recommendedGrowthDisplay": "index",
    "recommendedGrowthDisplayReason": "mixed",
    "openBaselineCompositionUsd": {
      "stable": 100,
      "ethFamily": 50,
      "other": 0
    },
    "isComplete": true
  },
  "dataPoints": [
    {
      "date": "2026-05-06",
      "timestamp": 1778111999,
      "growthWeightUsd": 100,
      "growthWeightEth": null,
      "protocolReturnPct": 10,
      "annualizedProtocolReturnPct": 12,
      "growthIndex": 110
    }
  ],
  "familySeries": []
}
```

When a vault filter is present, each history point can also include `currentUnderlying`, `growthUnderlying`, `sharesFormatted`, and `pricePerShare`.

### `POST /api/admin/invalidate-cache`

Marks vaults as invalidated so affected user daily totals are lazily cleared and recomputed on the next cached history request. Requires `x-admin-secret: $ADMIN_SECRET` and DB caching.

```bash
curl -X POST \
  -H "content-type: application/json" \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -d '{"vaults":[{"address":"0x...","chainId":1}]}' \
  "http://localhost:3001/api/admin/invalidate-cache"
```

Response:

```json
{
  "success": true,
  "invalidated": 1,
  "vaults": ["1:0x..."],
  "timestamp": "2026-05-07T00:00:00.000Z"
}
```

## Supported Chains

| Chain | ID | Price prefix |
|-------|----|--------------|
| Ethereum | 1 | `ethereum` |
| Optimism | 10 | `optimism` |
| Fantom | 250 | `fantom` |
| Polygon | 137 | `polygon` |
| Base | 8453 | `base` |
| Arbitrum | 42161 | `arbitrum` |
| Katana | 747474 | `katana` |

`getChainPrefix` falls back to `ethereum` for unknown chain IDs, so new chains should be added to `SUPPORTED_CHAINS` before requests are expected to value correctly.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENVIO_GRAPHQL_URL` | No | `http://localhost:8080/v1/graphql` | Envio indexer GraphQL endpoint |
| `ENVIO_PASSWORD` | No | `''` | Envio Hasura admin secret; skipped when empty or `testing` |
| `DATABASE_URL_PREVIEW` | No | `null` | Preview PostgreSQL URL, preferred over `DATABASE_URL` when set |
| `DATABASE_URL` | No | `null` | Default PostgreSQL URL; caching and rate-limit persistence are disabled when absent |
| `HOLDINGS_PRICE_PROVIDER` | No | `auto` | `auto`, `yearn-prices`, or `defillama` |
| `YEARN_PRICES_BASE_URL` | No | `https://prices.yearn.dev` | Base URL for yearn-prices; `/api/prices/...` is appended automatically |
| `YEARN_PRICES_API_URL` | No | `YEARN_PRICES_BASE_URL` fallback | Legacy alias for `YEARN_PRICES_BASE_URL` |
| `YEARN_PRICES_API_KEY` | No | `API_KEY_PORTFOLIO` fallback | Bearer token for yearn-prices |
| `API_KEY_PORTFOLIO` | No | `''` | Shared portfolio API key used as the yearn-prices fallback token |
| `DEFILLAMA_API_KEY` | No | `''` | Enables DefiLlama Pro GET route |
| `ADMIN_SECRET` | Admin only | `null` | Secret for `/api/admin/invalidate-cache` |
| `HOLDINGS_DEBUG` | Local only | `false` | Enables holdings debug logs in `api/server.ts` |

Hardcoded service bases:

- Kong: `https://kong.yearn.fi`
- DefiLlama free: `https://coins.llama.fi`
- DefiLlama pro: `https://pro-api.llama.fi`

## Event Fetching

Envio hosted GraphQL has a practical `1000`-row page limit. Holdings routes expose controls for fetching address-scoped event families:

- `fetchType=seq`: fetch each event family through sequential `limit/offset` pages.
- `fetchType=parallel`: use aggregate counts when available, then fetch pages for event families concurrently.
- `paginationMode=paged`: use normal page-by-page fetching.
- `paginationMode=all`: issue one large query per event family. This is primarily for benchmarking and experiments.

`parallel` depends on aggregate roots being available:

- `Deposit_aggregate`, `Withdraw_aggregate`
- `V2Deposit_aggregate`, `V2Withdraw_aggregate`
- `Transfer_aggregate`

If aggregates are unavailable, the code falls back to sequential pagination. For most production traffic, `fetchType=parallel&paginationMode=paged` is the preferred fast path.

## Caching

Server-side cache is optional. When `DATABASE_URL_PREVIEW` or `DATABASE_URL` is absent, the APIs still work but recompute history and refetch prices/PPS on each request.

### Cache Layers

1. PostgreSQL:
   - `holdings_totals`: daily USD totals per hashed user address, vault version, and date.
   - `rate_limits`: simple per-client request windows, cleaned opportunistically after the active window expires.
   - `vault_invalidations`: per-vault invalidation timestamps for lazy cache clearing.
   - `holdings_progress`: authoritative short-lived progress records keyed by hashed wallet identity for long history requests across Vercel function instances.
2. HTTP cache:
   - History, breakdown, and protocol-return history: `s-maxage=300, stale-while-revalidate=600`.
   - Activity: `s-maxage=60, stale-while-revalidate=300`.
3. Client TanStack Query cache:
   - Configured in frontend hooks.

### Daily Totals

The history cache stores aggregate daily totals, not per-vault breakdown rows. Cache keys use SHA-256 of the normalized user address, not the raw address.

Cache behavior:

- Unfiltered history can read/write `holdings_totals`.
- Vault-filtered history skips aggregate daily total cache because the cache is user/version scoped, not vault-filter scoped.
- Cache staleness is checked against `vault_invalidations` only after the request has enough cached daily totals to potentially serve from cache.
- If any relevant vault was invalidated after the oldest cached row was written, the user's cached totals for that version are cleared and recomputed.
- Recalculated totals are not cached when any token price batch failed, because partial price data can undercount chart totals.
- `refresh=true` or `refresh=1` in the local Bun server clears the user's cached totals before recomputing.

### Token Prices

Token prices are fetched from the selected provider for each request. The holdings DB does not cache positive token prices or price misses.

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS holdings_totals (
  user_address_hash VARCHAR(64) NOT NULL,
  version VARCHAR(8) NOT NULL DEFAULT 'all',
  date DATE NOT NULL,
  usd_value NUMERIC NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_address_hash, version, date)
);

CREATE TABLE IF NOT EXISTS rate_limits (
  ip VARCHAR(45) PRIMARY KEY,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vault_invalidations (
  vault_address VARCHAR(42) NOT NULL,
  chain_id INTEGER NOT NULL,
  invalidated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (vault_address, chain_id)
);

CREATE TABLE IF NOT EXISTS holdings_progress (
  id VARCHAR(160) PRIMARY KEY,
  route VARCHAR(64) NOT NULL,
  address_hash VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL,
  progress INTEGER NOT NULL,
  message TEXT NOT NULL,
  detail TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  logs JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_vault_invalidations_time ON vault_invalidations(invalidated_at);
CREATE INDEX IF NOT EXISTS idx_holdings_progress_updated_at ON holdings_progress(updated_at);
```

Legacy `holdings_totals.user_address` rows are migrated to `user_address_hash`, and the primary key is migrated to `(user_address_hash, version, date)`.

## Operational Notes

- Enable DB caching in shared environments; otherwise a history request must rebuild events, PPS, and prices every time.
- Keep `API_KEY_PORTFOLIO` or `YEARN_PRICES_API_KEY` configured if `HOLDINGS_PRICE_PROVIDER=auto` should prefer yearn-prices.
- Use `/api/admin/invalidate-cache` after indexer deployments add or repair vault coverage.
- Stale rate-limit rows are cleaned opportunistically when holdings rate checks run.
- Short-lived progress rows are cleaned opportunistically when progress-enabled holdings requests run; if DB progress is unavailable, clients show a neutral loading placeholder instead of estimated progress.
- `timeframe=all` grows over time from `2024-01-01`, so cache row counts are no longer fixed at `365` per user/version.
