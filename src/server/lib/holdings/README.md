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
  └─ Upstash Redis: optional server-side cache, progress, invalidations
```

Next exposes the holdings endpoints through explicit files under `app/api/holdings/**/route.ts`; implementation modules live under `src/server/holdings/**`.

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

Public holdings data routes support CORS, `GET`, and `OPTIONS`. Request rate limiting is handled by Vercel Firewall project configuration before requests reach the Next.js route handlers.

### `GET /api/holdings/history`

Daily holdings chart.

Examples:

```bash
curl "http://localhost:3000/api/holdings/history?address=0x..."
curl "http://localhost:3000/api/holdings/history?address=0x...&denomination=eth&timeframe=all"
curl "http://localhost:3000/api/holdings/history?address=0x...&vaults=1:0x...,1:0x..."
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
curl "http://localhost:3000/api/holdings/progress?id=portfolio:0x..."
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

Progress records expire after 10 minutes. The route returns `404` when the ID is invalid, expired, missing, or Redis progress is unavailable, and it always sends `Cache-Control: no-store`.

### `GET /api/holdings/breakdown`

Per-vault valuation for a settled UTC date. Without `date`, it uses the latest settled holdings-history day.

Examples:

```bash
curl "http://localhost:3000/api/holdings/breakdown?address=0x..."
curl "http://localhost:3000/api/holdings/breakdown?address=0x...&date=2026-05-06"
```

Query params:

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `address` | Yes | - | User EVM address |
| `date` | No | latest settled UTC day | UTC date in `YYYY-MM-DD` format |
| `version` | No | `all` | `v2`, `v3`, or `all` |
| `fetchType` | No | `seq` | `seq` or `parallel` |
| `paginationMode` | No | `paged` | `paged` or `all` |
| `debug` | No | - | Enables the route debug context |

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
curl "http://localhost:3000/api/holdings/activity?address=0x..."
curl "http://localhost:3000/api/holdings/activity?address=0x...&limit=20&offset=20"
curl "http://localhost:3000/api/holdings/activity?address=0x...&type=withdraw&chainId=1&includeFacets=1"
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

Activity classification merges address-scoped events with transaction-scoped context, so router-mediated staking, unstaking, deposit, withdraw, transfer, and swap flows can be represented as user actions. Configure `RPC_URI_FOR_<chainId>` for richer server-side receipt enrichment of zaps, reward claims, and direct V2 vault actions; without it the API falls back to `NEXT_PUBLIC_RPC_URI_FOR_<chainId>`. If neither is configured, the API still returns indexed activity rows, but some enriched input/output fields may be absent.

### `GET /api/holdings/activity-facets`

Returns activity chain facets without fetching the full paginated activity response. This is useful for building chain filter controls before the user requests activity rows.

```bash
curl "http://localhost:3000/api/holdings/activity-facets?address=0x..."
```

Query params:

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `address` | Yes | - | User EVM address |
| `version` | No | `all` | `v2`, `v3`, or `all` |

Response:

```json
{
  "address": "0x...",
  "version": "all",
  "facets": {
    "chainIds": [1, 8453]
  }
}
```

### `GET /api/holdings/protocol-return/history`

Protocol-return history for a user's vault exposure. This is not a cost-basis PnL engine. It measures how much Yearn changed the user's withdrawable underlying amount while the user held vault shares. Receipt-time token prices weight different assets into one portfolio percentage.

The compatibility alias `/api/holdings/pnl/simple-history` routes to the same handler.

Examples:

```bash
curl "http://localhost:3000/api/holdings/protocol-return/history?address=0x..."
curl "http://localhost:3000/api/holdings/protocol-return/history?address=0x...&timeframe=all"
curl "http://localhost:3000/api/holdings/protocol-return/history?address=0x...&vaults=1:0x...,1:0x..."
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

Non-empty settled responses are cached in Redis for up to 24 hours and invalidated lazily when one of their vaults changes. Responses produced after a failed or empty historical-price request, failed Kong PPS request, or retryable metadata fallback failure are returned to the caller but are not cached, so a temporary upstream outage cannot preserve incomplete chart data for the rest of the day.

### `POST /api/admin/invalidate-cache`

Marks vaults as invalidated so affected user daily totals are lazily cleared and recomputed on the next cached history request. It also appends a global wallet-ledger invalidation record, allowing an existing ledger to discover events for a vault that Envio indexed retroactively. `fromBlock` is optional and defaults to `0`; supplying the earliest backfilled block reduces the targeted query range. Publish the invalidation only after the Envio backfill is visible. Redis caching is required. `x-admin-secret: $ADMIN_SECRET` is required outside loopback development.

```bash
curl -X POST \
  -H "content-type: application/json" \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -d '{"vaults":[{"address":"0x...","chainId":1,"fromBlock":12345678}]}' \
  "http://localhost:3000/api/admin/invalidate-cache"
```

Response:

```json
{
  "success": true,
  "invalidated": 1,
  "ledgerInvalidationSequence": 42,
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
| `UPSTASH_REDIS_REST_URL_PORTFOLIO_DEV` | No | `null` | Development/Preview Upstash Redis REST URL; used only with the complete DEV pair |
| `UPSTASH_REDIS_REST_TOKEN_PORTFOLIO_DEV` | No | `null` | Development/Preview Upstash Redis REST token; used only with the complete DEV pair |
| `UPSTASH_REDIS_REST_URL_PORTFOLIO` | No | `null` | Upstash Redis REST URL for holdings cache, progress, and invalidations |
| `UPSTASH_REDIS_REST_TOKEN_PORTFOLIO` | No | `null` | Upstash Redis REST token for holdings storage |
| `HOLDINGS_LEDGER_MODE` | No | `off` | Canonical event-ledger rollout mode: `off`, `shadow`, or `read-write` |
| `HOLDINGS_LEDGER_KEY_NAMESPACE` | No | `''` | Optional isolated ledger Redis namespace; accepts 1-64 ASCII letters, digits, `_`, or `-` |
| `HOLDINGS_LEDGER_CHAIN_IDS` | No | `1,10,137,250,8453,42161,747474` | Explicit Envio chain scope; changing it is a source-generation migration |
| `HOLDINGS_LEDGER_OVERLAP_BLOCKS` | No | `50000` | Inclusive per-chain rewind used by warm event synchronization |
| `HOLDINGS_LEDGER_RECONCILE_INTERVAL_SECONDS` | No | `604800` | Seconds between full event-ledger reconciliations |
| `RPC_URI_FOR_<id>` | No | `NEXT_PUBLIC_RPC_URI_FOR_<id>` | Optional server-only chain RPC URL for activity receipt and transaction enrichment |
| `HOLDINGS_PRICE_PROVIDER` | No | `auto` | `auto`, `yearn-prices`, or `defillama` |
| `YEARN_PRICES_BASE_URL` | No | `https://prices.yearn.dev` | Base URL for yearn-prices; `/api/prices/...` is appended automatically |
| `YEARN_PRICES_API_URL` | No | `YEARN_PRICES_BASE_URL` fallback | Legacy alias for `YEARN_PRICES_BASE_URL` |
| `YEARN_PRICES_API_KEY` | No | `API_KEY_PORTFOLIO` fallback | Bearer token for yearn-prices |
| `API_KEY_PORTFOLIO` | No | `''` | Shared portfolio API key used as the yearn-prices fallback token |
| `DEFILLAMA_API_KEY` | No | `''` | Enables DefiLlama Pro GET route |
| `ADMIN_SECRET` | Admin only | `null` | Secret for cache invalidation and canonical ledger requests outside loopback development |
| `HOLDINGS_DEBUG` | No | `false` | Enables holdings debug logs |

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

Server-side cache is optional. Local development, local production-mode benchmarks, and Vercel Preview require the complete `UPSTASH_REDIS_REST_URL_PORTFOLIO_DEV` / `UPSTASH_REDIS_REST_TOKEN_PORTFOLIO_DEV` pair. Vercel Production ignores the DEV pair and requires the complete production-named pair. Missing or partial credentials disable storage instead of falling back across environments or mixing credentials. Without a usable pair, the APIs still work but recompute history and refetch prices/PPS on each request.

### Canonical Ledger (Phases 1–3)

The versioned `holdings:ledger:v1:{walletHash}:...` namespace is isolated from the legacy caches. Setting `HOLDINGS_LEDGER_KEY_NAMESPACE=benchmark_01` selects the separate `holdings:ledger:v1:{walletHash}:namespace:benchmark_01:...` keyspace while preserving the wallet hash tag used by atomic Redis scripts. An unset or empty value keeps every existing key byte-for-byte unchanged. Non-empty values must contain 1-64 ASCII letters, digits, underscores, or hyphens; invalid values fail closed when a ledger key is constructed. Changing the namespace selects an independent ledger and does not migrate or delete keys in another namespace.

`HOLDINGS_LEDGER_MODE` defaults to `off`, so Phase 1 does not change the existing portfolio data path unless a rollout mode is explicitly selected. `shadow` permits parity population while legacy results remain authoritative; `read-write` is reserved for enabling validated ledger reads during a later rollout.

Phase 1 has these operational constraints:

- Immutable ledger chunks and index shards intentionally have no TTL. A future reference-aware garbage collector must be available before they can expire; an active manifest must never reference expiring data.
- Upstash Lua updates make each lock or head commit atomic, but cross-worker reads and lock observations are not treated as fully linearizable. A future ledger reader must validate the head, manifest, referenced chunks and indexes, and checksums as one complete revision.
- Mixed reused/new revisions must pass the manifest-bound `decodeLedgerRevision` verifier before head CAS. The verifier requires the exact blob set, reconstructs the identity index from decoded chunks, and binds every six-stream coverage count, checksum, cursor, and chain scope to the canonical records.
- When a revision is missing, corrupt, or temporarily inconsistent, a reader must retry before falling back to the previous head and then the legacy source path. It must not expose a partial revision as complete.
- Rollback is configuration-only: set `HOLDINGS_LEDGER_MODE=off`. Ledger keys can remain in Redis and do not need to be deleted.

The Phase 1 codec was measured against the sanitized Wallet 1 fixture captured as 25 sequential Envio pages. The fixture contains 20,070 logical source records and 9,063,846 bytes of GraphQL responses. The lossless canonical representation round-tripped every record with this active footprint:

| Component | Count | Encoded bytes |
| --- | ---: | ---: |
| Family/chain/month chunks | 100 | 2,577,544 |
| Identity-to-chunk index shards | 64 | 387,996 |
| Revision manifest | 1 | 124,493 |
| **Complete active revision** |  | **3,090,033** |

The largest chunk was 128,600 bytes, and the complete decoded footprint was 14,599,075 bytes. The result stays below the 256 KiB encoded/4 MiB decoded per-blob, 256 KiB manifest, and 4 MiB encoded/32 MiB decoded active-revision guards. A later live benchmark wallet with 19,931 records required a 136,514-byte unnamespaced manifest because its 100 chunk refs, 64 index refs, and 280 dependencies exceeded the original 128 KiB guard; a maximum-length isolated namespace raises that manifest to 148,814 bytes. The manifest guard is therefore 256 KiB while the aggregate active-revision limits remain unchanged. The identity index intentionally maps a stable identity to its immutable chunk; correction comparison and old ordering are recovered by reading that chunk instead of duplicating a per-record checksum and order in the index. Cold blob publication must use the batched writer so the 164 immutable blobs are sent in one `SET NX` pipeline, plus at most one `GET` pipeline to verify already-present keys, rather than as serial REST requests. This is a storage and local-codec gate only; production shadow traffic must still establish end-to-end Redis latency and parity before ledger reads can be enabled.

Phase 2 adds two isolated portfolio API routes. They are admin-only outside loopback development, return `Cache-Control: private, no-store`, and do not replace the legacy portfolio fetch path:

- `POST /api/holdings/ledger/sync` accepts exactly `{ "address": "0x...", "forceRebuild"?: boolean, "compareLegacy"?: boolean }`. It bootstraps or incrementally refreshes the six raw Envio streams, verifies the complete immutable revision, then atomically advances the wallet head. Lock contention returns `202` with `Retry-After: 2`.
- `GET /api/holdings/ledger/status?address=0x...` fully verifies the active revision and returns only aggregate storage, coverage, dirty-range, and worker status fields. If the active revision is incomplete or corrupt, the read can report a verified previous-head fallback without exposing chunks, events, cursors, checksums, source URLs, or wallet hashes. `sync.matchesHead` explicitly reports whether the stored worker status describes the verified head being summarized.

Successful status responses also expose `X-Holdings-Ledger-Runtime-Fingerprint`, a one-way fingerprint of the effective Redis credentials, optional key namespace, and ledger/source configuration. Local destructive benchmark tooling uses it as a preflight guard so an API server cannot write one ledger scope while its cleanup process targets another; raw credentials and configuration values are never returned.

Ledger synchronization does not depend on aggregate query roots. Every refresh issues one bounded six-alias first-page query per configured chain concurrently, so the deposit, withdrawal, and directional transfer streams share a network round trip. Only aliases returning the full 1,000-row page continue with the strict `(blockTimestamp, blockNumber, logIndex, id)` keyset cursor, and each stream stops on its first short page. Bootstrap, reconciliation, and reset flows skip the separate presence-probe phase and start those authoritative data pages immediately. A full cold inbound-transfer page fans out into disjoint block windows, while warm refreshes retain strict continuation paging. Every configured stream/chain window remains authoritative even when its first page is empty, allowing the merge to remove corrected or deleted cached events instead of preserving stale history. The sync response and debug logs distinguish logical pages from physical GraphQL requests through `strategy`, `requests`, `presenceRequests`, `batchedRequests`, `continuationRequests`, and cold block-partition counters.

Phase 3 adds an isolated snapshot reader and ledger-first portfolio consumers without removing the existing public holdings routes:

- `POST /api/holdings/ledger/snapshot` accepts exactly `{ "address": "0x...", "refresh"?: boolean, "forceRebuild"?: boolean, "compareLegacy"?: boolean }`. `refresh` defaults to `true`, requires every configured Envio chain to report ready, synchronizes once, and then returns a server-issued snapshot ID pinned to that exact in-memory verified revision before releasing the wallet lock; it does not reread or decode the same head, manifest, chunks, and indexes. `refresh: false` explicitly returns `freshness: "last-known-good"`, performs the independent verified Redis read with previous-head fallback, and does not contact the full-wallet Envio source.
- `GET /api/holdings/ledger/history?address=0x...&snapshotId=snapshot_...` returns the existing balance-history response shape from the pinned ledger.
- `GET /api/holdings/ledger/breakdown?address=0x...&snapshotId=snapshot_...` returns the existing dated breakdown response shape from the same pinned ledger.
- `GET /api/holdings/ledger/protocol-return/history?address=0x...&snapshotId=snapshot_...` performs an address-only protocol-return replay from the same pinned ledger.
- `GET /api/holdings/ledger/portfolio-history?address=0x...&snapshotId=snapshot_...` returns balance and protocol-return chart histories together from one verified event revision.
- `GET /api/holdings/ledger/growth?address=0x...&snapshotId=snapshot_...` returns the current per-vault underlying growth amount, cumulative percentage, capital-time exposure, and simple annualized return without fetching token-price histories or building daily chart points.

All six Phase 3 routes are private/no-store and coexist with the legacy APIs. Development requests whose URL host is `localhost`, `127.0.0.1`, or `::1` do not require `x-admin-secret`; every non-loopback or non-development request remains admin-protected. Snapshot IDs expire 30 minutes after synchronization and verification complete. Reads verify the exact pinned head, immutable manifest, chunks, indexes, calculation version, and complete supported-chain scope. Missing, expired, corrupt, or incompatible snapshots fail closed; a route never fills missing ledger data from legacy Envio. Ledger reads bypass the revisionless daily-total and protocol-response caches. The five derived responses expose `X-Holdings-Ledger-Snapshot`, `X-Holdings-Ledger-Revision`, `X-Holdings-Ledger-Source-Generation`, and `X-Holdings-Ledger-Calculation-Version` headers so callers can assert that independently requested results used the same wallet-event revision and calculation contract. Version `canonical-envio-ledger-v3` makes event-asset protocol-return valuation part of the calculation contract and forces older heads through a full rebuild on their next synchronization. Last-known-good cutoffs are capped by the verified head's update time, and dated breakdowns after the pinned settled day are rejected.

Ledger protocol-return calculations use only the configured address-scoped wallet event streams from the pinned snapshot and do not perform live transaction-hash companion-event enrichment. Ordinary deposits and withdrawals use their emitted `assets` and `shares`, so their underlying-denominated basis and proceeds require neither historical token prices nor historical PPS. Genuine share transfers have no `assets` field, and staking-wrapper events describe wrapper assets rather than final underlying; those exceptional events require a PPS sample at the event time.

The ledger growth routes resolve only those exceptional PPS requirements and keep the fetched Kong timelines in request memory; historical PPS samples are never persisted to Redis. The response retains `historicalPpsCacheHits` for compatibility, but it is always `0`. They read current PPS from Kong vault metadata. If current PPS is absent from metadata, they fetch the full PPS timeline only for the affected open vault. A missing requirement remains visible as `missing_pps`; it is never replaced with current PPS. Kong's historical feed is daily, so transfer valuation uses the latest daily sample at or before the event rather than a block-exact archive-RPC value. Per-vault `annualizedProtocolReturnPct` is a simple capital-time-weighted annualized return: `growthUnderlying / baselineExposureUnderlyingYears * 100`. It needs no additional upstream data and is `null` for incomplete rows or zero elapsed exposure. The chart routes still use live Kong PPS and price providers, so revision headers identify the immutable wallet-event input and calculation contract rather than every external derived-data response.

The snapshot routes and their immutable multi-key ledger remain available for isolated testing and fallback work, but they are no longer the portfolio client's primary request path. Vault rows still render underlying growth in a dedicated sortable column; sorting uses cumulative percentage so unlike asset units are not compared directly, while the dotted-underlined value exposes total return and simple annualized return in a tooltip. Chains outside `HOLDINGS_LEDGER_CHAIN_IDS` have no ledger growth row and remain visibly unavailable instead of receiving fabricated growth.

Warm synchronization rewinds each chain by `HOLDINGS_LEDGER_OVERLAP_BLOCKS`; a correction or deletion inside that inclusive window replaces the cached range. When those authoritative windows leave every canonical stream unchanged but advance coverage, the next revision reuses the already-verified immutable chunk and index refs, verifies the new coverage against the decoded streams, and commits only a new manifest/head with zero blob writes. Changed events, reconciliation, source changes, and forced rebuilds retain the full encode/decode/index verification path. A periodic reconciliation starts again at each configured chain start block. Coverage is advanced only through Envio's transactionally written `progressBlock`, never through wall-clock time or the upstream chain head. Source/config changes start a new source generation, and `forceRebuild` provides the explicit full-ledger rebuild path. If the active head is corrupt, a forced rebuild first restores the exact fully verified previous revision and its `syncing` status in one fenced Redis transaction. Failed and stale workers cannot replace the last-known-good manifest.

`HOLDINGS_LEDGER_SOURCE_REVISION` is a non-secret operator marker included in the hashed source fingerprint. Bump it after an in-place Envio redeploy, reindex, or repair whose URL and configured chain bounds did not change; the next sync will detect a new source generation and rebuild from the configured start blocks. It defaults to `default` and accepts 1–96 ASCII letters, digits, `.`, `_`, or `-`. Do not place credentials, source URLs, or other secrets in it.

`HOLDINGS_LEDGER_VALUATION_REVISION` is a separate non-secret marker for derived USD totals. Bump it after a historical PPS, token-price, or vault-metadata correction should invalidate cached valuations without replaying wallet events. It has the same default and validation rules as the source revision. A mismatch is a cache miss, and the next successful calculation replaces the old totals under the new revision.

### Simplified Wallet Ledger (Active Portfolio Path)

The portfolio client now uses one public, wallet-scoped request:

```text
GET /api/holdings/ledger/portfolio?address=0x...&version=all&denomination=usd&timeframe=1y
```

The route refreshes or reads one wallet ledger, creates one in-memory event source, and starts one request-scoped settled context for the wallet events, position timeline, and vault metadata. It begins loading the global Kong vault list while ledger synchronization runs. After the fetched events are merged, it also starts resolving only the vault addresses present in that wallet while encoding and Redis persistence continue; concurrent snapshot fallbacks for the same vault are coalesced, and metadata failures never block or fail ledger synchronization. Balance history, protocol-return history, and per-vault growth then calculate concurrently from that same prepared context. A request-scoped valuation loader sits behind all three calculations: concurrent PPS requests for the same vault share one Kong timeline fetch, while token/day price requests are coalesced into growth, protocol-return, and balance priority lanes. At most two PPS provider batches run at once, each with six Kong requests, bounding one loader to twelve concurrent PPS requests even when a later consumer creates another microtask batch. Small promoted overlaps remain bounded range fillers in the balance provider request so Yearn Prices can keep using contiguous range queries; a larger overlap is split into contiguous runs and a sparse remainder rather than duplicating an unbounded historical range. Each calculation receives only its requested subset. Higher-priority work normally runs independently; once the bounded duplication budget is exhausted, overlapping points reuse existing provider work instead. A total historical-price provider failure evicts its request-local entries for retry. Balance propagation remains strict, while protocol return deliberately converts provider failures into an explicitly incomplete best-effort result; the portfolio chart labels incomplete balance or return data as estimated. Partial provider results retain failure metadata. The loader retains results only until the HTTP request completes and never persists PPS or token prices. No snapshot ID is created or sent back to the client. Normal reads do not require an admin secret; `forceRebuild=1` remains admin-protected outside loopback development. Production reads require `HOLDINGS_LEDGER_MODE=read-write`, while local development can exercise the path in `shadow` mode. Responses are private and `no-store`.

Each wallet has one durable Redis value at `holdings:wallet-ledger:v3:{walletHash}`. An optional `HOLDINGS_LEDGER_KEY_NAMESPACE` appends `:namespace:<namespace>`. Its temporary `:lock` expires automatically. A non-empty durable value has no TTL; a zero-event negative-cache value expires after 24 hours so arbitrary empty-address lookups cannot consume permanent storage. The value contains one Brotli-compressed, checksummed payload with:

- the calculation version and Envio source fingerprint;
- the last global vault-invalidation sequence checked for this wallet;
- per-chain `startBlock`, optional `endBlock`, and `completeThroughBlock` coverage;
- the six canonical deposit, withdrawal, and directional transfer streams;
- creation/update/last-full-reconciliation timestamps and source generation.

`completeThroughBlock` is the important cursor. It records how far Envio was completely read on each chain even when the wallet had no event there. This prevents an inactive wallet from repeatedly scanning months with no events and distinguishes “no event occurred” from “this range has not been checked.”

Refresh behavior is intentionally small:

1. Every refresh reads the small global invalidation-log head. A value updated less than five minutes ago is returned without contacting Envio only when its applied sequence matches that head.
2. A cold wallet reads Envio metadata and starts one six-stream first-page request for every configured chain concurrently. This removes the presence-probe barrier; a full inbound-transfer page is then split into disjoint block windows for concurrent continuation.
3. A warm wallet starts each chain at `completeThroughBlock - HOLDINGS_LEDGER_OVERLAP_BLOCKS`, fetches the six first pages in batched chain requests, and replaces that overlap window authoritatively. This picks up new events plus recent corrections or deletions.
4. Pending invalidations are grouped by chain and fetched with one wallet-plus-vault batched GraphQL request per affected chain. The merge is authoritative only for those vaults, so unrelated vault rows in the same block range remain intact. Empty results still advance the wallet's applied sequence.
5. Coverage advances to the metadata block used for that fetch, including for zero-event chains. The updated payload and applied sequence replace the previous Redis value in one lock-checked atomic write.
6. If another worker owns the lock, an existing value is served as `stale`; a cold wallet receives `202` with `Retry-After: 2`. Upstream or Redis failures never overwrite the previous good value or advance its invalidation cursor.

When `HOLDINGS_LEDGER_RECONCILE_INTERVAL_SECONDS` expires, the next refresh performs a complete no-presence read from each configured chain start instead of the overlap read. An unchanged reconciliation advances only `reconciledAtMs` and preserves cached USD rows; historical event additions, corrections, or deletions remove totals from the earliest changed UTC date onward.

Corrections older than the configured overlap are intentionally outside the ordinary warm path. Publish `/api/admin/invalidate-cache` with the affected vault and earliest block for a targeted repair. Bump `HOLDINGS_LEDGER_SOURCE_REVISION` or use the protected `forceRebuild=1` request when the affected range is unknown and a full replay is required.

The client caches each exact wallet/version/denomination/timeframe response for 25 minutes and refreshes stale data on focus. If the combined request has no usable response and fails terminally, the existing legacy balance and protocol-return requests remain the fallback. A cached combined response stays visible during a failed background refresh.

The server also keeps two revision-fenced derived layers for the active combined USD route. Daily USD totals remain partitioned by UTC date. Protocol return plus growth are stored together in a Brotli-compressed `:derived-portfolio:v1:<version>:<timeframe>` value for 30 minutes, including explicitly provisional results; event revision, source generation, invalidation sequence, valuation revision, settled day, vault version, and timeframe are all part of the identity. A transient derived write is retried once before failing open. A verified `:checked` header stores the event revision, current coverage, activity/count fields, and encoded sizes. When the header is fresh and both derived layers are complete for the requested range, the route returns without downloading or decompressing the wallet event value and without contacting Envio, Kong, or the historical-price provider. Any corrupt, stale, incomplete, invalidated, or racing cache state falls back to the full revision-fenced calculation.

An unchanged warm refresh advances coverage by atomically replacing only that small checked header; it does not recompress or upload the unchanged multi-megabyte wallet value. Changed events still atomically replace the full value and invalidate only daily USD dates from the earliest changed UTC date onward. Historical PPS and token-price timelines remain request-memory only and are not Redis keys.

For local or dev shadow testing, set `HOLDINGS_LEDGER_MODE=shadow` and use placeholders rather than committing credentials:

```bash
curl -sS -X POST "$PORTFOLIO_API_BASE_URL/api/holdings/ledger/sync" \
  -H "Content-Type: application/json" \
  --data "{\"address\":\"$WALLET_ADDRESS\",\"compareLegacy\":true}"

curl -sS "$PORTFOLIO_API_BASE_URL/api/holdings/ledger/status?address=$WALLET_ADDRESS"

curl -sS -X POST "$PORTFOLIO_API_BASE_URL/api/holdings/ledger/snapshot" \
  -H "Content-Type: application/json" \
  --data "{\"address\":\"$WALLET_ADDRESS\"}"

curl -sS "$PORTFOLIO_API_BASE_URL/api/holdings/ledger/history?address=$WALLET_ADDRESS&snapshotId=$SNAPSHOT_ID"

curl -sS "$PORTFOLIO_API_BASE_URL/api/holdings/ledger/breakdown?address=$WALLET_ADDRESS&snapshotId=$SNAPSHOT_ID"

curl -sS "$PORTFOLIO_API_BASE_URL/api/holdings/ledger/protocol-return/history?address=$WALLET_ADDRESS&snapshotId=$SNAPSHOT_ID"

curl -sS "$PORTFOLIO_API_BASE_URL/api/holdings/ledger/portfolio-history?address=$WALLET_ADDRESS&snapshotId=$SNAPSHOT_ID&denomination=usd&timeframe=1y"

curl -sS "$PORTFOLIO_API_BASE_URL/api/holdings/ledger/growth?address=$WALLET_ADDRESS&snapshotId=$SNAPSHOT_ID"

curl -sS "$PORTFOLIO_API_BASE_URL/api/holdings/ledger/portfolio?address=$WALLET_ADDRESS&version=all&denomination=usd&timeframe=1y&debug=1"
```

Copy `snapshotId` from the snapshot response into `SNAPSHOT_ID` before calling the derived routes. Run the same sync a second time to exercise the overlap-only warm path. Use `forceRebuild: true` only when intentionally testing a full rebuild. `compareLegacy` performs an additional complete legacy event fetch, so it should be enabled selectively during shadow parity sampling.

Append `debug=1` to any sync, snapshot, or derived ledger route to print request-correlated timings in the local server terminal without changing the response shape. For the active path, use `/api/holdings/ledger/portfolio?...&debug=1`; logs separate the wallet read, lock, metadata, Envio requests, merge, encoding/commit, and three portfolio calculations. Logs use the existing `[HoldingsDebug][requestId][+elapsedMs][scope]` format. The wallet-ledger synchronization stages contain statuses, durations, and aggregate counts only; wallet, revision, Redis key, event, transaction, source URL, and credential values are omitted from those new stage payloads.

### Cache Layers

1. Upstash Redis:
   - `holdings:wallet-ledger:v3:{addressHash}[:namespace:<namespace>]`: the active one-value wallet event ledger; its temporary synchronization lock uses the same key plus `:lock`.
   - `holdings:wallet-ledger:v3:{addressHash}[:namespace:<namespace>]:checked`: lightweight verified freshness/coverage header for hot reads.
   - `holdings:wallet-ledger-invalidations:v1[:namespace:<namespace>]`: append-only newly indexed-vault/backfill records; the Redis list position is the global sequence.
   - `holdings:wallet-ledger:v3:{addressHash}[:namespace:<namespace>]:daily-usd:v1:<version>`: ledger-fenced daily USD totals.
   - `holdings:wallet-ledger:v3:{addressHash}[:namespace:<namespace>]:derived-portfolio:v1:<version>:<timeframe>`: compressed, revision-fenced protocol-return and growth result with a 30-minute TTL.
   - `holdings:totals:<addressHash>:<version>`: daily USD totals per hashed user address, vault version, and date. Hash fields are `YYYY-MM-DD`; values include `usdValue` and `updatedAt`.
   - `holdings:protocol-return-history:v3:<addressHash>:<version>:<timeframe>:<vaultScope>`: successful non-empty protocol-return history snapshots. The payload includes its settled date and relevant vault identifiers for invalidation checks.
   - `holdings:vault-invalidated:<chainId>:<vaultAddress>`: per-vault invalidation timestamps for lazy cache clearing.
   - `holdings:progress:<progressId>`: authoritative short-lived progress records keyed by caller-supplied progress ID for long history requests across Vercel function instances.
2. HTTP cache:
   - Wallet-scoped holdings responses use `Cache-Control: private, no-store, max-age=0, must-revalidate`.
   - This applies to history, breakdown, activity, activity facets, and protocol-return history.
   - Progress: `Cache-Control: no-store`.
3. Client TanStack Query cache:
   - The combined wallet-ledger portfolio query keeps each exact wallet/version/denomination/timeframe response fresh for 25 minutes.
   - Legacy portfolio history and protocol-return hooks keep chart responses fresh for one hour when fallback is active.
   - Other frontend hooks configure their own durations.

Historical PPS samples are not a Redis cache layer. Ledger growth routes fetch the required Kong timelines into request memory on every calculation.

### Daily Totals

The history cache stores aggregate daily totals, not per-vault breakdown rows. Cache keys use SHA-256 of the normalized user address, not the raw address.

Cache behavior:

- Unfiltered history can read/write `holdings:totals:<addressHash>:<version>`.
- Vault-filtered history skips aggregate daily total cache because the cache is user/version scoped, not vault-filter scoped.
- Cache staleness is checked against `holdings:vault-invalidated:<chainId>:<vaultAddress>` only after the request has enough cached daily totals to potentially serve from cache.
- If any relevant vault was invalidated after the oldest cached row was written, the user's cached totals for that version are cleared and recomputed.
- Every balance point exposes `isComplete`, and the response-level `isComplete` is true only when every requested date is complete. A date with a non-zero position but missing vault metadata, a valid positive PPS, or a valid positive token price is returned as a best-effort provisional point instead of failing the whole request. The legacy aggregate cache writes only complete dates, so unresolved legacy dates are retried on the next request.

### Wallet-Ledger Daily USD Totals

The active combined portfolio route keeps a separate daily-USD hash at `holdings:wallet-ledger:v3:{walletHash}[:namespace:<namespace>]:daily-usd:v1:<version>`. Vault versions (`all`, `v2`, and `v3`) use separate hashes, while `1y` and `all` share the same `YYYY-MM-DD` fields so an `all` request fetches PPS and prices only for dates that a prior `1y` request did not fill. Reads request `__meta` plus exactly the UTC date fields in the requested range instead of downloading the whole hash. The cache persists USD totals only; ETH history divides those USD points by historical ETH prices at request time.

Each hash has exact metadata containing its cache schema/calculation versions, valuation revision, ledger source generation, the wallet's events-only revision, and the applied indexer-invalidation sequence. A metadata mismatch is a miss. Forced and source resets advance the durable source generation; bumping `HOLDINGS_LEDGER_VALUATION_REVISION` invalidates only these derived totals. Writes atomically verify that the durable wallet ledger still has the caller's full ledger revision, preventing an older overlapping calculation from replacing newer totals. When synchronization changes historical events, the ledger value and all existing `all`/`v2`/`v3` cache transitions commit in the same wallet-scoped Redis operation: dates before the earliest affected UTC date survive, while that date and its tail are removed. Resets or incompatible metadata discard the affected hash. Complete cache coverage returns before event loading, metadata, PPS, or token-price work begins. Completeness is evaluated per date from the non-zero positions on that date. The wallet cache stores both complete and provisional totals. A fresh provisional row (`isComplete: false`) may satisfy a request for up to one hour; at or after that boundary it is omitted from the read so only that date is recalculated. A later complete calculation overwrites it and follows the normal 30-day hash lifetime. Mixed complete and provisional ranges remain usable and expose their state through per-point and response-level `isComplete` fields.

When the primary historical-price provider cannot value a held vault asset on a daily balance point, the balance and dated-breakdown calculations may use Kong's vault TVL `priceUsd` series as a secondary source. Kong values are UTC-day nonzero-sample averages, so they apply only to the exact requested UTC day and are never carried into a neighboring day or used for event-time protocol return. Requirements include only dates where the wallet held shares, PPS was valid, and the primary/derived asset price was still absent. Shared assets use deterministic vault candidates, requests are bounded to eight concurrent asset groups with retry and a six-second fail-open budget, and unresolved dates remain provisional.

### Protocol Return History Snapshots

- Protocol-return history is path-dependent, so the cache stores an atomic response snapshot instead of independent daily points.
- Cache keys use the normalized wallet hash plus version, timeframe, and a hashed vault scope. A calculation-version prefix prevents incompatible response logic from reusing older snapshots.
- Snapshots expire after 24 hours, must match the current settled date, and are rejected when any stored vault invalidation marker is newer than the calculation start.
- Successful non-empty responses are cached even when some vault histories are partial; empty responses are not cached.
- Identical requests in the same server process share one in-flight calculation.

### Progress

- Progress writes only when Redis persistence is enabled and the supplied `progressId` matches `[a-zA-Z0-9:_-]{1,160}`.
- Progress status is `running`, `complete`, or `error`; progress is clamped to `0..100`, logs are capped to the latest `20` entries, and rows expire after `10 minutes`.

### Token Prices

Token prices are fetched from the selected provider for each request. Holdings Redis storage does not cache positive token prices or price misses.

## Redis Keys

No schema migration is required. Redis keys are created lazily:

| Key | Type | TTL | Purpose |
|-----|------|-----|---------|
| `holdings:wallet-ledger:v3:{addressHash}[:namespace:<namespace>]` | Opaque string | None, or 24 hours when empty | Active wallet event ledger and applied invalidation cursor. |
| `holdings:wallet-ledger:v3:{addressHash}[:namespace:<namespace>]:checked` | JSON string | Matches wallet value | Lightweight verified freshness, coverage, event identity, and size header. |
| `holdings:wallet-ledger-invalidations:v1[:namespace:<namespace>]` | List | None | Sequenced vault backfills checked lazily by active wallets. |
| `holdings:wallet-ledger:v3:{addressHash}[:namespace:<namespace>]:daily-usd:v1:<version>` | Hash | 30 days from write | Revision-fenced ledger daily USD totals. |
| `holdings:wallet-ledger:v3:{addressHash}[:namespace:<namespace>]:derived-portfolio:v1:<version>:<timeframe>` | Opaque string | 30 minutes | Revision-fenced protocol-return plus growth response. |
| `holdings:totals:<addressHash>:<version>` | Hash | 30 days from write | Daily holdings chart totals. |
| `holdings:protocol-return-history:v3:<addressHash>:<version>:<timeframe>:<vaultScope>` | String JSON | 24 hours | Atomic protocol-return history response snapshot. |
| `holdings:vault-invalidated:<chainId>:<vaultAddress>` | String timestamp | None | Lazy invalidation marker for totals cache. |
| `holdings:progress:<progressId>` | String JSON record | 10 minutes | Progress polling state for long requests. |

## Operational Notes

- Enable Redis storage in shared environments; otherwise a history request must rebuild events, PPS, and prices every time.
- Keep `API_KEY_PORTFOLIO` or `YEARN_PRICES_API_KEY` configured if `HOLDINGS_PRICE_PROVIDER=auto` should prefer yearn-prices.
- Configure `RPC_URI_FOR_<chainId>` for chains where activity rows should include richer zap, reward-claim, and direct V2 vault enrichment.
- Pass a stable `progressId` from the frontend for long history and protocol-return requests, then poll `/api/holdings/progress?id=...`; progress rows are Redis-backed and expire quickly.
- Use `/api/admin/invalidate-cache` after indexer deployments add or repair vault coverage.
- Rate-limit and progress cleanup is handled by Redis TTLs.
- If Redis progress is unavailable, clients show a neutral loading placeholder instead of estimated progress.
- `timeframe=all` grows over time from `2024-01-01`, so cache row counts are no longer fixed at `365` per user/version.
