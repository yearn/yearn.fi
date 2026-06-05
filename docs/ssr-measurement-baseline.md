# SSR Measurement Baseline

Use this before and after each SSR improvement commit so the result is comparable.

## Workflow

```bash
bun run build
bun run preview
```

In another terminal:

```bash
bun run measure:ssr
```

If preview is running on another host or port:

```bash
BASE_URL=http://127.0.0.1:3001 bun run measure:ssr
```

To measure only build artifacts and client chunks:

```bash
SKIP_LIVE=1 bun run measure:ssr
```

## What It Measures

- Static HTML artifacts for `/` and `/vaults`.
- Whether expected route text is present in generated HTML or live responses.
- Live preview response timings for `/`, `/vaults`, and one vault detail route.
- Aggregate `.next/static/chunks/*.js` size and the largest chunks.

The live timings are local smoke numbers, not lab-grade performance scores. Use them to catch regressions and compare directionally between adjacent SSR commits.
