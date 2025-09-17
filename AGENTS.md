# Repository Guidelines

## Project Structure & Modules

- Root: Bun workspaces with `packages/*` and shared config.
- `packages/legacy`: Next.js app (TypeScript). Key dirs: `pages/`, `apps/`, `public/`.
- `packages/nextgen`: Vite + TypeScript component package. Key dirs: `src/`, `public/`.
- Tooling: Biome (`biome.jsonc`), Husky + lint-staged, GitHub Actions in `.github/`.

## Build, Test, and Run

- Install: `bun install`
- Clean: `bun clean [--lockfiles]` (removes `node_modules`, builds, caches).
- Run legacy app: `bun legacy` (or `cd packages/legacy && bun dev`).
- Run nextgen package: `bun nextgen` (or `cd packages/nextgen && bun dev`).
- Build:
  - Legacy: `cd packages/legacy && bun run build` then `bun run start`
  - Nextgen: `cd packages/nextgen && bun run build`
- Tests (legacy): `cd packages/legacy && bun run test`
- Lint/format: `cd packages/<pkg> && bun run lint` or `bun run lint:fix`

## Coding Style & Naming

- Language: TypeScript + React.
- Formatting (Biome): 2-space indent, single quotes, semicolons as needed, no trailing commas, line width 120.
- File naming: use `camelCase` for files, `PascalCase` for React components, `kebab-case` for routes/assets.
- Imports: prefer absolute aliases in legacy (`@lib`, `@vaults*`) where configured.

## Testing Guidelines

- Framework: Vitest (legacy). React Testing Library available for UI tests.
- Location: co-locate tests near sources; name `*.test.ts`/`*.test.tsx`.
- Run locally: `cd packages/legacy && bun run test`.
- Aim for deterministic unit tests around data transforms, hooks, and utilities.

## Commit & PR Guidelines

- Commits: follow Conventional Commits (`feat:`, `fix:`, `chore:`, etc.). Keep messages concise and imperative.
- Branches: small, focused changes; rebase on `main` when possible.
- Pull Requests: use the template. Include description, linked issues, testing notes, and screenshots for UI.
- CI: PRs run lint and security checks (CodeQL, dependency review). Fix lints before review; Husky runs lint-staged and type checks pre-commit.

## Security & Config

- Env: copy `.env.example` to `.env` within each package; never commit secrets.
- Add new env vars to the corresponding `.env.example` and document usage in the package README.
