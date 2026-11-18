# Yearn Wrapped: source review and TypeScript migration plan

Status: working first version implemented and verified; calendar-year percentage return selected, November 17, 2026. Branch: `ross/yearn-wrapped`, based on yearn.fi `a12638e9a90481dd95092122d21406219e1242a5`. The working app is in `apps/wrapped`; run and validation guidance is in `apps/wrapped/README.md`. Production routing is pending release review.

## Implementation direction from the user

The active goal is to implement and verify a working Wrapped app. Where collection differs, use yearn.fi's existing collection, event normalization, pricing, caching and coverage conventions. Stop to discuss unclear choices. This direction supersedes the source-parity recommendations below: do not build a second prototype-compatible Envio collector, five-chain restriction, Kong USD-price pipeline or transfer-only balance engine.

Use the main site's normalized V2/V3 events, supported holdings chains, hidden-vault/staking handling, historical prices from yearn-prices and settled-day convention. Prefer existing public API contracts; add any required annual data capability to the existing server layer rather than duplicating its calculations in Wrapped.

Initial inspection confirmed that the portfolio API returns settled balance history, protocol-return history and per-vault growth. The public timeframe choices are `1y` and `all`, not a calendar year. Per-vault `growthUsd` is not a calendar-year earnings field, and protocol-return history also exposes a Growth Index. Filtering the dates of the response does not turn its lifetime growth totals into annual dollar yield.

Decision resolved by the user: calendar-year percentage return first. Original decision context: should the headline use a calendar-year return derived from the existing Growth Index, or should the first version also include an explicit calendar-year USD yield metric? The latter needs a specified period baseline and valuation convention in the existing holdings engine. Recommendation for the smaller first version: use the existing Growth Index with a December 31 baseline and retain incomplete-data handling; do not relabel lifetime dollar growth as earnings for 2026. Confirm whether retaining the prototype's annual dollar headline is a launch requirement.

## Original review and proposed sequence

The sections below record the original review. The implementation direction above and `apps/wrapped/README.md` describe the delivered first version.

### Recommendation

Add a standalone Next.js App Router application at `apps/wrapped`, following the workspace conventions used by `apps/ybold` and `apps/4626`. Port the accounting and HTTP service to TypeScript and the existing browser UI to React/TypeScript. Preserve the source's visual direction, financial definitions, conditional cards and exports before adding new features.

Use existing shared wallet UI and Viem for wallet connection and ENS. Keep Wrapped's business logic inside the app initially. Consume the main site's holdings API through a server adapter; do not import `apps/yearn` internals into another application or extract its entire holdings system merely to launch Wrapped.

The first implementation milestone should produce a fixture-backed app preview and a tested TypeScript share ledger. Live generation follows once upstream compatibility and the runtime budget are measured.

## Source and review boundary

