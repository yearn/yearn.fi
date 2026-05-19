# Testing

The repo should keep unit tests where they have independent value: math, bigint conversions, state machines, safety checks, URL validation, and code paths where a wrong answer can silently cost users money or send them to the wrong place.

Use Playwright smoke tests for user-visible confidence: the app starts, public routes render, primary navigation works, and important workflows remain reachable.

Durable frontend/domain unit tests live in:

```text
src/test/
  math/
  transactions/
  api-contracts/
  formatting/
  vaults/
```

It is fine for an agent to write temporary colocated tests beside implementation files while work is in progress. Before handoff or commit, each touched colocated test should be deleted, converted into an E2E smoke path, or moved into the appropriate `src/test/` bucket if it protects durable behavior. API and script tests may stay colocated with their route/script boundary.

The Husky pre-commit hook enforces this for staged frontend/domain tests: `src/**/*.test.*` and `src/**/*.spec.*` files must live under `src/test/`. Deletions are allowed, and API, script, and E2E tests keep their own colocated homes.

## Commands

```bash
bun run test:e2e
bun run test:e2e:ui
```

`bun run test:e2e` starts the local Vite client and Bun API server through `bun run dev`. To run against an existing deployment instead:

```bash
PLAYWRIGHT_BASE_URL=https://your-preview-url.vercel.app bun run test:e2e
```

## Smoke Scope

Keep smoke tests small and stable:

- landing page loads and can navigate to vaults
- vaults page exposes search and list content
- portfolio page loads cleanly without a connected wallet
- add one new E2E path when a PR changes a critical public flow

Avoid turning Playwright into component testing. If the assertion is mostly checking copy, Tailwind classes, or implementation wiring, it probably belongs in neither E2E nor long-lived unit tests.

## Agent Verification

Before approving a UI or flow-heavy PR, ask an agent to run smoke verification against the PR preview or local branch:

```text
Smoke test this yearn.fi PR like a cautious user. Run bun run test:e2e, then manually inspect the changed flow in a browser. Report blockers first, then list any flaky or low-signal assertions you noticed. Do not approve based only on unit tests.
```

The agent should attach the Playwright report or describe the failing route, selector, console error, and screenshot/trace artifact. After a PR is approved, keep only tests that protect durable behavior; delete temporary tests that merely helped build the PR.

## Test Culling

Agents may create temporary tests while building. That is useful. Before handoff, the agent should cull those tests unless they protect durable behavior.

Run:

```bash
bun run test:cull
```

To inspect another cleanup commit or branch range:

```bash
bun run test:cull -- --commit a9938f1162e6729d4598db48a157a3ddfc1624f8
bun run test:cull -- --range main..feature-branch
```

For a sparing whole-repo audit:

```bash
bun run test:cull -- --all
```

Do not use `--all` as an end-of-turn hook. It is intentionally broader and noisier than the default changed-test report.

Then decide for each touched test:

- keep: protects durable math, safety, state, API, or validation behavior and belongs in `src/test/` for frontend/domain code
- convert: better covered as an E2E smoke path
- delete: only helped construct the PR or restates implementation details

Do not auto-delete tests from a hook. The hook/report should prompt review, because a filename heuristic cannot know whether a component test is secretly covering a safety-critical behavior.

## End-of-Turn Hook

If an agent system supports end-of-turn hooks, wire it to run:

```bash
bun run test:cull
```

Use the output as a required handoff checklist. The hook should fail only if the command itself errors; it should not block just because cull candidates exist.
