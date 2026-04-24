# Manual Allocation And Reallocation Data Spec

Initial pass as of 2026-04-24.

## Goal

Build a vault-scoped allocation timeline that can explain both:

- DOA optimizer-driven reallocations.
- Manual/operator reallocations and configuration changes.

The current chart path is not a complete allocation history. It reads DOA optimization snapshots from Redis and appends the current live Kong allocation as the tail state. That is enough to show optimizer history and "latest DOA snapshot vs current", but it cannot explain manual reallocations between those points.

The desired model should treat on-chain events as the canonical history and DOA data as metadata that annotates some of those on-chain state changes.

## Current Inputs

### DOA Redis History

Current API:

- `GET /api/optimization/change?vault=<address>&history=1`

Source:

- Redis keys matching `doa:optimizations:*`.
- Parsed by `api/optimization/_lib/redis.ts`.
- Frontend schema in `src/components/shared/utils/schemas/doaOptimizationSchema.ts`.

Current record shape:

```ts
type DoaOptimizationRecord = {
  vault: `0x${string}`
  strategyDebtRatios: Array<{
    strategy: `0x${string}`
    name?: string
    currentRatio: number // bps
    targetRatio: number // bps
    currentApr?: number | null
    targetApr?: number | null
  }>
  currentApr: number
  proposedApr: number
  explain: string
  source: {
    key: string
    chainId: number | null
    revision: string
    isLatestAlias: boolean
    timestampUtc: string | null
    latestMatchedTimestampUtc: string | null
  }
}
```

What it means:

- This is optimizer intent/proposal data.
- `currentRatio` is the optimizer's observed starting state.
- `targetRatio` is the optimizer's proposed target.
- It is not proof that a vault debt update happened on-chain.

### Current Kong Vault Snapshot

Current frontend path:

- `useVaultRecentReallocations` builds the live tail state from `currentVault.strategies[].details.debtRatio`.

What it means:

- Kong is useful for current strategy names and current live allocation.
- Kong's public snapshot endpoint is not a historical allocation-change feed.

## Events Needed

Minimum event set for a useful allocation timeline:

| Event | Source contract | Required | Why |
| --- | --- | --- | --- |
| `DebtUpdated(strategy,current_debt,new_debt)` | V3 vault | Yes | Canonical vault debt allocation change. |
| `StrategyChanged(strategy,change_type)` | V3 vault | Yes | Strategy universe changes, including add/revoke/migration style changes. |
| `StrategyReported(strategy,...,current_debt,...)` | V3 vault | Yes | Changes observable strategy debt without necessarily being an allocation command. Needed to keep state accurate. |
| `UpdatedMaxDebtForStrategy(sender,strategy,new_debt)` | V3 vault | Yes | Manual/config change that affects allowed allocation and operator intent. |
| `UpdateDefaultQueue(new_default_queue)` | V3 vault | Useful | Queue changes affect withdrawal behavior and strategy ordering context. |
| `UpdateUseDefaultQueue(use_default_queue)` | V3 vault | Useful | Explains whether the default queue is active. |
| `RoleSet(account,role)` | V3 vault | Useful | Helps classify whether a sender was authorized as debt/max debt/queue/role manager at the time. |
| `RoleStatusChanged(role,status)` | V3 vault | Useful | Helps interpret role state over time. |
| `UpdateRoleManager(role_manager)` | V3 vault | Useful | Helps follow role-manager changes. |
| Debt allocator ratio update events | Debt allocator / applicator | Yes for DOA attribution | Connects optimizer target ratios to later on-chain debt movements. Exact ABI/event names should be confirmed against the deployed allocator contracts. |
| Debt allocator keeper updates | Debt allocator | Useful | Identifies keeper set changes for DOA/manual classification. |

Required metadata for every indexed event:

```ts
type AllocationSourceEvent = {
  id: string // `${chainId}:${txHash}:${logIndex}`
  chainId: number
  vaultAddress: `0x${string}`
  eventName: string
  blockNumber: number
  blockTimestamp: number
  blockTimestampUtc: string
  transactionHash: `0x${string}`
  logIndex: number
  transactionFrom: `0x${string}` | null
  transactionTo: `0x${string}` | null
  inputSelector: `0x${string}` | null
  strategyAddress?: `0x${string}` | null
  args: Record<string, string | number | boolean | string[] | null>
}
```

`transactionFrom` is not optional for classification quality. Without it we can still build a state timeline, but we cannot reliably label a transition as DOA, manual, governance, keeper, or unknown.

## Snapshot Data Needed

The chart should be built from states, not raw events alone. A state is the vault allocation after a relevant event or at a boundary.

