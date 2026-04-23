# Manual vs DOA Allocation History Research

As of 2026-04-23 UTC.

## Summary

The current Sankey/reallocation UI is not a full allocation history view. It is a DOA-history view from Redis with one live Kong snapshot appended at the end.

That means:

- Redis is only authoritative for optimizer-produced DOA snapshots.
- Kong is authoritative for current live allocation state.
- Kong public APIs are not currently a full public allocation-change feed.
- To show manual allocation changes alongside DOA-driven ones, we need a canonical on-chain event timeline, not just Redis plus one live snapshot.

## What The App Does Today

Current `yearn.fi` behavior:

- `src/components/pages/vaults/hooks/useVaultRecentReallocations.ts` fetches `/api/optimization/change?vault=...&history=1`.
- The same hook builds `currentAllocation` from `currentVault.strategies[].details.debtRatio` coming from Kong.
- `src/components/pages/vaults/utils/reallocations.ts` compares the latest Redis state with the live Kong state and either:
- shows the latest Redis state with the current timestamp if they match, or
- adds one extra final panel from the last Redis state to the live Kong state if they do not.

Implication:

- This is only enough to detect "current state differs from the latest DOA snapshot".
- It is not enough to explain how or when manual changes happened.

Relevant local files:

- `src/components/pages/vaults/hooks/useVaultRecentReallocations.ts`
- `src/components/pages/vaults/utils/reallocations.ts`
- `api/optimization/_lib/redis.ts`
- `api/optimization/_lib/envio.ts`

## What Each Data Source Tells Us

### Redis

Redis keys are `doa:optimizations:*`.

The payload stores optimizer snapshots:

- vault
- `strategyDebtRatios[].currentRatio`
- `strategyDebtRatios[].targetRatio`
- explain text
- timestamp metadata derived from the Redis key

What Redis is good for:

- DOA proposal history
- DOA snapshot history
- "optimizer thought state X should move to state Y at time T"

What Redis cannot prove:

- manual `vault.update_debt(...)` calls
- queue changes
- max debt changes
- strategy add/revoke changes
- who actually executed the debt move on-chain

### Kong Public APIs

Kong public REST and GraphQL give us useful live data:

- `GET /api/rest/snapshot/:chainId/:address`
- `GET /api/rest/reports/:chainId/:address`
- GraphQL `vaultAccounts(chainId, vault)`

Important current snapshot fields:

- `allocator`
- `role_manager`
- `use_default_queue`
- `get_default_queue`
- `composition[].currentDebt`
- `composition[].maxDebt`
- `composition[].lastReport`
- `composition[].targetDebtRatio`
- `composition[].maxDebtRatio`

What Kong public APIs are good for:

- current live strategy allocation state
- current allocator configuration surfaced in snapshot hooks
- current role holders on the vault
- `StrategyReported` history

What Kong public APIs do not currently expose as a first-class history feed:

- full `DebtUpdated` history
- full `StrategyChanged` history
- queue update history
- max debt update history
- transaction sender / tx-from attribution

### Kong Internal Index

The Kong repo confirms the index stores:

- latest contract snapshots
- raw `evmlog`
- full event history for indexed contracts

Important nuance:

- Kong's `evmlog` schema stores `transaction_hash`, but not tx sender.
- So Kong alone is enough for event timing and event args, but not enough to classify automatic vs manual by caller address.

Useful Kong internals:

- the V3 vault snapshot hook already resolves `allocator`, `role_manager`, live `currentDebt`, and live allocator ratios
- the public GraphQL/REST surface simply does not expose all of that history yet

## What Yearn Docs And Contracts Confirm

### Vault Roles

Yearn V3 docs state:

- strategies are added by `ADD_STRATEGY_MANAGER`
- `MAX_DEBT_MANAGER` sets `vault.update_max_debt_for_strategy(...)`
- `DEBT_MANAGER` allocates funds
- `QUEUE_MANAGER` controls the default withdrawal queue

The docs also state:

- by default the `DEBT_MANAGER` role is given to the `DebtAllocator` contract deployed by the `RoleManagerFactory`
- the `DebtAllocator` is controlled by the management address

Relevant docs:

- `yearn-devdocs/docs/developers/v3/vault_management.md`
- `yearn-devdocs/docs/developers/v3/periphery.md`

### DOA Flow

Yearn's yield optimization docs describe the intended DOA path:

- offchain optimizer computes target ratios
- `DebtOptimizerApplicator.setStrategyDebtRatios()` writes those ratios into the `DebtAllocator`
- the `DebtAllocator` emits ratio update events
- keepers monitor those updates
- keepers trigger the actual fund movements through the vault

