# yearn.fi

Yearn Finance vaults interface — Next.js 16 App Router + React 19 + TypeScript, TanStack Query, Tailwind CSS 4, Wagmi/Viem.

## Commands

```bash
bun install                              # Install dependencies
bun run dev                              # Next dev server on 127.0.0.1:3000
bun run preview                          # Next production server on 127.0.0.1:3000 after a build
bun run build                            # Next production build
bun run test                             # Full Vitest suite
bunx vitest run src/path/to/test.ts      # Single test file
bun run lint:fix                         # Biome format and fix
bun run tslint                           # TypeScript type check only
```

## Verification

IMPORTANT: After making code changes, always verify:
1. `bun run tslint` — type check passes
2. `bun run lint:fix` — code is formatted
3. Run relevant test file if one exists

Husky runs `lint-staged` + `bun run tslint` on every commit.

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

**Path aliases** (defined in tsconfig.json and next.config.ts):
- `@/*` → `src/*`
- `@shared/*` → `src/components/shared/*`
- `@pages/*` → `src/components/pages/*`
- `@components/*` → `src/components/*`

**Key directories:**
- `app/` — Next App Router pages, route handlers, metadata, redirects, and root layout
- `src/components/shared/` — shared library (contexts, hooks, utils, types, contracts)
- `src/components/pages/` — route pages (landing, portfolio, vaults)
- `src/server/` — focused API endpoint implementations and shared server-side helpers used by `app/api/**/route.ts`

**Key patterns:**
- Context provider chain defined in `App.tsx` — read that file for the full order
- Next route wrappers in `app/**/page.tsx` own route-level metadata and render client page components from `src/components/pages/`
- `src/navigation/` provides small client helpers backed by Next navigation context
- `/api/*` is served by explicit Next route handlers under `app/api/**/route.ts`; there is no catch-all API dispatcher
- Vault data flows through `useYearn` context → filtered/sorted via hooks in `@shared/hooks/`

## Multi-Chain

Supported chains configured in `src/components/shared/utils/constants.tsx`:
Ethereum (1), Optimism (10), Polygon (137), Fantom (250), Base (8453), Arbitrum (42161), Sonic (146), Katana (747474)
