# Yearn Wrapped

A read-only 2026 wallet recap in Next.js, React and TypeScript. Connect a wallet or enter an address/ENS name, navigate a conditional story deck with vertical scroll gestures, right-side progress dots, arrow keys or swipes, and save/copy/share individual cards as PNGs. The explicit demo uses fictional data; failed wallet requests never fall back to it.

## Run

From the workspace root:

```sh
bun install --frozen-lockfile
cp apps/wrapped/.env.example apps/wrapped/.env.local
bun run dev                    # main app and holdings backend, localhost:3000
bun run dev:wrapped             # second terminal, localhost:3006
bun run build:wrapped -- --webpack
bun run preview:wrapped
bun run tslint:wrapped
bun run test:wrapped
```

The main app loads root environment configuration. Its existing `ENVIO_GRAPHQL_URL`, optional Envio password, yearn-prices credentials and optional holdings Redis configuration apply unchanged. Wrapped itself needs no Envio/pricing credentials. `YEARN_HOLDINGS_URL` is a server-only base URL for a Yearn deployment containing this branch's `/api/holdings/wrapped` route. The default is `https://yearn.fi`; deploy the main backend change before pointing a separately hosted Wrapped app at production. The app makes no cross-app source imports.

Injected wallets work without WalletConnect configuration. For WalletConnect, provide an app-specific project ID and allowed domain. ENS uses the configured Ethereum RPC through Viem. It tries the universal resolver first, then the resolver registered for the exact name when a legacy Ethereum address record is missed. Registry ownership is never substituted for an address record; RPC failures remain distinct from missing records. Connecting only supplies an address; no signature or transaction is requested.

## Data and meaning

The main Yearn server adds a small recap adapter around its existing settled holdings context and protocol-return history. It reuses normalized V2/V3 events, staking-family mappings, hidden-vault filtering, Kong PPS, yearn-prices historical prices and the existing event/result caches and request limits. Wrapped does not implement a second indexer, pricing collector or yield engine. Both apps validate the version-2 response with `@yearn/wrapped-contract`.

The headline is a calendar-year **Growth Index percentage return**, as selected for the first version. Rebase the existing index against December 31, 2025; for a wallet with no opening position and no pre-year index, use its first available in-year index and disclose that baseline. Require complete index coverage through the latest settled UTC day; missing data remains unavailable. This is estimated protocol performance, not personal profit or USD earned during 2026. The recap is year-to-date until all of 2026 is settled.

The holdings timeline supplies positive holding spans, longest streak, still-held vaults and chain counts. Home base means most time held, not highest monetary value. Flow counts are indexed events, not unique transactions, and omit direct staking deposit/withdrawal events. Self transfers net at the same timestamp. Raw share amounts remain `bigint` inside the existing engine and are never serialized as unsafe JavaScript numbers.

Incomplete metadata/share histories suppress rankings that require complete comparisons. The response carries explicit coverage reasons. Unsupported years, no indexed history, unavailable upstreams and invalid addresses remain separate HTTP outcomes. Wallet responses use private/no-store headers. No new process-local cache, queue or disk cache is introduced; upstream coordination stays with the main site.

The first version intentionally has no annual USD earnings, withdrawal counterfactual, population/cohort comparison or independent market-price collector. Those require separately defined and validated data. The original prototype's Three.js dependency is not required for this version: the official symbol uses CSS perspective/motion with a static reduced-motion state. Existing Yearn fonts and lockup are retained.

## Checks and review

Financial tests verify the year boundary, zero/loss/missing returns, entry during the year, pre-year holdings, full exits, self transfers, chain identity and incomplete data. Transport tests check validation, no-history, upstream failure, cross-wallet response rejection and private response headers. Browser review should cover desktop/320px mobile, direct-entry refresh, wallet/ENS, errors/retry, keyboard/swipe, reduced motion and image parity. Run the main backend tests too:

```sh
bun run --cwd apps/yearn test -- src/server/lib/holdings/services/wrapped.test.ts --pool=threads --maxWorkers=4
bun run --cwd packages/wrapped-contract test
bun run tslint
bun run lint:fix
```

Live endpoint verification and deterministic fixture checks are separate evidence. The source sample is never used as current financial truth.

## Deployment

Use an independent app root at `apps/wrapped`. Automatic Git deployment is disabled in the app-local Vercel configuration while the feature is under review; no domain routing or public navigation is changed. Configure hosting duration limits to accommodate the main holdings API; the app caps its upstream request at 180 seconds. A timeout is retryable and never detaches background work. Production rollout must validate provider limits, representative cold/warm generation and rate limits. Noindex is a preview setting and provides no authentication.

Source reference: `jorphex/yHelper/yearn-wrapped` at `11f65daa98658bfa1bf7e0672e045577dd6f0560`. The source checkout is untouched. Private preview URLs belong in review conversations, never GitHub or pull request descriptions.

The header theme toggle uses yearn.fi’s shared theme colors and saved `yearn-theme` preference. It follows the device theme until a preference is saved; PNG exports use the selected palette.
