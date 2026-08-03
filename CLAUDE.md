# yearn.fi

Yearn Finance vaults interface — Next.js 16 App Router + React 19 + TypeScript, TanStack Query, Tailwind CSS 4, Wagmi/Viem.

## Commands

```bash
bun install                              # Install dependencies
bun run dev                              # Yearn dev server on 127.0.0.1:3000
bun run dev:ybold                        # yBOLD dev server on 127.0.0.1:3002
bun run preview                          # Yearn production server after a build
bun run build                            # Yearn production build
bun run build:all                        # Build the widget and both apps
bun run test                             # Yearn Vitest suite
bun run test:all                         # Widget and both app suites
bun run --cwd apps/yearn test src/path/to/test.ts  # Single Yearn test file
bun run lint:fix                         # Biome format and fix
bun run tslint                           # Yearn TypeScript check
bun run tslint:all                       # Type-check every workspace
bun run check:workspaces                 # Full widget and app validation
```

## Verification

IMPORTANT: After making code changes, always verify:
1. Run the scoped type check (`bun run tslint:yearn`, `bun run tslint:widget`, or `bun run tslint:ybold`)
2. `bun run lint:fix` — code is formatted
3. Run relevant test file if one exists
4. For widget changes, run `bun run check:vault-widget-boundary`

Use `bun run check:workspaces` when a change crosses package/app boundaries. Husky runs `lint-staged`, the client/server boundary check, and `bun run tslint` on every commit.

## Code Style

Formatting is enforced by Biome (biome.jsonc) — do not worry about indentation, quotes, or commas.

IMPORTANT: These rules are NOT enforced by tooling — you MUST follow them:
- NEVER use `let` — always use `const`
- NEVER use `for`/`while` loops — use `.map()`, `.filter()`, `.reduce()`
- NEVER use relative imports — use path aliases (`@/*`, `@shared/*`, `@pages/*`, `@components/*`)
- Use functional style code throughout

Naming:
- Components: PascalCase (`VaultListRow.tsx`)
- Hooks: `useFoo` (`useFilteredVaults.ts`)
- Utilities: camelCase (`format.ts`)
- Types: T-prefixed (`TSortDirection`, `TVaultType`)

### useEffect — prefer alternatives

Avoid `useEffect` when a better primitive exists. Most `useEffect` usage hides derived state, duplicates event handling, or re-implements what TanStack Query already provides.

**Prefer these instead:**
- **Derived state** — compute inline or with `useMemo` instead of `useEffect(() => setX(f(y)), [y])`
- **Event handlers** — do work directly in `onClick`/`onChange` instead of setting a flag for an effect to pick up
- **TanStack Query** — use `useQuery`/`useMutation` for data fetching, never `useEffect` + `fetch` + `setState`
- **`key` prop for reset** — use `<Component key={id} />` to remount instead of `useEffect` that resets state when an ID changes
- **Conditional rendering** — render children only when preconditions are met (e.g., `{!isLoading && <Player />}`) instead of guarding inside an effect

**When `useEffect` is acceptable:**
- One-time DOM/browser API setup on mount (IntersectionObserver, event listeners, focus)
- Third-party library lifecycle (init/destroy)
- Cases where no declarative alternative exists

When writing a new `useEffect`, add a brief comment explaining why an alternative does not apply.

## Architecture

**Tech stack:** Next.js 16 App Router, React 19, Tailwind CSS 4, TanStack Query, Wagmi/Viem/RainbowKit

**Workspace dependency direction:** `apps/*` may import `packages/*`; packages must not import apps. Both apps consume `@yearn/vault-widget` with `workspace:*`, and each Next config transpiles its TypeScript source.

**Yearn path aliases** (defined in `apps/yearn/tsconfig.json`):
- `@/*` → `apps/yearn/src/*`
- `@shared/*` → `apps/yearn/src/components/shared/*`
- `@pages/*` → `apps/yearn/src/components/pages/*`
- `@components/*` → `apps/yearn/src/components/*`
- `@hooks/*` → `apps/yearn/src/hooks/*`

The yBOLD app uses `@ybold/*` for files under `apps/ybold`. Package code uses its `@yearn/vault-widget/*` exports and must not use either app's aliases.

**Key directories:**
- `apps/yearn/app/` — main Next App Router pages, route handlers, metadata, redirects, and root layout
- `apps/yearn/src/` — Yearn product UI, data, server code, and host-specific adapters
- `apps/ybold/` — standalone yBOLD Next app and its host-specific adapters
- `packages/vault-widget/` — reusable widget UI, transaction flows, hooks, contracts, types, presets, and styles
- `scripts/` — repository-wide checks and operational scripts

**Key patterns:**
- Context provider chain defined in `apps/yearn/src/App.tsx` — read that file for the full order
- Next route wrappers in `apps/yearn/app/**/page.tsx` own route-level metadata and render client page components from `apps/yearn/src/components/pages/`
- `apps/yearn/src/navigation/` provides small client helpers backed by Next navigation context
- `/api/*` is served by explicit Next route handlers under `apps/yearn/app/api/**/route.ts`; there is no catch-all API dispatcher
- Vault data flows through `useYearn` context → filtered/sorted via hooks in `@shared/hooks/`
- Apps mount Wagmi and TanStack Query themselves, then adapt wallet, chains, prices, notifications, analytics, assets, routing, and policy through `VaultWidgetRuntimeProvider`
- `bun run check:vault-widget-boundary` enforces that widget source never reaches into a host app or outside its package

## Multi-Chain

Supported chains configured in `apps/yearn/src/components/shared/utils/constants.tsx`:
Ethereum (1), Optimism (10), Polygon (137), Fantom (250), Base (8453), Arbitrum (42161), Sonic (146), Katana (747474)
