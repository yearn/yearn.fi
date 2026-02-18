# yearn.fi

Yearn Finance vaults interface — React 19 + TypeScript SPA (Vite, TanStack Query, Tailwind CSS 4, Wagmi/Viem).

## Commands

```bash
bun install                              # Install dependencies
bun run dev                              # Vite dev server (3000) + API server (3001)
bun run build                            # TypeScript check + Vite build
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
- `api/` — Vercel serverless functions (prod) / Bun dev server (local)

**Key patterns:**
- Context provider chain defined in `App.tsx` — read that file for the full order
- Vault data flows through `useYearn` context → filtered/sorted via hooks in `@shared/hooks/`
- Dual server: Vite (3000) proxies `/api/*` to Bun API server (3001). In prod, `api/` runs as Vercel serverless functions.

## Multi-Chain

Supported chains configured in `src/components/shared/utils/constants.tsx`:
Ethereum (1), Optimism (10), Polygon (137), Fantom (250), Base (8453), Arbitrum (42161), Sonic (146), Katana (747474)