The docs explicitly name the main DOA keeper address:

- `0x283132390ea87d6ecc20255b59ba94329ee17961`

Relevant docs:

- `yearn-devdocs/docs/developers/v3/yield_optimization.md`

### Debt Allocator Semantics

The DebtAllocator docs and contract confirm:

- `update_debt(vault, strategy, targetDebt)` can only be called by allowed keepers
- governance is a keeper by default
- managers or governance can set target ratios
- keepers then execute the actual debt move

Implication:

- a change in allocator target ratios is not the same thing as a vault allocation move
- the actual move is still represented by vault `DebtUpdated`

Relevant sources:

- `yearn-devdocs/docs/developers/smart-contracts/V3/Periphery/DebtAllocator.md`
- `vault-periphery/src/debtAllocators/DebtAllocator.sol`
- `vault-periphery/src/debtAllocators/DebtOptimizerApplicator.sol`

### Vault Events That Matter

The V3 vault contract exposes the event surface we need:

- `DebtUpdated(strategy, current_debt, new_debt)`
- `StrategyChanged(strategy, change_type)`
- `UpdatedMaxDebtForStrategy(sender, strategy, new_debt)`
- `UpdateDefaultQueue(new_default_queue)`
- `UpdateUseDefaultQueue(use_default_queue)`
- `RoleSet(account, role)`
- `StrategyReported(strategy, ..., current_debt, ...)`

Relevant sources:

- `yearn-vaults-v3/contracts/VaultV3.vy`
- `src/components/shared/contracts/abi/vaultV3.abi.ts`

## Why The Current Backend Misses Manual Changes

`api/optimization/_lib/envio.ts` currently queries `DebtUpdated` with a hard sender filter:

- `transactionFrom = 0x283132390eA87D6ecc20255B59Ba94329eE17961`

That means the current alignment logic only sees one keeper-driven path. It will miss:

- direct `vault.update_debt(...)` calls sent by a human operator or multisig
- debt updates executed by another approved keeper
- governance-triggered debt updates

It is therefore unsafe to treat the current matched events as a complete debt-update history.

## What We Need To Show Manual Allocations Alongside DOA

### Required Canonical Event Timeline

Minimum required events:

- vault `DebtUpdated`
- vault `StrategyChanged`
- vault `UpdatedMaxDebtForStrategy`
- vault `UpdateDefaultQueue`
- vault `UpdateUseDefaultQueue`
- vault `RoleSet`
- vault `StrategyReported`
- debt allocator `UpdateStrategyDebtRatio` or `UpdateStrategyDebtRatios`
- debt allocator `UpdateKeeper`

### Required Fields Per Event

For each event we need:

- chain id
- vault address
- strategy address when applicable
- block number
- block timestamp
- log index
- transaction hash
- transaction sender

The transaction sender is mandatory if we want to classify:

- DOA keeper-applied
- manual operator-applied
- governance-applied

### Required State Reconstruction Inputs

To reconstruct allocation states for the Sankey:

- current strategy set
- `currentDebt` per strategy at each step
- strategy adds/removals
- live vault total debt or total assets at the same step for ratio conversion

Important detail from the current frontend:

- the vault detail UI derives strategy allocation percentages from strategy debt relative to vault `totalAssets`
- it does not treat allocation as "share of deployed strategy debt only"
- unallocated/idle is therefore part of the state model

Implication:

- historical `DebtUpdated` events are not enough by themselves to rebuild the same percentages shown in the UI
- we also need a denominator at each historical step, ideally vault `totalAssets` at that block
- if we want to show "Unallocated" historically, we need historical idle as `totalAssets - sum(strategy currentDebt)`

`DebtUpdated` alone is not enough for exact historical ratios because:

- `StrategyReported` changes `current_debt` without being a debt-allocation command
- strategy additions/removals change the visible set of strategies
- queue and max debt changes affect operator intent and allowed future states

### Historical Ratio Gap

Kong's public snapshot endpoint is current-state only, and Kong's `snapshot` table is keyed as the latest snapshot per address.

That means Kong cannot, by itself, give us exact historical per-event vault totals and composition snapshots.

For exact historical Sankey states we likely need one of:

- archive-RPC block reads for `vault.totalAssets()` and `vault.strategies(strategy)` at each relevant event block
- a new indexer surface that stores historical vault snapshots or historical debt states
- a purpose-built historical state materialization job derived from event replay

The current TVL timeseries is useful context, but it is not a precise replacement for per-event state reconstruction.

### Classification Rules

Recommended classification model:

- `doa_ratio_update`: debt allocator ratio update event written by the optimizer path
- `doa_execution`: vault `DebtUpdated` whose sender is an allowed DOA keeper or the debt allocator execution path you trust
- `manual_debt_update`: vault `DebtUpdated` sent by an account with `DEBT_MANAGER` that is not a recognized DOA keeper
- `manual_config_change`: queue, max debt, role, or strategy membership change sent by an operator
- `report_only_state_change`: `StrategyReported` that changes observable strategy debts without a preceding debt update in the same step

## Source Gap: Where To Get Transaction Sender

Kong public APIs do not currently expose tx sender.

Kong internal `evmlog` schema also does not store tx sender.

So tx sender must come from another source:

- Envio, if the indexed entity already exposes `transactionFrom`
- raw RPC `eth_getTransactionByHash`
- another transaction-level indexer

This is the biggest blocker to manual-vs-automatic attribution if we try to rely on Kong alone.

## Live Operator Surface From Kong

Live Kong survey run on 2026-04-23 UTC:

- 127 current Yearn V3 multi-strategy vaults
- 18 current Yearn V3 multi-strategy vaults with a surfaced `allocator`
- 20 distinct accounts across those 18 allocator vaults holding at least one of:
- `DEBT_MANAGER`
- `MAX_DEBT_MANAGER`
- `QUEUE_MANAGER`
- `ROLE_MANAGER`

This is small enough to support sender-based attribution.

Observed high-frequency accounts across allocator vaults:

- `0x1e9eB053228B1156831759401dE0E115356b8671` appears on 12 allocator vaults with `DEBT_MANAGER`
- `0xe5e2Baf96198c56380dDD5E992D7d1ADa0e989c0` appears on 12 allocator vaults with `DEBT_MANAGER` and `MAX_DEBT_MANAGER`
- `0x16388463d60FFE0661Cf7F1f31a7D658aC790ff7` appears on 12 allocator vaults with `DEBT_MANAGER` and `QUEUE_MANAGER`
- `0xFEB4acf3df3cDEA7399794D0869ef76A6EfAff52` appears on 12 allocator vaults with `DEBT_MANAGER`, `MAX_DEBT_MANAGER`, and `QUEUE_MANAGER`
- `0xb3bd6B2E61753C311EFbCF0111f75D29706D9a41` appears on 12 allocator vaults as `ROLE_MANAGER`

Implication:

- manual-change attribution is feasible
- the operator universe is not too large
- but the classification cannot be correct without tx sender

## Recommended Implementation Direction

Use two separate layers:

- Canonical on-chain allocation history
- DOA metadata overlay

Canonical on-chain allocation history should come from:

- vault `DebtUpdated`
- vault `StrategyReported`
- vault `StrategyChanged`
- relevant vault config events

DOA metadata overlay should come from:

- Redis optimizer history
- debt allocator ratio update events

UI behavior should then become:

- show actual state transitions from on-chain history
- annotate which transitions were preceded by DOA ratio updates
- annotate which transitions were manual
- keep the current Kong snapshot as the live tail state

## Practical Next Steps

1. Add a complete debt-update/event history endpoint that does not hard-filter to one keeper address.
2. Add transaction sender to that endpoint via Envio or RPC transaction lookup.
3. Backfill a vault timeline from `DebtUpdated`, `StrategyReported`, and `StrategyChanged`.
4. Join allocator ratio update events so DOA intent and on-chain execution are visible separately.
5. Only use Redis as proposal metadata, not as the primary allocation history source.

## Primary Sources

- Local app:
- `src/components/pages/vaults/hooks/useVaultRecentReallocations.ts`
- `api/optimization/_lib/redis.ts`
- `api/optimization/_lib/envio.ts`
- `src/components/shared/contracts/abi/vaultV3.abi.ts`

- Kong:
- `https://github.com/yearn/kong`
- `https://github.com/yearn/kong/blob/master/docs/rest.md`
- `https://github.com/yearn/kong/blob/master/docs/graphql.md`
- `packages/ingest/abis/yearn/3/vault/snapshot/hook.ts`
- `packages/db/migrations/sqls/20240214020032-eventsource-up.sql`

- Yearn docs:
- `https://docs.yearn.fi/developers/v3/vault_management`
- `https://docs.yearn.fi/developers/v3/periphery`
- `https://docs.yearn.fi/developers/v3/yield_optimization`
- `https://docs.yearn.fi/developers/smart-contracts/V3/Periphery/DebtAllocator`
- `https://docs.yearn.fi/developers/smart-contracts/V3/VaultV3`

- Upstream contracts:
- `https://github.com/yearn/vault-periphery`
- `https://github.com/yearn/yearn-vaults-v3`