Required per-state fields:

```ts
type AllocationState = {
  id: string
  chainId: number
  vaultAddress: `0x${string}`
  blockNumber: number | null
  blockTimestamp: number | null
  timestampUtc: string
  txHash: `0x${string}` | null
  totalAssets: string
  totalDebt?: string
  totalIdle?: string
  unallocatedBps: number
  strategies: AllocationStateStrategy[]
  sourceEventIds: string[]
}

type AllocationStateStrategy = {
  strategyAddress: `0x${string}`
  name: string | null
  currentDebt: string
  currentDebtBps: number
  maxDebt?: string | null
  maxDebtBps?: number | null
  targetDebtRatioBps?: number | null
  isActive?: boolean
  lastReport?: number | null
}
```

Required snapshots:

- Initial seed state at the beginning of the requested range.
- A post-event state after each allocation-relevant event group.
- Current live tail state from Kong or latest indexed state.

For exact historical percentages, the denominator should match the current UI model:

- Use `vault.totalAssets()` as the denominator.
- `unallocatedBps = totalAssets - sum(strategy currentDebt)` expressed in bps.
- Do not use "share of deployed strategy debt only" unless the product intentionally changes the chart semantics.

Historical state reconstruction can come from either:

- Indexer-materialized snapshots after event replay.
- Archive RPC reads at relevant block numbers:
  - `vault.totalAssets()`
  - `vault.strategies(strategy)` for each known strategy

Raw `DebtUpdated` events are not enough by themselves because:

- `StrategyReported` can change `current_debt`.
- Strategy set changes affect visible nodes.
- We need `totalAssets` at the same block to show idle/unallocated correctly.

## How DOA Data Fits In

DOA should be an overlay, not the canonical allocation history.

DOA data provides:

- Optimizer proposal timestamp.
- Optimizer current and target ratios.
- Strategy-level target changes.
- APR before/after metadata.
- Human-readable `explain` text.
- Redis source key and revision metadata.

On-chain events provide:

- Whether a change actually happened.
- When it happened.
- Which transaction caused it.
- Which sender/contract executed it.
- The exact resulting vault state.

Recommended join model:

```ts
type DoaAnnotation = {
  sourceKey: string
  proposalTimestampUtc: string | null
  optimizerCurrentApr: number
  optimizerProposedApr: number
  explain: string
  strategyTargets: Array<{
    strategyAddress: `0x${string}`
    currentRatioBps: number
    targetRatioBps: number
    currentApr?: number | null
    targetApr?: number | null
  }>
  confidence: 'exact' | 'high' | 'medium' | 'low'
  matchReason: string
}
```

Suggested DOA matching signals:

- Same `chainId` and `vaultAddress`.
- On-chain event timestamp is near the DOA proposal timestamp.
- Strategy delta directions match `targetRatio - currentRatio`.
- Debt allocator ratio update event matches the proposed target ratios.
- `DebtUpdated` transaction sender or wrapper is a known DOA keeper/applicator path.

If DOA exists but no matching on-chain transition exists, it should be modeled as a proposal/pending annotation, not as an executed allocation state.

## Classification

Each transition should have a classification independent from the raw event name:

```ts
type AllocationTransitionKind =
  | 'doa_proposal'
  | 'doa_execution'
  | 'manual_debt_update'
  | 'manual_config_change'
  | 'report_only_state_change'
  | 'strategy_lifecycle_change'
  | 'current_live_tail'
  | 'unknown'
```

Initial classification rules:

- `doa_proposal`: Redis optimizer snapshot and/or allocator target-ratio update, with no direct vault state change implied.
- `doa_execution`: vault `DebtUpdated` caused by a known DOA keeper/applicator path and matched to a DOA proposal.
- `manual_debt_update`: vault `DebtUpdated` caused by a non-DOA authorized sender.
- `manual_config_change`: max debt, queue, role, or allocator configuration event caused by an operator.
- `report_only_state_change`: `StrategyReported` changes observable debt/ratio without an allocation command.
- `strategy_lifecycle_change`: strategy added, revoked, or otherwise changed through `StrategyChanged`.
- `current_live_tail`: synthetic transition from latest historical state to current Kong state.
- `unknown`: insufficient sender/contract metadata to classify.

Known DOA keeper/applicator addresses should be configured data, not hard-coded in chart code. The current alignment helper only queries one keeper address, `0x283132390eA87D6ecc20255B59Ba94329eE17961`, so it is not complete enough for this final model.

## Desired Final Data Shape

The backend should return a vault-scoped canonical timeline that the UI can transform into Sankey panels.

