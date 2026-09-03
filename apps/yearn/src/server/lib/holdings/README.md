# Holdings APIs

The holdings system calculates settled balance history, current per-vault balances, recent activity, protocol return, and per-vault growth for Yearn positions.

## Runtime shape

```text
Portfolio UI
  └─ GET /api/holdings/portfolio
       ├─ balance history
       ├─ protocol-return history
       └─ per-vault growth

Standalone consumers
  ├─ GET /api/holdings/history
  ├─ GET /api/holdings/breakdown
  ├─ GET /api/holdings/activity
  ├─ GET /api/holdings/activity-facets
  ├─ GET /api/holdings/protocol-return/history
  └─ GET /api/holdings/progress

Upstreams
  ├─ Envio GraphQL: V2 and V3 deposits, withdrawals, and transfers
  ├─ Kong: vault metadata and historical price per share
  ├─ yearn-prices: historical asset prices
  └─ Upstash Redis: optional event, result, invalidation, and progress storage
```

The portfolio route is the UI's only history loader. Balance and Growth calculations begin in parallel and share a lazily-created wallet context when either path needs it. A complete cache hit can return without fetching wallet events.

## Valuation model

```text
USD value = vault shares × price per share × vault asset USD price
```

- Shares are reconstructed from deposits, withdrawals, and transfers.
- Historical price per share comes from Kong's deployed per-vault endpoint.
- Historical asset prices come from yearn-prices.
- Nested Yearn vault assets are resolved recursively using their own price-per-share history.

History contains settled UTC days only. `1y` returns the latest 365 settled days. `all` starts at `2024-01-01` and ends at the latest settled day. Daily valuation is performed at `23:59:59 UTC`.

## Event model

The fixed event pipeline fetches both V2 and V3 activity with bounded, count-free parallel pagination. There is no public vault-version or event-fetch strategy selector.

- V3 deposits and withdrawals use the `owner` field.
- V2 deposits and withdrawals use the `recipient` field.
- Transfers account for share movement outside direct deposits and withdrawals.
- Mint and burn transfers are removed when an indexed deposit or withdrawal already represents them.
- Transfer-only vaults retain mint and burn transfers.
- Staking positions are mapped to their underlying vault family.
- Vaults marked `isHidden=true` by Kong are excluded everywhere.

Recent activity may use chain receipts to classify zaps, swaps, rewards, and direct V2 vault calls. Receipt enrichment is best effort; indexed events remain authoritative when RPC enrichment is unavailable.

## Services

| File | Responsibility |
|------|----------------|
| `graphql.ts` | Fetch combined V2/V3 wallet events and activity pages from Envio |
| `settledHoldingsContext.ts` | Share wallet events, position timeline, metadata, and PPS work across calculations |
| `walletEventCache.ts` | Cache the combined bounded wallet event response |
| `vaults.ts` | Resolve Kong metadata, hidden flags, staking families, and metadata snapshots |
| `kong.ts` | Fetch historical PPS from the deployed Kong route with retries, deduplication, and one global concurrency limit |
| `prices.ts` | Fetch yearn-prices batch and range history with retries, splitting, and one global concurrency limit |
| `nestedVaultPrices.ts` | Resolve nested Yearn vault asset prices |
| `aggregator.ts` | Calculate balance history, ETH-denominated history, and breakdowns |
| `activity.ts` | Classify recent activity |
| `pnlSimple.ts` | Calculate protocol-return history and current per-vault growth |
| `portfolio.ts` | Run balance and Growth lanes together and merge the response |
| `cache.ts` | Store daily totals and compressed protocol-return snapshots |
| `progress.ts` | Store short-lived progress records |

## Historical prices

`prices.ts` always uses yearn-prices.

- Base URL: `YEARN_PRICES_BASE_URL`, then `YEARN_PRICES_API_URL`, then `https://prices.yearn.dev`.
- Authentication: `YEARN_PRICES_API_KEY`, falling back to `API_KEY_PORTFOLIO`, sent as a bearer token.
- Contiguous daily requests of up to 366 days use `/api/prices/rangeHistorical`.
- Sparse and single-day requests use `/api/prices/batchHistorical`.
- Requested timestamps are normalized to UTC day end for the upstream call and mapped back to their original timestamps locally.
- Failed or incomplete batches are recorded so an incomplete portfolio result is not persisted as a valid long-lived snapshot.

## Historical PPS

`kong.ts` uses Kong's deployed per-vault PPS endpoint as its only source.

- Duplicate requests for the same vault share one in-flight promise.
- Initial requests, retries, and concurrent portfolio callers share one global request limit.
- A failed PPS request is marked incomplete and prevents the calculated zero balance history from entering the long-lived cache.

## Endpoints

All public holdings routes support `GET` and `OPTIONS` and use Vercel Firewall for request rate limiting.

