# Transaction lifecycle implementation progress

Branch: `codex/transaction-lifecycle-v2`, based on `main` at `afd41bcb`.
Design: [v2 proposal](./v2-transaction-lifecycle.md).

Each completed stage must preserve existing supported transaction flows and equivalent normal UX.
Unmigrated paths keep their existing implementation. Document intentional failure/status changes and
verify the affected flows with controlled wallet QA before rollout. Stage 1 passes automated validation,
but end-to-end transaction and UX parity has not yet been established with actual wallets.

## Stage 1: bounded reliability fixes

Implemented:

- Shared source confirmation policy: two confirmations on Base, one elsewhere. The legacy overlay,
  Yearn execution adapter configuration, and EOA/Safe background reconciliation use this policy.
  RPC reads use the execution chain; confirmation depth uses the canonical chain.
- EOA, Safe-service, and wallet-reported execution hashes converge on one receipt settlement path.
  Safe internal failure remains failure even when its outer transaction succeeds. Stale hash results
  and results arriving after unmount are discarded.
- Source confirmation and bridge delivery are saved before background balance refresh starts.
  Background refresh cannot block other tracking. Overlay and planned refresh waits have a ten-second
  deadline. A refresh failure displays “Transaction confirmed” with Close, preserving the successful
  notification and offering no transaction resubmission.
- Delivered bridge links select a complete destination hash/chain pair, falling back to the complete
  source reference when destination information is incomplete.
- Bridge selection checks the least recently checked record, with stable ID ordering for ties.
- The wallet indicator derives from the current wallet's cached records, including after reload.
  Active/unresolved records take priority over terminal outcomes. Metadata-only updates cannot clear it.
  During this migration, terminal failure/success indicators expire after five minutes; persistent
  acknowledgement is deferred to the canonical record model.

Regression coverage includes confirmation depth across all three source paths, Safe internal failure,
refresh rejection/timeouts, bridge scheduling after a stalled refresh, stale observations, incomplete
explorer references, concurrent notifications, account switching, hydration, deletion, and indicator expiry.

## Next: one complete same-chain path

Stage 2 will introduce the shared runner, provider-scoped tracker, canonical records/reducer, and shared
presentation selectors for direct and raw Enso submissions. Both in-memory and durable hosts must work.
Migrated paths must stop writing through the legacy lifecycle.

The full v2 engine is not implemented yet. Cross-tab ownership, storage stall recovery, unified proposal
and approval tracking, settlement normalization for arbitrary protocols, credential-wide gateway limits,
refresh-only recovery controls, and versioned record migration remain later stages. Polling still uses
legacy notification records and React hook lifetimes. No live wallet, Safe, or bridge transaction has
been submitted as part of this validation.

## Validation of this stage

- 221 focused tests passed across 20 test files (161 widget, 60 Yearn).
- Yearn, yBOLD, and widget TypeScript checks passed.
- Biome formatting and the widget package boundary check passed.
- Production build passed with a fresh Turbopack cache after a sandbox worker-port failure.
- The private HTML implementation review passed Chromium desktop/mobile checks.
