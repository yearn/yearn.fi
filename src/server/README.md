# Server API Handlers

This directory contains focused API endpoint implementations and shared server-side helpers. Next exposes them through explicit App Router files under `app/api/**/route.ts`.

There is no standalone Bun API mirror and no catch-all pathname dispatcher. Local development and production both serve `/api/*` through Next.

## Route Layout

- `app/api/**/route.ts` files define the public Next route surface and export HTTP methods directly.
- `src/server/**` endpoint modules contain the implementation for each route.
- `src/server/lib/**`, `src/server/optimization/_lib/**`, and `src/server/tenderly.helpers.ts` contain shared service logic.

## Route Inventory

| Route | Method | Runtime | Purpose |
|-------|--------|---------|---------|
| `/api/holdings/history` | `GET` | Next Node | Daily holdings chart, USD or ETH-denominated |
| `/api/holdings/progress` | `GET` | Next Node | Durable progress state for long holdings requests |
| `/api/holdings/breakdown` | `GET` | Next Node | Per-vault breakdown for a settled UTC day |
| `/api/holdings/activity` | `GET` | Next Node | Recent classified vault activity |
| `/api/holdings/activity-facets` | `GET` | Next Node | Chain facets for holdings activity filters |
| `/api/holdings/protocol-return/history` | `GET` | Next Node | Protocol-return history for vault exposure |
| `/api/holdings/pnl/simple-history` | `GET` | Next Node | Compatibility alias for protocol-return history |
| `/api/admin/invalidate-cache` | `POST` | Next Node | Lazy vault cache invalidation, admin-protected |
| `/sitemap.xml` | `GET` | Next Node | XML sitemap for public pages and vault detail URLs |
| `/api/sitemap` | `GET` | Next Node | Compatibility alias for the sitemap XML response |
| `/api/vaults/markdown` | `GET` | Next Node | Kong-derived markdown summary of public active vaults |
| `/api/vault/markdown` | `GET` | Next Node | Kong-derived markdown detail for a single vault |
| `/api/enso/status` | `GET` | Next Node | Returns whether `ENSO_API_KEY` is configured |
| `/api/enso/balances` | `GET` | Next Node | Proxies Enso wallet balances |
| `/api/enso/route` | `GET` | Next Node | Proxies Enso route quotes/transactions |
| `/api/merkl/rewards` | `GET` | Vercel + local | Proxies Merkl user rewards with `MERKL_API_KEY` |
| `/api/optimization/change` | `GET` | Next Node | Latest or historical optimization payloads from Redis |
| `/api/optimization/alignment` | `GET` | Next Node | Envio keeper-event alignment for a selected optimization |
| `/api/optimization/vault-state` | `POST` | Next Node | Live vault and strategy debt state from chain RPCs |
| `/api/yvusd/aprs` | `GET` | Next Node | Proxies the yvUSD APR service |
| `/api/tenderly/status` | `GET` | Next Node | Returns configured local Tenderly chains |
| `/api/tenderly/snapshot` | `POST` | Next Node | Creates a Tenderly EVM snapshot |
| `/api/tenderly/revert` | `POST` | Next Node | Reverts a Tenderly EVM snapshot |
| `/api/tenderly/increase-time` | `POST` | Next Node | Advances Tenderly chain time and optionally mines |
| `/api/tenderly/fund` | `POST` | Next Node | Funds native or ERC-20 balances on Tenderly |

## Holdings APIs

The holdings implementation is the largest API surface here. See [`lib/holdings/README.md`](./lib/holdings/README.md) for:

- Endpoint query params and response shapes.
- Envio, Kong, yearn-prices, and DefiLlama data flow.
- `timeframe=all` support from `2024-01-01`.
- Cache schema, hashed user cache keys, and invalidation behavior.
- Historical price provider switching and yearn-prices range requests.

## Enso Proxies

`/api/enso/*` routes keep `ENSO_API_KEY` server-side and forward requests to `https://api.enso.finance`.

- `/api/enso/status` returns `{ "configured": boolean }`.
- `/api/enso/balances` requires `eoaAddress` and requests `chainId=all` upstream.
- `/api/enso/route` requires `fromAddress`, `chainId`, `tokenIn`, `tokenOut`, and `amountIn`. Optional params are `slippage`, `routingStrategy`, `destinationChainId`, and `receiver`.
- `/api/enso/balances` sets `Cache-Control: private, no-store, max-age=0, must-revalidate`.

## Merkl Proxy

`/api/merkl/rewards` keeps `MERKL_API_KEY` server-side and forwards user reward requests to `https://api.merkl.xyz` with Merkl's `X-API-Key` header.

- Required params are `userAddress=0x...` and `chainId=<id>`.
- The route sets `Cache-Control: private, no-store, max-age=0, must-revalidate`.

## Optimization APIs

The optimization routes expose the current DOA optimization payloads and the local verification data used by optimization UI flows.

- `/api/optimization/change` reads optimization records from Upstash Redis keys under `doa:optimizations:*`. `vault=0x...` selects one vault, and `history=1` or `history=true` returns all records for that vault instead of the latest one.
- `/api/optimization/alignment` requires `vault=0x...`, selects the matching optimization, resolves its source chain, and fetches aligned keeper `DebtUpdated` events from Envio. It needs `ENVIO_GRAPHQL_URL`; `ENVIO_PASSWORD` is sent as a bearer token when configured.
- `/api/optimization/vault-state` accepts `POST` JSON shaped as `{ "vault": "0x...", "chainId": 1, "strategies": ["0x..."] }`, then reads live vault and strategy debt state from configured public RPC endpoints.
- CDN cache headers: `change` uses `Vercel-CDN-Cache-Control: public, s-maxage=600, stale-while-revalidate=60`; `alignment` and `vault-state` use `Vercel-CDN-Cache-Control: public, s-maxage=60, stale-while-revalidate=30`. Browser-facing `Cache-Control` stays `public, max-age=0, must-revalidate`.

