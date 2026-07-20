# Script Guidelines

The repository-level guidance in `../AGENTS.md` and `../CLAUDE.md` also applies
to this directory.

## Tenderly VNet safety

Tenderly Virtual TestNet (VNet) usage is expensive and consumes a limited
Tenderly Unit (TU) quota. Treat every VNet request as costly. Do not run a live
Tenderly script merely to inspect behavior, reproduce an old count, or perform
routine verification when mocks or static analysis can answer the question.

### Default to no live traffic

- Unit, integration, and browser-routing tests must mock RPC responses.
- Browser tests must intercept Tenderly hostnames and fail if any request would
  reach one.
- `--list`, help, parsing, reporting, and budget tests must work without
  credentials and without making network requests.
- Do not create, rotate, or replace a VNet as an incidental setup step. Only do
  so when the user explicitly requests it.
- Never run Tenderly smoke or full suites during routine implementation.
- Build and serve review previews with `NEXT_PUBLIC_TENDERLY_MODE=false`.
- Never print API keys, Admin RPC URLs, or other Tenderly credentials.

### Require narrow, explicit live scope

Every live QA runner must:

1. Require an explicit flow or suite selection. It must have no implicit live
   default.
2. Require a hard JSON-RPC method budget before reading credentials or making
   network requests.
3. Select one flow and one canonical chain by default.
4. Initialize additional chains only when the selected flow requires them.
5. Abort before sending a request that would exceed the remaining budget.

Use the smallest reviewed budget based on a previous measured run plus a small
margin. Do not choose a large budget simply to prevent a test from failing.
Running a multi-flow suite or adding a second chain requires deliberate review.

The safe discovery commands are:

```bash
bun run tenderly --help
bun scripts/tenderly-vnet-status.ts --help
```

This branch does not provide a general-purpose live QA suite. Do not treat the
generic Tenderly CLI or VNet status command as an implicit end-to-end runner.
Do not add or run a broad live suite unless the user explicitly asks for it and
approves an appropriately reviewed budget.

### Count requests accurately

All Tenderly JSON-RPC transports in a live QA script must pass through shared,
mock-tested budgeting logic. Do not add a direct `fetch`, Viem transport,
poller, or retry path that bypasses accounting.

Accounting must:

- Count both HTTP requests and individual JSON-RPC methods.
- Count every entry in a JSON-RPC batch, not just the enclosing HTTP request.
- Report counts per canonical chain and per method.
- Include polling, retries, setup, funding, snapshots, and cleanup.
- Reject unknown RPC methods before network I/O.
- Disable transport retries for live verification.
- Bound receipt polling and any other repeated request loop.
- Fail if an unexpected second chain is contacted.

When adding a new method, update the explicit allowlist and its mocked tests.
Do not weaken the allowlist to accept arbitrary methods.

### Snapshots and cleanup

Every stateful flow must isolate its mutations with a snapshot and guaranteed
revert:

- Reserve budget for both `evm_snapshot` and its matching `evm_revert` before
  creating the snapshot.
- Run the revert in `finally`.
- Keep the reserved cleanup available even when ordinary budget is exhausted.
- Count the cleanup within the same total method budget.
- Verify that `evm_revert` returned success.
- Fail the run if any cleanup reservation remains outstanding.

Never leave a shared VNet modified after a failed or interrupted flow. If code
cannot guarantee cleanup, do not run it against a live VNet.

### Choose VNet calls deliberately

Use the VNet for state that must reflect the simulation:

- Funding, snapshots, time travel, mining, and reverts.
- Transactions, receipts, traces, nonces, and transaction lookups.
- Balances, allowances, logs, previews, quotes, rewards, cooldowns, and block
  data that can change after simulated mutations.

Canonical APIs such as Enso or Kong may provide portfolio, routing, or metadata
data when simulation-specific state is not required. Do not redirect
transaction-critical reads to a default live-chain RPC: the live head can
differ from the VNet fork and produce invalid QA results.

Prefer eliminating redundant reads, caching immutable results within one flow,
and selecting fewer flows over mixing live and simulated chain state. Avoid
full-token-catalog balance multicalls; request only the contracts needed by the
active flow.

## VNet status checks

Transaction history is diagnostic and is not required to inspect live chain
state. Use the narrowest status query that answers the question:

```bash
bun scripts/tenderly-vnet-status.ts \
  --chain 1 \
  --transaction-mode none
```

Transaction modes have these costs:

- `none`: no transaction-history requests.
- `recent`: at most one transaction-history request per selected chain.
- `full`: up to 100 history pages per selected chain.

Use `none` for routine status checks. Use `recent` only when recent activity is
needed. Never use `full` unless the user explicitly requests a complete history
scan.

## Verification order

For Tenderly-related script changes:

1. Run focused mocked tests.
2. Run the broader mocked test suite with Tenderly mode disabled.
3. Run type checking and linting.
4. Perform a live flow only when it is explicitly required and authorized.
5. Print the final per-chain, method-by-method accounting and cleanup result.

A live verification fails if it exhausts its budget, uses an unexpected
method, contacts an unexpected chain, retries transport requests, or fails to
revert every snapshot.
