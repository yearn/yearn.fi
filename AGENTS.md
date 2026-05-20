# yearn.fi

Yearn Finance vaults interface — React 19 + TypeScript SPA (Vite, TanStack Query, Tailwind CSS 4, Wagmi/Viem).

## Commands

```bash
bun install                              # Install dependencies
bun run dev                              # Vite dev server + Bun API server; prompts for an API port when needed
bun run preview                          # Vite preview + Bun API server; prompts for an API port when needed
bun run build                            # TypeScript check + Vite build
bun run test                             # Full Vitest suite
bun run test:e2e                         # Playwright smoke tests
bunx vitest run src/path/to/test.ts      # Single test file
bun run lint:fix                         # Biome format and fix
bun run tslint                           # TypeScript type check only
bun run test:cull                        # End-of-turn report for touched tests
```

## Verification

IMPORTANT: After making code changes, always verify:
1. `bun run tslint` — type check passes
2. `bun run lint:fix` — code is formatted
3. Run relevant test file if one exists
4. For route, UI flow, or public page changes, run `bun run test:e2e`
5. If tests were added or changed, run `bun run test:cull` and cull temporary/low-signal tests before handoff

## Testing Strategy

Prefer fewer, higher-signal unit tests. Keep Vitest coverage for math, bigint/share conversions, APY/APR calculations, transaction state machines, URL validation, safety checks, API handlers, and logic with independently meaningful expected values. Avoid long-lived tests that simply mirror component structure, copy, Tailwind classes, route-string mappings, config snapshots, or boolean wrappers around production conditions.

Use Playwright for smoke coverage of real user-visible flows. Before approving UI-heavy PRs, ask an agent to smoke test the preview or local branch with `bun run test:e2e` plus a manual browser pass over the changed flow. Temporary tests created while building a PR are fine, but after approval keep only tests that protect durable behavior.

Durable frontend/domain tests live under `src/test/{math,transactions,api-contracts,formatting,vaults}`. Agents may create temporary colocated tests beside implementation files while building. Before handoff, run `bun run test:cull` and decide for every touched test: move durable frontend/domain coverage into `src/test`, convert user-visible behavior to E2E smoke coverage, or delete temporary/low-signal tests. API and script tests may stay colocated with their route/script boundary. An end-of-turn hook may run `bun run test:cull` as a reminder/report, but it should not auto-delete tests; deletion requires agent or human judgment.

The Husky pre-commit hook blocks staged frontend/domain tests under `src/` unless they live in `src/test/`. This keeps colocated tests available during implementation while forcing a deliberate keep/delete/move decision before commit.

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

**Tech stack:** React 19, Vite, React Router (lazy-loaded), Tailwind CSS 4, TanStack Query, Wagmi/Viem/RainbowKit

**Path aliases** (defined in vite.config.ts):
- `@/*` → `src/*`
- `@shared/*` → `src/components/shared/*`
- `@pages/*` → `src/components/pages/*`
- `@components/*` → `src/components/*`

**Key directories:**
- `src/components/shared/` — shared library (contexts, hooks, utils, types, contracts)
- `src/components/pages/` — route pages (landing, portfolio, vaults)
- `src/test/` — curated durable frontend/domain Vitest coverage
- `e2e/` — Playwright smoke tests for public user-visible flows
- `api/` — Vercel serverless functions (prod) / Bun dev server (local)

**Key patterns:**
- Context provider chain defined in `App.tsx` — read that file for the full order
- Vault data flows through `useYearn` context → filtered/sorted via hooks in `@shared/hooks/`
- Dual server: `bun run dev` starts Vite plus a Bun API server and keeps `/api/*` proxied to the selected API port. In prod, `api/` runs as Vercel serverless functions.

## Multi-Chain

Supported chains configured in `src/components/shared/utils/constants.tsx`:
Ethereum (1), Optimism (10), , Base (8453), , Katana (747474). 
Polygon (137), Arbitrum (42161), and Fantom (250) are mostly deprecated. 

## GitHub PR workflow

- For GitHub write operations in this repo, prefer GitHub CLI (`gh`) over the Codex GitHub connector.
- For pull request creation, use `gh pr create` by default.
- Do not use `codex_apps.github_create_pull_request` / `mcp__codex_apps__github_create_pull_request` unless the user explicitly asks to test or debug the connector.
- You may still use GitHub connector tools for read-only lookup when useful.
