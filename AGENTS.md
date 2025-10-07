# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the Vite entry (`main.tsx`), shared UI (`components/`), hooks, utils, and TypeScript types reused across apps.
- `apps/` bundles domain flows (`landing`, `vaults`, `vaults-v2`, `vaults-v3`); keep feature-specific state, styles, and assets inside these folders.
- `api/` delivers Vercel serverless handlers, while `public/` serves static assets and OG imagery. Keep generated artefacts like `dist/` out of git.

## Build, Test, and Development Commands
- `bun install` installs dependencies pinned by `bun.lock`.
- `bun run dev` launches the Vite dev server on port 3000.
- `bun run build` type-checks with `tsc` then bundles via `vite build`.
- `bun run preview` inspects the latest build; run `bun run clean` if output feels stale.
- `bun run lint` (or `bun run lint:fix`) executes Biome formatting and linting.
- `bun run test` runs the Vitest suite; add `--watch` while iterating.

## Coding Style & Naming Conventions
- Biome enforces 2-space indentation, single quotes, no trailing commas, and optional semicolons—format frequently with `bun run lint:fix`.
- Favor functional React components in PascalCase, hooks in `src/hooks` with `useFoo` names, and camelCase utilities from `src/utils`.
- Use explicit module imports and extract shared constants instead of duplicating literals across apps.

## Testing Guidelines
- Name files `*.test.ts(x)` and keep them near the unit under test (`src/components/Link.test.tsx` shows the pattern).
- Rely on Vitest with React Testing Library for UI assertions and stub remote data with lightweight fixtures.
- Add or update tests with every logic change and verify `bun run test` before requesting review.

## Commit & Pull Request Guidelines
- Follow the short-type convention (`fix: adjust APR formatting`, `chore: upgrade react`) and reference related issues or PRs (`(#742)`) when relevant.
- Sign commits (`git commit -S`) and push branches rebased on `upstream/main`.
- PRs should explain the change, mention env/config updates, and include before/after screenshots for UI work.
- Confirm linting and tests in the PR template and capture any follow-up actions in the description.

## Environment & Configuration
- Copy `.env.example` to `.env` when secrets are required; never commit real keys.
- Run `bun run clean` before `bun install` if dependencies drift or builds misbehave.
- Coordinate ABI or network updates with `apps/lib` maintainers to keep on-chain integrations stable.
