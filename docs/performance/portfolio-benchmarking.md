# Portfolio benchmarking

This branch makes the `/portfolio` performance work reproducible from a direct URL instead of a manually connected wallet.

## Wallet profiles

Profiles live in `scripts/portfolioBenchmarkConfig.ts`:

- `heavy` — Yearn Treasury
- `medium` — SA Treasury
- `light` — galloway.eth

## Direct Codex wallet URL contract

Use this shape for browser runs:

```text
/portfolio?codexWallet=1&codexWalletAddress=<wallet-address>
```

`codexWalletAddress` is persisted to localStorage so reloads remain on the selected profile.

For production-like previews, set `VITE_CODEX_WALLET=true`; otherwise the Codex wallet remains disabled in `import.meta.env.PROD`.

## API benchmark runner

Start the API server, then run:

```bash
PORTFOLIO_BENCHMARK_API_BASE_URL=http://127.0.0.1:3001 bun scripts/portfolioApiBenchmark.ts
```

The runner times each benchmark wallet against the portfolio API endpoints used on first load and writes JSON to `docs/performance/portfolio-benchmarks/`.

## Report generator

```bash
bun scripts/portfolioBenchmarkReport.ts docs/performance/portfolio-benchmarks/api-<timestamp>.json
```

The report includes direct browser URLs for each wallet and the API timing rows.

## Browser benchmark runner

`codexWalletAddress` makes browser automation deterministic. Any browser harness should load each generated direct URL and capture:

- time to stable shell
- time to first holdings rows or confirmed empty state
- time to history chart usable state
- console errors and failed requests
- screenshots at 0s, 2.5s, 7.5s, and final loaded state

The existing visual-state regression helper is `src/components/pages/portfolio/hooks/portfolioDisplayState.test.ts`.
