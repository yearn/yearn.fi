# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the top-level React shell, routing, and cross-app utilities. Feature-specific bundles live under `apps/` (e.g. `apps/vaults-v2`, `apps/landing`) and expose components consumed by the shell via path aliases declared in `tsconfig.json`. Serverless handlers for production deploys sit in `api/`, while static marketing content remains in `pages/` and raw assets go in `public/`. Generated output lands in `dist/`; treat it as build artefacts only.

## Build, Test, and Development Commands
Install dependencies with `bun install`. Use `bun run dev` for the full local experience, and `bun run dev:ts` when you only need the type-checker. Ship-ready builds require `bun run build`; validate output locally with `bun run preview`. Keep the tree clean with `bun run clean`. Run `bun run lint` (or `bun run lint:fix` to apply safe rewrites) before every PR, and gate changes with `bun run test`.

## Coding Style & Naming Conventions
Code is TypeScript-first with React function components. Follow the existing two-space indentation, `camelCase` utilities, and `PascalCase` component or hook exports (prefixed with `use` for hooks). Prefer the Tailwind utility patterns already in use. Let Biome manage formatting and linting; avoid manual tweaks that fight its rules. Rely on the configured import aliases (`@landing`, `@lib`, `@vaults-v2`, etc.) instead of deep relative paths.

## Testing Guidelines
Vitest powers the suite. Add colocated `*.test.ts(x)` files beside the code under test (see `src/components/Link.test.tsx`). Use React Testing Library helpers for behavioural tests and mock network calls through existing fixtures in `apps/vaults-v2`. Run `bun run test` for CI-parity checks; during development `bun x vitest watch` keeps feedback fast.

## Commit & Pull Request Guidelines
Adopt Conventional Commit prefixes (`feat:`, `fix:`, `chore:`) as seen in `git log`. Sign commits with `git commit -S` and keep messages focused on the change impact. Every PR should summarize intent, link to the relevant issue or spec, and include screenshots or recordings for UI updates. Confirm lint, build, and test commands succeed locally before requesting review.

## Environment & Deployment Notes
Copy `.env.example` to `.env` for local secrets; fall back to the defaults in `vercel.json` when keys are absent. Production deploys target Vercel, so avoid adding server-only dependencies unless they compile under its edge/runtime constraints. Guard any new configuration knobs behind sensible defaults to keep preview deployments stable.