## yvUSD APR Proxy

`/api/yvusd/aprs` forwards query params to `YVUSD_APR_SERVICE_API`.

- Default upstream: `https://yearn-yvusd-apr-service.vercel.app/api/aprs`.
- CDN cache header: `Vercel-CDN-Cache-Control: public, s-maxage=30, stale-while-revalidate=120`. Browser-facing `Cache-Control` stays `public, max-age=0, must-revalidate`.

## Machine-Readable Vault Routes

`/sitemap.xml`, `/api/vaults/markdown`, and `/api/vault/markdown` are generated from Kong REST for crawler and agent discovery.

- `/sitemap.xml` lists static public pages and non-hidden, non-retired vault detail URLs. `/api/sitemap` returns the same XML for backwards compatibility with the old Vercel rewrite target.
- `/api/vaults/markdown` accepts an optional numeric `chainId` query param and returns a markdown table of active public Single Asset and LP Token vaults.
- `/api/vault/markdown` requires numeric `chainId` and a 20-byte EVM `address`, then returns a markdown summary for that vault snapshot.
- Kong JSON remains the source of truth for live financial values.

## Vault Metadata

Vault detail metadata is now generated by Next route metadata in `app/vaults/[chainID]/[address]/page.tsx` and `app/v3/[chainID]/[address]/page.tsx`. The old SPA HTML injection route was removed.

## Tenderly Local Routes

Tenderly admin routes are exposed through `app/api/tenderly/**/route.ts` for local and non-production testing. The root
Next proxy returns `404` for `/api/tenderly/*` when `VERCEL_ENV=production`, so production deployments should not reach
these handlers. POST handlers also keep a localhost-only guard for local use.

Required env for a configured chain:

- `NEXT_PUBLIC_TENDERLY_MODE=true`.
- `NEXT_PUBLIC_TENDERLY_CHAIN_ID_FOR_<canonicalChainId>`.
- `NEXT_PUBLIC_TENDERLY_RPC_URI_FOR_<canonicalChainId>`.
- `TENDERLY_ADMIN_RPC_URI_FOR_<canonicalChainId>` for snapshot, revert, time travel, and funding actions.

## Environment Variables

| Variable | Used by | Description |
|----------|---------|-------------|
| `ENSO_API_KEY` | Enso routes | Bearer token for Enso upstream requests |
| `MERKL_API_KEY` | Merkl route | API key sent to Merkl as `X-API-Key` |
| `KONG_REST_URL` | machine-readable vault routes | Optional server-only Kong REST base URL override |
| `NEXT_PUBLIC_KONG_REST_URL` | vault pages, machine-readable vault routes | Public Kong REST base URL |
| `VITE_KONG_REST_URL` | machine-readable vault routes | Legacy Kong REST base URL fallback during migration |
| `YVUSD_APR_SERVICE_API` | yvUSD route | Upstream APR service URL |
| `ENVIO_GRAPHQL_URL` | holdings, optimization alignment | Envio GraphQL endpoint |
| `ENVIO_PASSWORD` | holdings, optimization alignment | Optional Envio secret or bearer token |
| `RPC_URI_FOR_<id>` | holdings activity | Optional server-only chain RPC URL for receipt enrichment; falls back to `NEXT_PUBLIC_RPC_URI_FOR_<id>` |
| `HOLDINGS_PRICE_PROVIDER` | holdings | `auto`, `yearn-prices`, or `defillama` |
| `YEARN_PRICES_BASE_URL` | holdings | yearn-prices base URL |
| `YEARN_PRICES_API_URL` | holdings | Legacy alias for `YEARN_PRICES_BASE_URL` |
| `YEARN_PRICES_API_KEY` | holdings | Bearer token for yearn-prices |
| `API_KEY_PORTFOLIO` | holdings | Fallback bearer token for yearn-prices |
| `DEFILLAMA_API_KEY` | holdings | Enables DefiLlama Pro |
| `ADMIN_SECRET` | holdings admin | Required for `/api/admin/invalidate-cache` |
| `UPSTASH_REDIS_REST_URL_PORTFOLIO` | holdings | Upstash Redis REST URL for holdings cache/progress |
| `UPSTASH_REDIS_REST_TOKEN_PORTFOLIO` | holdings | Upstash Redis REST token for holdings storage |
| `UPSTASH_REDIS_REST_URL` | optimization | Upstash Redis REST URL for optimization payloads |
| `UPSTASH_REDIS_REST_TOKEN` | optimization | Upstash Redis REST token for optimization payloads |
| `HOLDINGS_DEBUG` | holdings | Enables holdings debug logs |
| `NEXT_PUBLIC_TENDERLY_MODE` | local Tenderly | Enables Tenderly config parsing |
| `NEXT_PUBLIC_TENDERLY_CHAIN_ID_FOR_<id>` | local Tenderly | Tenderly execution chain ID for a canonical chain |
| `NEXT_PUBLIC_TENDERLY_RPC_URI_FOR_<id>` | local Tenderly | Public Tenderly RPC URI |
| `TENDERLY_ADMIN_RPC_URI_FOR_<id>` | local Tenderly | Admin Tenderly RPC URI |
