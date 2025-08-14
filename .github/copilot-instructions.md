# yearn.fi AI Coding Agent Guide

This document provides essential context to help AI coding agents understand, navigate, and contribute to the yearn.fi codebase efficiently.

## 1. Architecture Overview
- Monorepo managed with Bun workspaces (`root/package.json` → `packages/*`).
- **packages/legacy**: Next.js 15 application—core UI, page routing, API routes (Open Graph, PWA).
- **packages/nextgen**: Vite + React component library—shared design system and utility components.
- Legacy app imports `@yearnfi/nextgen` for consistent UI.

## 2. Getting Started & Developer Workflows
- Install dependencies at root: `bun install`.
- Clean workspace: `bash clean.sh` (removes caches, lockfiles).
- Launch dev servers:
  - Legacy: `bun legacy` (runs `packages/legacy bun dev`).
  - Nextgen: `bun nextgen` (runs `packages/nextgen vite`).

## 3. Builds & Previews
- **Legacy build**:
  ```bash
  cd packages/legacy
  bun run build         # tsc && next build
  bun run start        # tsc && next build && next start
  ```
- **Nextgen build**:
  ```bash
  cd packages/nextgen
  bun run build         # tsc -b && vite build
  bun run preview       # vite preview
  ```

## 4. Linting & Type Checking
- Biome for formatting & linting:
  ```bash
  biome check .         # lint
  biome check --write . # fix
  ```
- TypeScript checks:
  ```bash
  tsc --noEmit         # individual package
  tsc -b               # monorepo build
  ```

## 5. Testing
- Vitest config:
  - `packages/legacy/vitest.config.ts`
  - `packages/nextgen/vitest.config.ts`
- Run tests:
  ```bash
  bun run test          # in each package
  ```

## 6. Conventions & Patterns
- **Styling**: Tailwind + Vanilla Extract.
  - Core Tailwind config in `packages/legacy/apps/lib/tailwind.config.cjs` & `tailwind.theme.cjs`.
- **Routing**: Legacy uses custom API routes under `pages/api/og/*` for OG image generation.
- **GraphQL**: GraphQL client in `packages/legacy/utils/graphqlClient.ts` using `graphql-request`.
- **Data fetching**: React Query via `@tanstack/react-query` inside custom hooks in `legacy/apps/*/hooks`.

## 7. Integration Points & External Services
- PWA manifest defined in `packages/legacy/public/manifest.json`.
- Next PWA plugin in `packages/legacy/next.config.js`.
- Analytics: `next-plausible` configured in `packages/legacy/next.config.js` & `_document.tsx`.

## 8. Key Configuration Files
- Root: `bunfig.toml`, `biome.jsonc`, `clean.sh`.
- Legacy:
  - `next.config.js`
  - `tsconfig.json` & `next-env.d.ts`
- Nextgen:
  - `vite.config.mts`
  - `tsconfig.app.json`

---