- Reference: [jorphex/yHelper/yearn-wrapped](https://github.com/jorphex/yHelper/tree/11f65daa98658bfa1bf7e0672e045577dd6f0560/yearn-wrapped), pinned to remote main `11f65daa98658bfa1bf7e0672e045577dd6f0560` during this review.
- Inspected the source service, ledger, recap builder, design/build guidance, payload validator, replay logic, export implementation and verification scripts. Compared remote file hashes against the local sibling checkout before using it as a reading reference. Remote `site/main.js` differs and was read from GitHub; remote also adds `tests/verify_ens.cjs`. The sibling checkout has local edits and remains untouched.
- Target references: `CLAUDE.md`, root workspace scripts, yBOLD/4626 app configuration, wallet package exports, holdings documentation/event code, API routes and CI/deployment workflows.
- This is a source and architecture review. Existing tests were inspected, not executed. Upstream schemas, live recap correctness, performance and browser behavior still need verification. Shipped JSON samples are fixtures, not current financial answers.

## What already exists

| Source | Responsibility | Migration |
| --- | --- | --- |
| `service.py` | FastAPI transport, validation, caching, request coalescing, build queue, deadlines | Node route handler and bounded server service |
| `tools/positions.py` | Chain-aware share ledger, daily series lookup, estimated yield and peaks | Pure TypeScript modules with deterministic fixtures |
| `tools/recap.py` | Event fetching, upstream adapters, period calculations, card payload and editorial rules | Separate adapters, metrics, payload assembly and editorial functions |
| `tools/medians.py` | Offline recent-depositor cohort snapshot | Optional TypeScript maintenance script after core parity |
| `site/main.js`, `index.html` | Wallet/address/ENS entry and landing handoff | React landing with shared wallet UI and Viem ENS |
| `site/replay.js`, `payload.js` | Conditional story deck, navigation, validation | Typed card selector, React deck and runtime payload validation |
| `site/share.js`, `charts.js` | Canvas PNG export and chart geometry | TypeScript export/chart helpers shared with card models |
| `hero.js`, `boot3d.js`, `symbol3d.js`, `nebula.js`, `motion.js` | Three.js scenes, loader, startup and pointer motion | Lazy client graphics with lifecycle cleanup and static fallback |
| `site/assets`, CSS, `DESIGN.md` | Fonts, official symbol/contour, lockup, responsive design | App assets and scoped styles; preserve the existing direction |
| `tests/*` | HTTP, accounting, deadline, accessibility, startup, sharing and browser checks | Vitest for logic/service; browser checks for actual user behavior |

This is not a Python-only prototype. The main Python builder is about 1,700 lines; the browser code includes a roughly 1,500-line replay controller plus separate graphics/export modules. A literal monolithic translation would carry unnecessary coupling into React.

## Product behavior to preserve

1. Enter an EVM address or resolve ENS, or connect a wallet to supply an address. The recap requires no signature or transaction. Manual lookup must work without connecting.
2. Generate a 2026 story, ending at build time during the year and at December 31, 23:59:59 UTC after year end. Keep first-ever activity distinct from activity in the recap year.
3. Build cards conditionally from available data: identity/tenure, market context, vaults/chains, home base, deposits/exits, holding streaks, estimated yield, valuation curves, rhythm, chapters, verdict and summary. Preserve the counterfactual's assumptions wherever shown.
4. Support direct recap links, refresh, retry, keyboard navigation, swipe and dense-card scrolling. Keep invalid input, no indexed history, unsupported year, missing optional data, busy service and failed upstreams distinct.
5. Show sample data only through an explicit demo entry. A failed real-wallet request must never display a sample recap as its result.
6. Preserve PNG save/copy/share and matching on-screen/export chart scales. Identity cards cannot be exported. Other exported images and captions omit raw addresses and wallet query strings; shared financial facts may still identify a wallet.
7. Keep the Yearn typography, official symbol/lockup, graphics and responsive visual hierarchy. Reduced motion disables continuous graphics; failed/late WebGL resolves to a stable static scene.

## Data and accounting boundaries

| Source | Existing use | Required check |
| --- | --- | --- |
| Envio GraphQL | Four event histories: Deposit owner, Withdraw owner, Transfer sender/receiver | Verify deployed schema, address casing, deterministic pagination, timestamp boundaries and caps |
| yearn.fi `/api/holdings/portfolio?timeframe=all&denomination=usd` | Daily balance history and vault/asset metadata | Validate response shape, completeness, settled-day timing and chain coverage |
| yearn.fi `/api/holdings/history` | Fallback when portfolio has no balance object | Preserve fallback semantics and do not turn a failed lookup into no history |
| Kong PPS and TVL `components=priceUsd` series | Daily PPS and historical underlying price | Verify units, timestamp parsing, coverage, ordering and stale-observation rules |
| CoinGecko ETH market chart | Optional wallet-independent market context | Confirm historical availability/rate limits; omit when unavailable |
| `data/medians.json` | Optional active-wallet comparison | Snapshot is dated October 22, 2026, n=132, ledger version 2; show provenance or omit |

Financial acceptance rules:

- Position identity includes chain ID and normalized vault address. Use `bigint` for raw shares/assets and serialize them as decimal strings across JSON boundaries. Audit the existing payload's raw integer timeline fields, which can exceed JavaScript's safe integer range. This requires an explicit wire-contract revision rather than silently rounding version-1 payloads.
- Transfers alone reconstruct the prototype's share balances, including mint/burn and received shares. Deposit/Withdraw events supply counts and underlying flows. Net simultaneous incoming/outgoing deltas before sampling, and seed opening balances from pre-year events.
- Estimate vault yield only while shares are held, using daily PPS changes and contemporaneous underlying USD prices. Label it estimated vault yield, not personal profit. Preserve negative returns and genuine zeroes.
- Never add unrelated raw asset amounts into one total. Missing decimals/prices/PPS retain nulls and incomplete flags. Use the latest observation at or before the requested timestamp, with the source's two-day freshness bound.
- Rank a home-base vault monetarily only when compared positions have complete pricing. Preserve the source's non-monetary single-vault fallback.
- Withdrawal counterfactuals assume withdrawn shares stayed deposited; require comparable exit/end PPS and endpoint prices. Incomplete coverage cannot produce an apparently complete aggregate.
- Preserve coverage reasons in the payload and visible qualifiers in stories/exports. Cohort medians describe sampled active wallets, not population percentiles.

## Important integration differences

**Event pipelines are not interchangeable.** Wrapped currently limits its event scope to Ethereum, Base, Arbitrum, Polygon and Katana, and declares V2 coverage incomplete. The main holdings service combines V2/V3 events, removes mint/burn transfers already represented by deposits/withdrawals, maps staking families, and excludes hidden vaults. Feeding that normalized event stream into Wrapped's transfer-only ledger would change balances. Start with source-compatible adapters; decide on broader coverage and unified semantics explicitly after parity tests.

**Period endpoints differ.** Wrapped ends at the current timestamp; holdings history contains settled UTC days only and `timeframe=all` begins in 2024. A balance curve can legitimately end before the recap boundary. Display the actual coverage and do not imply a daily portfolio curve includes intraday values or proves complete lifetime history.

**Source pricing differs from main-site holdings.** Wrapped estimates yield with Kong underlying-price series; the main holdings pipeline uses yearn-prices and handles nested vault assets. Do not promise numeric agreement or replace one with the other during a mechanical port. Compare fixtures/live outputs and document any deliberate change.

**The server model needs validation.** The source permits 180-second builds plus a 30-second queue, two active builds, eight pending/active keys, and process-local caching/coalescing. It also writes upstream caches to disk. These controls assume a single persistent worker. A Next/serverless deployment must not rely on local memory/disk for global limits or durable cache correctness.

**Wallet and ENS should use repo infrastructure.** The prototype initializes its own WalletConnect provider and remotely imports Ethers for ENS. Use `@yearn/wallet-ui` with app-owned Wagmi/Query providers and Viem instead. Preserve lookup caching and protection against late ENS results replacing newer input. Configure the app's WalletConnect identity/domain rather than copying the prototype's project ID.

## Proposed app layout

```text
apps/wrapped/
  app/                         layout, landing, replay route, API route handlers
  components/                  entry, deck, cards, loading/error states
  lib/recap/                   contract, ledger, daily series, metrics, card selection
  lib/export/                  canvas rendering and common chart models
  lib/graphics/                lazy client scenes and startup coordinator
  server/adapters/             Envio, holdings, Kong and optional market context
  server/recap/                assembly, deadlines, cache and concurrency
  public/                      Yearn fonts, lockup, symbol and contour
  tests/fixtures/              deterministic events, series and expected recaps
```

Use app aliases, T-prefixed types, functional transforms and Query for client fetching per `CLAUDE.md`. A scene mount/dispose effect is appropriate for Three.js lifecycle and must explain that use. App-local modules need no new shared package yet. Add Three.js only after dependency policy review; retain existing versions for already available workspace dependencies.

## Implementation sequence and exit criteria

### 1. Freeze contracts and accounting expectations

- Capture the pinned source contract, payload/card inventory and deterministic upstream fixtures. Fix the clock so year-to-date tests cannot change each day.
- Define TypeScript types plus runtime validation at external boundaries; decide the raw-integer serialization revision before authoring the new client.
- Turn existing independent accounting expectations into TypeScript fixtures: pre-year holdings, full exit, self transfer, same vault address on two chains, transfer-funded position, unknown decimals, missing/stale prices, mixed assets, negative yield, year boundaries and pagination limits.
- Verify live endpoint shapes and configured indexer access without committing wallet results or credentials.
- Exit: documented wire contract and independently checked expected numbers; no lossy raw-integer conversions.

### 2. Add the app shell and fixture-backed story

- Create the Next/React/TypeScript workspace app, configuration, fonts/assets, app aliases and optional environment template.
- Add `dev/build/preview/tslint/test/check:wrapped` scripts; include the app in aggregate workspace checks and dependency lockfile.
- Port entry, deck/card selection, loading/failure states and exports against deterministic fixtures. Integrate shared wallet connection and Viem ENS.
- Port graphics lazily, retain static/reduced-motion behavior, and keep essential entry controls available when graphics fail.
- Exit: a production-build preview supports desktop/mobile story navigation and PNG exports; explicit demo labeling remains visible.

### 3. Port calculations and generation transport

- Implement the pure share ledger, daily lookup, growth/peak metrics, holding spans, period filters and editorial/card assembly in TypeScript.
- Add bounded server adapters with retries inside one shared cancellation deadline. Keep required-source failures distinct from optional context gaps.
- Expose a source-compatible recap request surface initially; preserve status meanings, `Retry-After` and private/no-store browser headers.
- Compare TypeScript payloads against frozen Python outputs and independent expectations; numerical tolerances apply only to documented derived decimals, never raw balances.
- Exit: fixture parity and transport/deadline tests pass; real samples expose coverage differences rather than conceal them.

### 4. Prove live runtime behavior and choose the deployment model

- Measure cold/warm builds for representative sparse, transfer-funded, many-vault and capped-history wallets. Include nested holdings request duration and concurrent distinct requests.
- Confirm the actual hosting duration/memory limits and required rate limits. Prefer a bounded request/response route only if measurements fit with headroom.
- If generation cannot reliably finish within those limits, use durable job state and a polling result API backed by an appropriate worker. Do not simulate background jobs with an unawaited promise after returning a route response.
- For horizontally scaled serving, use shared result caching and coordination if required by measured load; version keys by normalized address, recap year, contract/calculation version and period policy. Separate partial-year freshness from finalized-year snapshots. Validate cache values on read.
- Exit: documented measured budget, cold/warm/concurrency behavior, cancellation, bounded queues and correct expiry. The runtime decision is resolved before enabling public live generation.

### 5. Release integration and acceptance

- Add the app to deployment workflow path filters/jobs only after app validation; use its own Vercel app root/project if retaining the standalone pattern.
- Decide public URL separately from workspace placement. Recommended initial shape: standalone app with an entry link on yearn.fi. Serving specifically under `yearn.fi/wrapped` requires tested routing/base-path and API/static-asset integration; do not assume adding a workspace exposes that path.
- Run lint/type checks, relevant Vitest suites, package boundary checks and a production build. Verify actual wallet/ENS entry, refresh, retries, sharing, 320px reflow, keyboard/focus, reduced motion and WebGL failure. Review slide/PNG pairs for values, labels and qualifiers.
- Verify cache misses/hits, coalescing, invalid address/year, no-history, upstream failure, busy/timeout and malformed payloads. Keep live-wallet checks distinct from deterministic fixture checks.
- Exit: private preview evidence and explicit production routing/configuration. Preview links stay outside GitHub/PR text.

## Scope and decisions to settle

For the first release, assume 2026 only and preserve the existing five-chain scope with visible V2 limitations. Automatic cohort collection, broad holdings-system extraction, new chain/staking support, new financial metrics and redesign are follow-up work.

Before release, settle the desired public URL; whether V2/staked positions are launch requirements; whether the withdrawal counterfactual and dated cohort comparison should ship; and the hosting/cache approach supported by measured generation time. The recommended first coding slice is stages 1–2 with the pure ledger from stage 3.
