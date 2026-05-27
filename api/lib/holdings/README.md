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
  ├─ GET /api/holdings/activity-facets
  ├─ GET /api/holdings/protocol-return/history
  └─ GET /api/holdings/pnl/simple-history
      │
      ▼
Holdings services
  │
  ├─ Envio GraphQL: deposits, withdrawals, transfers
  ├─ Kong: vault metadata and historical PPS
  ├─ yearn-prices or DefiLlama: historical token prices
  ├─ Upstash Redis: optional server-side cache, progress, invalidations
  └─ Vercel Firewall: public route rate limits
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
| `activity.ts` | Local | Recent user activity classification: deposit, withdraw, stake, unstake, transfer, swap |
| `activityReceiptEnrichment.ts` | Chain RPC | Optional transaction and receipt enrichment for zaps, reward claims, and direct V2 vault actions |
| `pnlEvents.ts` | Local | Shared raw event records for protocol-return history |
| `pnlSimple.ts` | Local | Protocol-return exposure history without FIFO cost-basis accounting |
| `cache.ts` | Upstash Redis | Daily totals and lazy vault invalidation |
| `progress.ts` | Upstash Redis | Short-lived progress records and logs for long history requests |
| `ratelimit.ts` | Vercel Firewall | Programmatic per-client rate limits for public holdings routes |

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
- Contiguous daily histories use `/api/prices/rangeHistorical`, split into `183`-day range windows.
- Sparse or single-day lookups use `/api/prices/batchHistorical`.
- Returned UTC day-end prices are materialized back onto the originally requested timestamps for the response map.
- Prices are not read from or written to the local database.

DefiLlama behavior:

- Free route: `https://coins.llama.fi/batchHistorical?coins=...`.
- Pro route is used when `DEFILLAMA_API_KEY` is set: `https://pro-api.llama.fi/{key}/coins/batchHistorical?coins=...`.
- Strict timestamp mode only accepts exact or near-exact prior prices; UTC-day mode accepts prices within the day window.
- Prices and misses are not read from or written to the local database.

## Endpoints

Public holdings data routes support CORS, `GET`, and `OPTIONS`. On Vercel, history, breakdown, activity, activity facets, and protocol-return history use the Vercel Firewall Rate Limiting SDK keyed by forwarded IP, falling back to a simple header fingerprint. `/api/holdings/progress` is read-only progress polling and does not run the rate limiter.

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
| `progressId` | No | - | Stable progress ID clients can poll through `/api/holdings/progress` |
| `debug` | No | - | Enables the route debug context |
| `refresh` | Local only | `false` | `true` or `1` clears the user's cached totals before computing |
| `debugLots`, `debugVault`, `debugTx` | Local only | - | Extra debug filters in `api/server.ts` |

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

Returns `404` when the wallet has no indexed holdings activity for the request.

### `GET /api/holdings/progress`

Reads Redis-backed progress for long-running holdings routes. `history` and `protocol-return/history` can write progress when the caller passes a valid `progressId`.

Example:

```bash
curl "http://localhost:3001/api/holdings/progress?id=portfolio:0x..."
```

Query params:

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `id` | Yes | - | Progress ID previously passed to a progress-enabled holdings route |

Response:

```json
{
  "id": "portfolio:0x...",
  "route": "history",
  "addressHash": "sha256...",
  "status": "running",
  "progress": 45,
  "message": "Fetching historical prices",
  "detail": null,
  "startedAt": 1778111999000,
  "updatedAt": 1778112005000,
  "logs": []
}
```

