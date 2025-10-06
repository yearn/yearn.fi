# Repository Guidelines

## Project Structure & Module Organization
Yearn.fi runs on Vite with TypeScript. Shared scaffolding sits in `src/` (App shell, routes, shared components/hooks). Domain apps live in `apps/landing`, `apps/lib`, `apps/vaults`, `apps/vaults-v2`, and `apps/vaults-v3`, imported via aliases like `@lib` and `@vaults-v3` (see `tsconfig.json`). Route entrypoints stay in `pages/`, static assets live in `public/`, and build artifacts land in `dist/`.

## Build, Test & Development Commands
Install dependencies with `bun install`. Key scripts: `bun run dev` (local server at `http://localhost:3000`), `bun run preview` (production bundle), `bun run build` (tsc + Vite build), `bun run lint` / `bun run lint:fix` (Biome), `bun run test` (`-- --watch` for TDD), and `bun run clean` (reset caches and artifacts).

## Coding Style & Naming Conventions
Use TypeScript (`.ts`/`.tsx`) with 2-space indentation; rely on Biome for formatting and linting. Favor function components, typed props, and colocated hooks (e.g., `apps/vaults-v2/hooks`). Tailwind utility classes are the styling default; compose conditional classNames with `cl()`. Name components in PascalCase, files in kebab-case, and prefer the path aliases over deep relative imports.

## Testing Guidelines
Vitest drives the suite (`vitest.config.ts`) with React Testing Library support (`src/components/Link.test.tsx` is a reference). Co-locate specs as `*.test.ts[x]`. Ship new logic with focused unit or hook tests and add integration checks for vault flows. Always run `bun run lint` and `bun run test` before opening a PR; re-run affected specs after touching shared utilities.

## Commit & Pull Request Guidelines
Follow conventional commits: `<type>: <summary>` (examples: `feat: add new cowswap chains`, `chore: remove ethersjs`). Keep subject lines under ~72 chars and sign with `git commit -S` when possible. PRs should link issues, describe the change, and include screenshots or recordings for UI updates. Note environment tweaks and list verification commands (lint/test) for reviewers.

## Configuration & Environment Notes
Copy `.env.example` to `.env` for partner APIs; never commit secrets. Bun options live in `bunfig.toml`; path aliases and TS options in `tsconfig.json`. Deployment defaults come from `vercel.json`; review analytics toggles in `src/components/PlausibleProvider.tsx` before enabling new events.
