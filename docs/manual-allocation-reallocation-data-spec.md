# Manual Allocation And Reallocation Data Spec

Initial pass as of 2026-04-24. Optimization coverage contract revised 2026-07-28.

## Goal

Build a vault-scoped allocation timeline that can explain both:

- DOA optimizer-driven reallocations.
- Manual/operator reallocations and configuration changes.

The current API path is not a complete allocation history. It reads DOA optimization snapshots from Redis. That is enough to expose optimizer proposal history to external consumers, but it cannot explain manual reallocations between those points.

The desired model should treat on-chain events as the canonical history and DOA data as metadata that annotates some of those on-chain state changes.

## Current Inputs

### DOA Redis History

Current API:

- `GET /api/optimization/change?vault=<address>&history=1`

Source:

- Redis keys matching `doa:optimizations:*`.
- Parsed by `api/optimization/_lib/redis.ts`.

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
  allocationCoverage: {
    currentIncludedBps: number
    targetIncludedBps: number
    currentResidualBps: number
    targetResidualBps: number
    currentComplete: boolean
    targetComplete: boolean
    classification: 'complete' | 'partial-optimizer-scope' | 'unknown'
    unallocatedBps: number | null
    unallocatedSource: 'same-timestamp-onchain' | 'same-timestamp-indexed' | null
  }
  freshness: {
    optimizationTimestampUtc: string | null
    latestAvailableTimestampUtc: string | null
  }
  allocationSnapshot: {
    timestampUtc: string | null
    blockNumber: number | null
    blockTimestampUtc: string | null
    source: 'archive-rpc' | null
    strategyUniverseSource: 'envio-strategy-changed' | null
    complete: boolean
    strategies: Array<{
      address: `0x${string}`
      name: string | null
      nameSource: 'optimizer' | 'current-metadata-catalog' | null
      currentBps: number
      targetBps: number | null
      optimizerScope: 'optimized' | 'outside-optimizer-scope' | 'unknown'
      targetSource: 'optimizer' | 'unchanged-outside-scope' | 'unavailable'
    }>
    unallocatedBps: number | null
    unallocatedSource: 'same-timestamp-onchain' | null
  }
}
```

What it means:

- This is optimizer intent/proposal data.
- `currentRatio` is the optimizer's observed starting state.
- `targetRatio` is the optimizer's proposed target.
- It is not proof that a vault debt update happened on-chain.

Allocation coverage semantics:

- `currentIncludedBps` and `targetIncludedBps` are independent sums of the raw `strategyDebtRatios`.
- `currentResidualBps` and `targetResidualBps` describe how much of 10,000 bps is not represented in that optimizer payload. A residual does not establish why allocation is absent from the payload.
- Totals within 5 bps of 10,000 are complete. A small overflow is retained in the included total and its residual is clamped to zero. Totals above 10,005 bps are invalid.
- `classification` is `complete` only when both current and target totals are complete, `unknown` when both totals are zero, and `partial-optimizer-scope` otherwise.
- `unallocatedBps` remains `null` and `unallocatedSource` remains `null` for DOA-only records. They may only be populated from authoritative vault state at the same timestamp, from either on-chain reads or an indexed state snapshot.
- Therefore `currentResidualBps` and `targetResidualBps` must not be presented as confirmed unallocated capital.

Freshness semantics:

- `optimizationTimestampUtc` is the individual record's source timestamp. For a `latest` alias, it is the newest timestamped Redis payload whose raw content matches that alias; it is `null` when no match exists.
- `latestAvailableTimestampUtc` is the newest known optimization timestamp for the same vault and chain in the current Redis read. Consumers can compare it with their own freshness policy, but the API does not declare a record stale using a hard-coded age.
- History records retain their own `optimizationTimestampUtc`; current live vault state is never copied into historical optimizer records.

Historical allocation reconciliation:

- Envio `StrategyChanged` lifecycle events establish the strategy-address universe at the optimizer timestamp. Coverage is accepted only when each observed lifecycle starts with an add event, every optimizer strategy is represented, and the query is not truncated.
- Archive RPC resolves the last block at or before the optimizer timestamp, then reads `totalAssets()` and every known `strategies(address)` entry in one Multicall request. These block-aligned values own `currentBps` and true `unallocatedBps`.
- Kong's current snapshot composition may supply a useful strategy name, but never an allocation value. Such names are marked `nameSource: 'current-metadata-catalog'`.
- A strategy in `strategyDebtRatios` is `optimized`, and its `targetBps` retains the optimizer target.
- A strategy omitted from today's DOA payload is `unknown` with `targetBps: null`. The current payload has no machine-readable exclusion contract, so omission alone does not prove `outside-optimizer-scope`.
- `outside-optimizer-scope` and `targetSource: 'unchanged-outside-scope'` are reserved for a future authoritative scope input that explicitly guarantees the strategy remains unchanged.
- If Envio lifecycle coverage, timestamp resolution, or archive RPC is unavailable, `allocationSnapshot.complete` is `false`, its strategy list is empty, and the aggregate `allocationCoverage` residual remains the honest fallback.
- Requested-vault history enrichment resolves block timestamps in batched search rounds, batches archive multicalls, retries transient rate limits, and caches by vault/timestamp/optimizer-address set. The unscoped all-vault response gets the explicit fallback shape without archive fan-out.
- Production deployments may configure `OPTIMIZATION_ARCHIVE_RPC_URL_<chainId>` (for example `OPTIMIZATION_ARCHIVE_RPC_URL_1`) to put a dedicated archive provider ahead of the existing public RPC fallbacks. Large histories should not depend on public-provider rate limits.

Source authority:

| Data | Authority | Notes |
| --- | --- | --- |
| Optimizer intent, included strategies, and targets | DOA Redis payload | Raw fields are preserved unchanged. Omission is not an exclusion guarantee. |
| Historical current allocations | Archive RPC at the last block at or before the optimizer timestamp | Envio supplies and validates the historical strategy universe. |
| True historical unallocated capital | Same archive-RPC snapshot | Calculated from `totalAssets - sum(strategy current debt)` at the same block. |
| Strategy names | Optimizer payload, then current Kong metadata catalog | Kong names are convenience metadata with explicit current-catalog provenance. |
| Current/live allocation | Kong or live RPC | Must not be copied into a historical optimizer record. |

### yvWETH-1 Example: Successful Historical Enrichment

Read-only validation for the `2026-07-25 00:15:29 UTC` recommendation resolved Ethereum block `25,606,129`, whose timestamp is `2026-07-25 00:15:23 UTC`:

```json
{
  "allocationCoverage": {
    "currentIncludedBps": 4157,
    "targetIncludedBps": 4157,
    "currentResidualBps": 5843,
    "targetResidualBps": 5843,
    "currentComplete": false,
    "targetComplete": false,
    "classification": "partial-optimizer-scope",
    "unallocatedBps": 2,
    "unallocatedSource": "same-timestamp-onchain"
  },
  "allocationSnapshot": {
    "timestampUtc": "2026-07-25 00:15:29 UTC",
    "blockNumber": 25606129,
    "blockTimestampUtc": "2026-07-25 00:15:23 UTC",
    "source": "archive-rpc",
    "strategyUniverseSource": "envio-strategy-changed",
    "complete": true,
    "strategies": [
      {
        "address": "0x470e0e048f85cfd72eef325895e02c8d297e7435",
        "name": "stETH Accumulator",
        "nameSource": "current-metadata-catalog",
        "currentBps": 4722,
        "targetBps": null,
        "optimizerScope": "unknown",
        "targetSource": "unavailable"
      },
      {
        "address": "0xe89371eaaac6d46d4c3ed23453241987916224fc",
        "name": "Yearn OG WETH",
        "nameSource": "current-metadata-catalog",
        "currentBps": 178,
        "targetBps": 91,
        "optimizerScope": "optimized",
        "targetSource": "optimizer"
      },
      {
        "address": "0x68a14629cb07c74259f481382fe8b6cfd8970121",
        "name": "wstETH/WETH Spark Looper",
        "nameSource": "current-metadata-catalog",
        "currentBps": 1152,
        "targetBps": null,
        "optimizerScope": "unknown",
        "targetSource": "unavailable"
      },
      {
        "address": "0xfca3f21d60d5bc8b4c5c35f169bb5b6402510151",
        "name": "Spark WETH Lender",
        "nameSource": "current-metadata-catalog",
        "currentBps": 3947,
        "targetBps": 4066,
        "optimizerScope": "optimized",
        "targetSource": "optimizer"
      }
    ],
    "unallocatedBps": 2,
    "unallocatedSource": "same-timestamp-onchain"
  }
}
```

The strategy bps values are independently rounded against same-block `totalAssets`, so their displayed sum plus unallocated may differ from 10,000 by a few bps. Raw debts and optimizer ratios are not rescaled.

### yvWETH-1 Example: Supported Fallback

```json
{
  "allocationCoverage": {
    "currentIncludedBps": 4157,
    "targetIncludedBps": 4157,
    "currentResidualBps": 5843,
    "targetResidualBps": 5843,
    "classification": "partial-optimizer-scope",
    "unallocatedBps": null,
    "unallocatedSource": null
  },
  "allocationSnapshot": {
    "timestampUtc": "2026-07-25 00:15:29 UTC",
    "blockNumber": null,
    "blockTimestampUtc": null,
    "source": null,
    "strategyUniverseSource": null,
    "complete": false,
    "strategies": [],
    "unallocatedBps": null,
    "unallocatedSource": null
  }
}
```

In fallback mode, Powerglove should render the raw optimizer strategies and an aggregate “Outside optimizer scope / composition unavailable” residual. It must not label that residual `Unallocated`.

### Current Kong Vault Snapshot

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

## Downstream Normalization Dependency

The private `optimization-visualizer` repository has a separate `lib/normalize.ts` implementation that rescales or synthesizes missing allocation and an on-chain patching path in `app/hooks/useOptimizations.ts`. It must adopt this coverage contract separately. That repository is intentionally out of scope for this change.

Until that follow-up is complete, consumers should use `allocationCoverage` from this API and must not infer `Unallocated` as `10,000 - sum(strategyDebtRatios)`.

## Upstream Publisher Dependency

The API can only report the newest DOA snapshot present under `doa:optimizations:*`; it does not repair or infer missing optimizer history. Ethereum yvUSDC-1 (`0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204`) had no July 2026 records when this contract was revised, despite later vault strategy-state changes. Restoring that missing history is a separate DOA Redis publisher investigation. Consumers should use `freshness.latestAvailableTimestampUtc` to apply their own stale-recommendation warning policy.

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

- Current DOA Redis reader: `api/optimization/_lib/redis.ts`.
- Current DOA alignment helper: `api/optimization/_lib/envio.ts`.
- Prototype archive-RPC branch: `manual-allocation-events`.