```ts
type VaultAllocationTimeline = {
  schemaVersion: 1
  generatedAt: string
  vault: {
    chainId: number
    address: `0x${string}`
    name?: string | null
    assetAddress?: `0x${string}` | null
    assetSymbol?: string | null
    assetDecimals?: number | null
  }
  range: {
    fromBlock: number | null
    toBlock: number | 'latest'
    fromTimestampUtc: string | null
    toTimestampUtc: string | null
  }
  strategies: Array<{
    address: `0x${string}`
    name: string | null
    firstSeenBlock: number | null
    lastSeenBlock: number | null
  }>
  events: AllocationSourceEvent[]
  states: AllocationState[]
  transitions: AllocationTransition[]
}

type AllocationTransition = {
  id: string
  kind: AllocationTransitionKind
  fromStateId: string | null
  toStateId: string
  timestampUtc: string
  blockNumber: number | null
  transactionHash: `0x${string}` | null
  actor: `0x${string}` | null
  sourceEventIds: string[]
  doa?: DoaAnnotation
  summary: string
}
```

The UI panel shape can be derived from `states` and `transitions`:

```ts
type ReallocationPanel = {
  id: string
  kind: AllocationTransitionKind
  beforeState: {
    timestampUtc: string | null
    strategies: Array<{
      strategyAddress: `0x${string}` | null
      name: string
      allocationPct: number
      isUnallocated: boolean
    }>
  }
  afterState: {
    timestampUtc: string | null
    strategies: Array<{
      strategyAddress: `0x${string}` | null
      name: string
      allocationPct: number
      isUnallocated: boolean
    }>
  }
  source: {
    transactionHash: `0x${string}` | null
    actor: `0x${string}` | null
    doaSourceKey?: string
  }
}
```

## Fetch Model

Primary fetch should be by vault:

```http
GET /api/vault-allocation-history?chainId=1&vault=0x...
GET /api/vault-allocation-history?chainId=1&vault=0x...&fromBlock=...
GET /api/vault-allocation-history?chainId=1&vault=0x...&fromTimestamp=...
```

Recommended query params:

- `chainId`: required.
- `vault`: required.
- `fromBlock` or `fromTimestamp`: optional. Defaults should be bounded, not "all history" for every UI load.
- `toBlock`: optional, defaults to latest.
- `includeRawEvents`: optional debug flag.
- `includeDoa`: optional, defaults true.

Recommended backend fetch pipeline:

1. Resolve vault metadata and current strategy list from Kong.
2. Fetch indexed events by `chainId + vaultAddress` from the canonical event store.
3. Ensure every event has `transactionFrom`, `transactionTo`, and `inputSelector`.
4. Build or read materialized post-event allocation states.
5. Fetch DOA Redis records for the same `chainId + vaultAddress`.
6. Join DOA annotations to transitions.
7. Append current Kong snapshot as a live tail state if it differs from latest indexed state.
8. Return `VaultAllocationTimeline`.

Recommended storage key if this is materialized:

```text
vault-allocation-history:{chainId}:{vaultAddressLower}
```

For long-term storage, a database table is better than a single Redis blob because this is an append/update timeline:

```text
allocation_events(chain_id, vault_address, block_number, log_index, tx_hash, event_name, tx_from, args_json)
allocation_states(chain_id, vault_address, state_id, block_number, tx_hash, total_assets, strategies_json)
allocation_transitions(chain_id, vault_address, transition_id, from_state_id, to_state_id, kind, doa_source_key)
```

Redis can still cache the final per-vault response.

## Open Questions

- Should `StrategyReported` create visible chart panels, or should it only update hidden state used for the next visible allocation transition?
- Should the chart denominator always be `totalAssets`, or do we want a toggle for "deployed debt only"?
- What is the complete DOA keeper/applicator address set per chain?
- Are debt allocator ratio update events already indexed in the available Envio/Kong data source?
- Can the chosen event source provide `transactionFrom` directly, or do we need RPC transaction lookups?
- What is the default history window for UI loads: last N transitions, since first DOA record, or full vault history?
- Should manual max-debt and queue changes appear in the same timeline as allocation changes, or be shown as annotations on nearby allocation panels?

## Implementation Notes From The Current Branches

- Current chart builder: `src/components/pages/vaults/utils/reallocations.ts`.
- Current DOA fetch hook: `src/components/pages/vaults/hooks/useVaultRecentReallocations.ts`.
- Current DOA Redis reader: `api/optimization/_lib/redis.ts`.
- Current DOA alignment helper: `api/optimization/_lib/envio.ts`.
- Prototype archive-RPC branch: `manual-allocation-events`.
