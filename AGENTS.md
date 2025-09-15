# Repository Guidelines

## Project Structure & Module Organization

- Source lives in `src/` (app shell, routes, shared `components/`, `hooks/`).
- Feature code lives under `apps/` (`landing/`, `vaults/`, `vaults-v2/`, `vaults-v3/`, shared `lib/`).
- Public assets are in `public/`; Tailwind entry is `style.css`.
- Route entries exist in `pages/` (e.g., `pages/index.tsx`).
- Path aliases: `@components/*`, `@hooks/*`, `@lib/*`, `@vaults*/*`, `@landing/*`.

## Build, Test, and Development Commands

- `bun install` — install dependencies.
- `bun run dev` — start Vite dev server on `http://localhost:3000`.
- `bun run build` — type-check and build to `dist/`.
- `bun run preview` — preview the production build.
- `bun run test` — run Vitest in CI mode.
- `bun run lint` / `bun run lint:fix` — check/auto-fix with Biome.

## Coding Style & Naming Conventions

- Language: TypeScript (strict). React 19 + Vite.
- Formatting: Biome (2 spaces, single quotes, semicolons as needed, no trailing commas). Config in `biome.jsonc`.
- Components: PascalCase file names in `src/components/` and `*.tsx`.
- Hooks: `useXxx` in `src/hooks/`.
- Prefer alias imports (e.g., `import Button from '@components/Button'`). Avoid deep relative paths.

## Testing Guidelines

- Framework: Vitest (`vitest.config.ts`).
- Place tests near code using `*.test.ts`/`*.test.tsx` (examples in `apps/vaults-v2/...`).
- Run with `bun run test`. Prefer fast, deterministic unit tests; mock network and chain calls.
- For React tests, use Testing Library where applicable.

## Commit & Pull Request Guidelines

- Commit style: short, imperative subject. Common prefixes in history: `feat:`, `fix:`, `chore:`.
- Sign commits if possible (`git commit -S -m "fix: ..."`).
- PRs: include a clear description, linked issues, and screenshots/GIFs for UI changes. Ensure `bun run lint` and `bun run test` pass and the app builds.

## Security & Configuration Tips

- Copy `.env.example` to `.env`. Do not commit secrets.
- Vite exposes `VITE_` envs to the client. Avoid placing secrets in variables that become `import.meta.env.*`.
- Local dev proxies and env remapping are configured in `vite.config.ts` (see RPC URI mapping and `VITE_*` define behavior).