### `GET /api/holdings/portfolio`

Combined response used by the Portfolio page.

```text
address=<EVM address>                       required
denomination=usd|eth                       default: usd
timeframe=1y|all                           default: 1y
progressId=<client-generated id>           optional
debug=true                                 optional
```

The response contains `balance`, `protocolReturn`, and `growth`. Its `version` is always `all` because V2 and V3 events are one portfolio.

With `progressId`, balance contributes 40% and Growth contributes 60% to one combined progress record. Only the lane with the greater remaining weighted work supplies the visible progress message. The result stays below 100% until both lanes finish.

### `GET /api/holdings/history`

Standalone settled balance chart.

```text
address=<EVM address>                       required
denomination=usd|eth                       default: usd
timeframe=1y|all                           default: 1y
vault=<address>&chainId=<id>                optional single-vault filter
vaults=<chainId:address,...>                optional multi-vault filter
progressId=<client-generated id>           optional
debug=true                                 optional
```

Returns `404` when the wallet has no indexed holdings activity.

### `GET /api/holdings/protocol-return/history`

Standalone settled protocol-return chart.

```text
address=<EVM address>                       required
timeframe=1y|all                           default: 1y
vault=<address>&chainId=<id>                optional single-vault filter
vaults=<chainId:address,...>                optional multi-vault filter
progressId=<client-generated id>           optional
debug=true                                 optional
```

Protocol return measures vault performance while capital was exposed. It excludes the effect of deposits, withdrawals, and transfers. The response includes aggregate chart points and compact family series used by Portfolio Growth charts.

### `GET /api/holdings/breakdown`

Current or historical per-vault valuation.

```text
address=<EVM address>                       required
date=YYYY-MM-DD                             optional settled UTC date
```

Each row reports shares, PPS, asset price, USD value, metadata, and an explicit missing-data status.

### `GET /api/holdings/activity`

Paginated classified wallet activity.

```text
address=<EVM address>                       required
limit=<integer>                             default: 10
offset=<integer>                            default: 0
type=<deposit|withdraw|stake|unstake|...>   optional
chainId=<id>                                optional
startTimestamp=<unix seconds>               optional
endTimestamp=<unix seconds>                 optional
```

### `GET /api/holdings/activity-facets`

Returns the chains that contain activity for the address. `address` is required.

### `GET /api/holdings/progress`

Reads a progress record by `id`. Records expire after 10 minutes and the route always returns `Cache-Control: no-store`.

## Cache and invalidation

Redis is optional. Routes continue without cache or progress persistence when it is unavailable; clients are created lazily on first use.

Keys:

- `holdings:wallet-events:*`: combined wallet event history.
- `holdings:totals:v3:<walletHash>`: aggregate settled USD totals by date.
- `holdings:protocol-return-history:v13:<walletHash>:<timeframe>:<vaultScope>`: compressed protocol-return and Growth snapshot.
- `holdings:vault-invalidated:<chainId>:<vaultAddress>`: lazy invalidation timestamp.
- `holdings:progress:*`: short-lived route progress.

Wallet addresses are SHA-256 hashed in result-cache keys. Protocol-return snapshots are Brotli encoded with the `br1:` prefix. Oversized encoded values are skipped, and reads enforce both encoded and decoded size limits.

`POST /api/admin/invalidate-cache` requires `Authorization: Bearer <ADMIN_SECRET>`. It writes vault invalidation timestamps. Later reads compare those timestamps with the oldest cached calculation timestamp and rebuild stale results.

## Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `ENVIO_GRAPHQL_URL` | Yes | Envio GraphQL endpoint |
| `ENVIO_PASSWORD` | No | Envio bearer token |
| `YEARN_PRICES_BASE_URL` | No | yearn-prices base URL |
| `YEARN_PRICES_API_URL` | No | Older alias for the base URL |
| `YEARN_PRICES_API_KEY` | One price key | Primary yearn-prices bearer token |
| `API_KEY_PORTFOLIO` | One price key | Fallback yearn-prices bearer token |
| `UPSTASH_REDIS_REST_URL_PORTFOLIO` | No | Holdings Redis URL |
| `UPSTASH_REDIS_REST_TOKEN_PORTFOLIO` | No | Holdings Redis token |
| `ADMIN_SECRET` | For invalidation | Admin endpoint bearer token |
| `RPC_URI_FOR_<chainId>` | No | Server-side receipt enrichment RPC |
| `NEXT_PUBLIC_RPC_URI_FOR_<chainId>` | No | Receipt-enrichment RPC fallback |
| `HOLDINGS_DEBUG` | No | Holdings debug logging |

Kong PPS uses the public production Kong origin configured in the service. It does not attach a deployment bypass secret or use a development PPS origin.
