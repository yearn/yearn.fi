# Testing

The repo should keep unit tests where they have independent value: math, bigint conversions, state machines, safety checks, URL validation, and code paths where a wrong answer can silently cost users money or send them to the wrong place.

Use Playwright smoke tests for user-visible confidence: the app starts, public routes render, primary navigation works, and important workflows remain reachable.

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
