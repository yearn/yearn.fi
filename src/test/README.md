# Durable Tests

This directory is the curated home for frontend/domain Vitest coverage that should survive beyond a single PR.

```text
src/test/
  math/           bigint, valuation, APY/APR, slippage, and precision rules
  transactions/   transaction state, quotes, approvals, Safe flows, rewards, and polling
  api-contracts/  schemas, route/query normalization, URL safety, and backend response contracts
  formatting/     user-visible formatting rules for money, percentages, fees, and compact values
  vaults/         durable vault and portfolio domain behavior that is not purely math
```

Agents may create temporary colocated tests beside implementation files while building. Before handoff or commit, delete temporary tests, convert user-visible behavior to E2E smoke coverage, or move durable frontend/domain coverage into one of these buckets.
