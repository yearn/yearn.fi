# yearn.fi AI Coding Agent Guide

This document provides essential context to help AI coding agents understand, navigate, and contribute to the yearn.fi codebase efficiently.

## 1. Getting Started & Developer Workflows

- Install dependencies at root: `bun install`.
- Clean workspace: `bash clean.sh` (removes caches, lockfiles).
- Launch dev servers:
  - `bun run dev`

## 2. Builds & Previews

- **Build**:
  ```bash
  bun run build         # tsc && next build
  bun run start        # tsc && next build && next start
  ```

## 3. Linting & Type Checking

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

## 4. Testing

- Vitest config:
  - `packages/vitest.config.ts`
- Run tests:
  ```bash
  bun run test          # in each package
  ```

## 5. Conventions & Patterns

- **Styling**: Tailwind + Vanilla Extract.
  - Core Tailwind config in `packages/legacy/apps/lib/tailwind.config.cjs` & `tailwind.theme.cjs`.
- **Routing**: Legacy uses custom API routes under `pages/api/og/*` for OG image generation.
- **GraphQL**: GraphQL client in `packages/legacy/utils/graphqlClient.ts` using `graphql-request`.
- **Data fetching**: React Query via `@tanstack/react-query` inside custom hooks in `legacy/apps/*/hooks`.

## 6. Integration Points & External Services

- PWA manifest defined in `packages/legacy/public/manifest.json`.
- Next PWA plugin in `packages/legacy/next.config.js`.
- Analytics: `next-plausible` configured in `packages/legacy/next.config.js` & `_document.tsx`.

## 7. Key Configuration Files

- Root: `bunfig.toml`, `biome.jsonc`, `clean.sh`.

---
