# API Routes

This directory contains Vercel API functions plus `api/server.ts`, a local Bun server that mirrors the app-facing API routes on `localhost:3001`.

## Local Server

Run the local API with:

```bash
bun api/server.ts
```

`API_SERVER_PORT` overrides the default `3001`.

The local server adds CORS to all handled routes and includes dev-only Tenderly admin routes. Vercel production routes are implemented as individual files under `api/`.

## Route Inventory

| Route | Method | Runtime | Purpose |
|-------|--------|---------|---------|
| `/api/holdings/history` | `GET` | Vercel + local | Daily holdings chart, USD or ETH-denominated |
| `/api/holdings/breakdown` | `GET` | Vercel + local | Per-vault breakdown for a settled UTC day |
| `/api/holdings/activity` | `GET` | Vercel + local | Recent classified vault activity |
| `/api/holdings/protocol-return/history` | `GET` | Vercel + local | Protocol-return history for vault exposure |
| `/api/holdings/pnl/simple-history` | `GET` | Vercel + local | Compatibility alias for protocol-return history |
| `/api/holdings/chores` | `POST` | Vercel + local | Holdings cache cleanup, cron-protected |
| `/api/admin/invalidate-cache` | `POST` | Vercel + local | Lazy vault cache invalidation, admin-protected |
| `/api/enso/status` | `GET` | Vercel + local | Returns whether `ENSO_API_KEY` is configured |
| `/api/enso/balances` | `GET` | Vercel + local | Proxies Enso wallet balances |
| `/api/enso/route` | `GET` | Vercel + local | Proxies Enso route quotes/transactions |
| `/api/yvusd/aprs` | `GET` | Vercel + local | Proxies the yvUSD APR service |
| `/api/vault/meta` | `GET` | Vercel | Serves SPA HTML with vault-specific SEO and OG tags |
| `/api/tenderly/status` | `GET` | local only | Returns configured local Tenderly chains |
| `/api/tenderly/snapshot` | `POST` | local only | Creates a Tenderly EVM snapshot |
| `/api/tenderly/revert` | `POST` | local only | Reverts a Tenderly EVM snapshot |
| `/api/tenderly/increase-time` | `POST` | local only | Advances Tenderly chain time and optionally mines |
| `/api/tenderly/fund` | `POST` | local only | Funds native or ERC-20 balances on Tenderly |

## Holdings APIs

The holdings implementation is the largest API surface here. See [`lib/holdings/README.md`](./lib/holdings/README.md) for:

- Endpoint query params and response shapes.
- Envio, Kong, yearn-prices, and DefiLlama data flow.
- `timeframe=all` support from `2024-01-01`.
- Cache schema, hashed user cache keys, invalidation, and chores behavior.
- Historical price provider switching and yearn-prices range requests.

## Enso Proxies

`/api/enso/*` routes keep `ENSO_API_KEY` server-side and forward requests to `https://api.enso.finance`.

- `/api/enso/status` returns `{ "configured": boolean }`; the Vercel handler does not currently enforce the HTTP method.
- `/api/enso/balances` requires `eoaAddress`; Vercel always requests `chainId=all`, while the local server also accepts an optional `chainId`.
- `/api/enso/route` requires `fromAddress`, `chainId`, `tokenIn`, `tokenOut`, and `amountIn`. Optional params are `slippage`, `destinationChainId`, and `receiver`.
- `/api/enso/balances` sets `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`.

## yvUSD APR Proxy

`/api/yvusd/aprs` forwards query params to `YVUSD_APR_SERVICE_API`.

- Default upstream: `https://yearn-yvusd-apr-service.vercel.app/api/aprs`.
- Cache header: `public, s-maxage=30, stale-while-revalidate=120`.

## Vault Metadata HTML

`/api/vault/meta?chainId=1&address=0x...` validates both params, loads `dist/index.html`, injects vault-specific SEO and Open Graph tags, and returns HTML.

- `chainId` must be digits only.
- `address` must be a 20-byte EVM address.
- CDN cache header: `Vercel-CDN-Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800`.

## Tenderly Local Routes

Tenderly admin routes only exist in `api/server.ts` and are blocked unless the request comes from localhost.

Required env for a configured chain:

- `VITE_TENDERLY_MODE=true`.
- `VITE_TENDERLY_CHAIN_ID_FOR_<canonicalChainId>`.
- `VITE_TENDERLY_RPC_URI_FOR_<canonicalChainId>`.
- `TENDERLY_ADMIN_RPC_URI_FOR_<canonicalChainId>` for snapshot, revert, time travel, and funding actions.

## Environment Variables

| Variable | Used by | Description |
|----------|---------|-------------|
| `API_SERVER_PORT` | local server | Local Bun API port, default `3001` |
| `ENSO_API_KEY` | Enso routes | Bearer token for Enso upstream requests |
| `YVUSD_APR_SERVICE_API` | yvUSD route | Upstream APR service URL |
| `ENVIO_GRAPHQL_URL` | holdings | Envio GraphQL endpoint |
| `ENVIO_PASSWORD` | holdings | Optional Envio Hasura admin secret |
| `DATABASE_URL_PREVIEW` | holdings | Preferred holdings PostgreSQL URL when set |
| `DATABASE_URL` | holdings | Default holdings PostgreSQL URL |
| `HOLDINGS_PRICE_PROVIDER` | holdings | `auto`, `yearn-prices`, or `defillama` |
| `YEARN_PRICES_BASE_URL` | holdings | yearn-prices base URL |
| `YEARN_PRICES_API_URL` | holdings | Legacy alias for `YEARN_PRICES_BASE_URL` |
| `YEARN_PRICES_API_KEY` | holdings | Bearer token for yearn-prices |
| `API_KEY_PORTFOLIO` | holdings | Fallback bearer token for yearn-prices |
| `DEFILLAMA_API_KEY` | holdings | Enables DefiLlama Pro |
| `ADMIN_SECRET` | holdings admin | Required for `/api/admin/invalidate-cache` |
| `CRON_SECRET` | holdings chores | Required for `/api/holdings/chores` |
| `HOLDINGS_DEBUG` | local holdings | Enables holdings debug logs in `api/server.ts` |
| `VITE_TENDERLY_MODE` | local Tenderly | Enables Tenderly config parsing |
| `VITE_TENDERLY_CHAIN_ID_FOR_<id>` | local Tenderly | Tenderly execution chain ID for a canonical chain |
| `VITE_TENDERLY_RPC_URI_FOR_<id>` | local Tenderly | Public Tenderly RPC URI |
| `TENDERLY_ADMIN_RPC_URI_FOR_<id>` | local Tenderly | Admin Tenderly RPC URI |