Progress records expire after 10 minutes. The route returns `204` when the ID is invalid, expired, missing, or Redis progress is unavailable, and it always sends `Cache-Control: no-store`.

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
curl "http://localhost:3001/api/holdings/activity?address=0x...&type=withdraw&chainId=1&includeFacets=1"
```

Query params:

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `address` | Yes | - | User EVM address |
| `version` | No | `all` | `v2`, `v3`, or `all` |
| `limit` | No | `10` | Integer clamped to `1..50` |
| `offset` | No | `0` | Non-negative integer |
| `type` | No | `all` | `deposit`, `withdraw`, `stake`, `unstake`, `transfer`, `swap`, or `all` |
| `chainId` | No | - | Positive integer chain filter |
| `startTimestamp` | No | - | Inclusive Unix timestamp lower bound |
| `endTimestamp` | No | - | Inclusive Unix timestamp upper bound |
| `includeFacets` | No | `false` | `true` or `1` includes `facets.chainIds` for the returned page |

Response (`facets` appears only when `includeFacets=true` or `includeFacets=1`):

```json
{
  "address": "0x...",
  "version": "all",
  "limit": 10,
  "offset": 0,
  "facets": {
    "chainIds": [1, 8453]
  },
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
      "displayType": "zap",
      "transferDirection": "in",
      "vaultAddress": "0x...",
      "familyVaultAddress": "0x...",
      "assetSymbol": "USDC",
      "assetAmount": "1000000",
      "assetAmountFormatted": 1,
      "inputTokenAddress": "0x...",
      "inputTokenSymbol": "USDC",
      "inputTokenAmount": "1000000",
      "inputTokenAmountFormatted": 1,
      "outputTokenAddress": "0x...",
      "outputTokenSymbol": "yvUSDC",
      "outputTokenAmount": "1000000",
      "outputTokenAmountFormatted": 1,
      "shareAmount": "1000000",
      "shareAmountFormatted": 1,
      "status": "ok"
    }
  ]
}
```

Activity classification merges address-scoped events with transaction-scoped context, so router-mediated staking, unstaking, deposit, withdraw, transfer, and swap flows can be represented as user actions. Configure `VITE_RPC_URI_FOR_<chainId>` for richer receipt enrichment of zaps, reward claims, and direct V2 vault actions; without it the API still returns indexed activity rows, but some enriched input/output fields may be absent.

### `GET /api/holdings/activity-facets`

Returns activity chain facets without fetching the full paginated activity response. This is useful for building chain filter controls before the user requests activity rows.

```bash
curl "http://localhost:3001/api/holdings/activity-facets?address=0x..."
curl "http://localhost:3001/api/holdings/activity-facets?address=0x...&limitPerSource=500&offsetPerSource=500"
```

Query params:

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `address` | Yes | - | User EVM address |
| `version` | No | `all` | `v2`, `v3`, or `all` |
| `limitPerSource` | No | `250` | Per-event-source page size, clamped to `1..1000` |
| `offsetPerSource` | No | `0` | Per-event-source non-negative offset |

Response:

```json
{
  "address": "0x...",
  "version": "all",
  "facets": {
    "chainIds": [1, 8453]
  },
  "pageInfo": {
    "hasMore": false,
    "nextOffsetPerSource": null
  }
}
```

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
| `progressId` | No | - | Stable progress ID clients can poll through `/api/holdings/progress` |
| `debug` | No | - | Enables the route debug context |
| `debugLots`, `debugVault`, `debugTx` | Local only | - | Extra debug filters in `api/server.ts` |

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

### Manual Vault Invalidation

Mark vaults as invalidated by writing Redis keys directly in Upstash. Affected user daily totals are lazily cleared and recomputed on the next cached history request that includes the invalidated vault.

Key format:

```text
holdings:vault-invalidated:<chainId>:<lowercaseVaultAddress>
```

Value format:

```text
<current epoch milliseconds>
```

Example:

```text
key: holdings:vault-invalidated:1:0xbe53a109b494e5c9f97b9cd39fe969be68bf6204
value: 1779564000000
ttl: none
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

Unknown chain IDs fail historical price resolution instead of falling back to Ethereum. Add new chains to `SUPPORTED_CHAINS` before requests are expected to value correctly.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENVIO_GRAPHQL_URL` | No | `http://localhost:8080/v1/graphql` | Envio indexer GraphQL endpoint |
| `ENVIO_PASSWORD` | No | `''` | Envio Hasura admin secret; skipped when empty or `testing` |
| `VERCEL_HOLDINGS_RATE_LIMIT_ID` | No | `holdings-public-api` | Vercel Firewall rate limit ID for public holdings routes |
| `UPSTASH_REDIS_REST_URL_PORTFOLIO` | No | `null` | Upstash Redis REST URL for holdings cache, progress, and invalidations |
| `UPSTASH_REDIS_REST_TOKEN_PORTFOLIO` | No | `null` | Upstash Redis REST token for holdings storage |
| `VITE_RPC_URI_FOR_<id>` | No | `null` | Optional chain RPC URL for activity receipt and transaction enrichment |
| `HOLDINGS_PRICE_PROVIDER` | No | `auto` | `auto`, `yearn-prices`, or `defillama` |
| `YEARN_PRICES_BASE_URL` | No | `https://prices.yearn.dev` | Base URL for yearn-prices; `/api/prices/...` is appended automatically |
| `YEARN_PRICES_API_URL` | No | `YEARN_PRICES_BASE_URL` fallback | Legacy alias for `YEARN_PRICES_BASE_URL` |
| `YEARN_PRICES_API_KEY` | No | `API_KEY_PORTFOLIO` fallback | Bearer token for yearn-prices |
| `API_KEY_PORTFOLIO` | No | `''` | Shared portfolio API key used as the yearn-prices fallback token |
| `DEFILLAMA_API_KEY` | No | `''` | Enables DefiLlama Pro GET route |
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

Server-side cache is optional. When `UPSTASH_REDIS_REST_URL_PORTFOLIO` or `UPSTASH_REDIS_REST_TOKEN_PORTFOLIO` is absent, the APIs still work but recompute history and refetch prices/PPS on each request.

### Cache Layers

1. Upstash Redis:
   - `holdings:totals:<addressHash>:<version>`: daily USD totals per hashed user address, vault version, and date. Hash fields are `YYYY-MM-DD`; values include `usdValue` and `updatedAt`.
   - `holdings:vault-invalidated:<chainId>:<vaultAddress>`: per-vault invalidation timestamps for lazy cache clearing.
   - `holdings:progress:<progressId>`: authoritative short-lived progress records keyed by caller-supplied progress ID for long history requests across Vercel function instances.
2. Vercel Firewall:
   - `VERCEL_HOLDINGS_RATE_LIMIT_ID` identifies the dashboard Firewall rule used by `@vercel/firewall`.
   - The default rule ID is `holdings-public-api`.
   - Configure the dashboard rule with the desired window and request count, currently intended to match the old `10` requests per minute limit.
3. HTTP cache:
   - Cacheable API responses put shared-cache policy in `Vercel-CDN-Cache-Control` and keep browser-facing `Cache-Control` at `public, max-age=0, must-revalidate`.
   - History, breakdown, and protocol-return history CDN cache: `s-maxage=300, stale-while-revalidate=600`.
   - Activity CDN cache: `s-maxage=60, stale-while-revalidate=300`.
   - Activity facets CDN cache: `s-maxage=300, stale-while-revalidate=900`.
   - Progress: `Cache-Control: no-store`.
4. Client TanStack Query cache:
   - Portfolio history and protocol-return history hooks keep chart responses fresh for one hour.
   - Other frontend hooks configure their own durations.

### Daily Totals

The history cache stores aggregate daily totals, not per-vault breakdown rows. Cache keys use SHA-256 of the normalized user address, not the raw address.

Cache behavior:

- Unfiltered history can read/write `holdings:totals:<addressHash>:<version>`.
- Vault-filtered history skips aggregate daily total cache because the cache is user/version scoped, not vault-filter scoped.
- Cache staleness is checked against `holdings:vault-invalidated:<chainId>:<vaultAddress>` only after the request has enough cached daily totals to potentially serve from cache.
- If any relevant vault was invalidated after the oldest cached row was written, the user's cached totals for that version are cleared and recomputed.
- Recalculated totals are not cached when any token price batch failed, because partial price data can undercount chart totals.
- `refresh=true` or `refresh=1` in the local Bun server clears the user's cached totals before recomputing.

### Progress and Rate Limits

- Progress writes only when Redis persistence is enabled and the supplied `progressId` matches `[a-zA-Z0-9:_-]{1,160}`.
- Progress status is `running`, `complete`, or `error`; progress is clamped to `0..100`, logs are capped to the latest `20` entries, and rows expire after `10 minutes`.
- Vercel Firewall rate limiting only runs when `VERCEL=1`. Local development allows requests without calling the Firewall SDK.
- Configure a Vercel Firewall rule with condition `@vercel/firewall` and the rate limit ID from `VERCEL_HOLDINGS_RATE_LIMIT_ID` or the default `holdings-public-api`.
- The intended production limit is `10` requests per minute per client identifier. If the Firewall SDK check fails, the rate limiter allows the request and logs the failure.

### Token Prices

Token prices are fetched from the selected provider for each request. Holdings Redis storage does not cache positive token prices or price misses.

## Redis Keys

No schema migration is required. Redis keys are created lazily:

| Key | Type | TTL | Purpose |
|-----|------|-----|---------|
| `holdings:totals:<addressHash>:<version>` | Hash | 30 days from write | Daily holdings chart totals. |
| `holdings:vault-invalidated:<chainId>:<vaultAddress>` | String timestamp | None | Lazy invalidation marker for totals cache. |
| `holdings:progress:<progressId>` | String JSON record | 10 minutes | Progress polling state for long requests. |

## Operational Notes

- Enable Redis storage in shared environments; otherwise a history request must rebuild events, PPS, and prices every time.
- Keep `API_KEY_PORTFOLIO` or `YEARN_PRICES_API_KEY` configured if `HOLDINGS_PRICE_PROVIDER=auto` should prefer yearn-prices.
- Configure `VITE_RPC_URI_FOR_<chainId>` for chains where activity rows should include richer zap, reward-claim, and direct V2 vault enrichment.
- Pass a stable `progressId` from the frontend for long history and protocol-return requests, then poll `/api/holdings/progress?id=...`; progress rows are Redis-backed and expire quickly.
- Write `holdings:vault-invalidated:<chainId>:<vaultAddress>` markers in Upstash after indexer deployments add or repair vault coverage.
- Rate-limit and progress cleanup is handled by Redis TTLs.
- If Redis progress is unavailable, clients show a neutral loading placeholder instead of estimated progress.
- `timeframe=all` grows over time from `2024-01-01`, so cache row counts are no longer fixed at `365` per user/version.
