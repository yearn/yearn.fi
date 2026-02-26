# Staking Holder Enumeration Runbook

## Purpose

Document a repeatable process to enumerate **current stakers** for Yearn-related staking contracts.

This covers:

1. Receipt/share-token staking contracts (holder state can be inferred from token transfers).
2. Legacy staking contracts (no transferable receipt token; holder state must be reconstructed from staking events).

## Inputs

- `chainId`
- `stakingContract`
- `rpcUrl`
- optional `fromBlock` (recommended for performance)

## Output

Use a stable CSV format:

```text
address,net_staked,last_activity_block,confidence
```

- `net_staked`: raw token units (integer, contract decimals).
- `confidence`:
  - `high`: ledger result matches `balanceOf(address)` at head.
  - `medium`: event-ledger only (no balance verification pass).
  - `low`: inferred via fallbacks (token transfer heuristics / traces).

## Contract Classification

Run these probes first:

1. Check if staking contract behaves like a transferable token:
   - `name()`, `symbol()`, `decimals()`
   - `Transfer(address,address,uint256)` log presence on staking contract address
2. Check staking-specific surface:
   - `stake(uint256)`, `withdraw(uint256)`, `exit()`, `balanceOf(address)`, `totalSupply()`
3. Decide path:
   - If transferable `Transfer` model is active: use receipt/share-token flow.
   - If no receipt-token behavior but staking events + `balanceOf` exist: use legacy ledger flow.

## Flow A: Receipt/Share-Token Contracts

1. Fetch `Transfer` logs for staking contract.
2. Reconstruct balances:
   - `from != 0x0` -> subtract
   - `to != 0x0` -> add
3. Keep addresses with positive balances.
4. Verify positives using `balanceOf(address)` at latest/safe head.

## Flow B: Legacy Staking Contracts

Primary events:

- `Staked(address,uint256)`
- `StakedFor(address,uint256)` (if present)
- `Withdrawn(address,uint256)`
- `WithdrawnFor(address,uint256)` (if present)

Rules:

1. Stake events -> add amount to beneficiary.
2. Withdraw/unstake events -> subtract amount from beneficiary.
3. `exit()` is typically a function selector, not an event. In standard Synthetix-style implementations it emits `Withdrawn`, so principal accounting is already captured via events above.
4. Candidate set = union of indexed beneficiary addresses in these events.
5. Verify candidate set via `balanceOf(address)` and retain non-zero.

## RPC Strategy and Scaling

Use only RPC by default:

- `eth_getLogs`
- `eth_call`
- `eth_blockNumber`

Archive node only needed for:

- historical `eth_call` at old blocks
- trace-heavy fallbacks

Performance guidance:

1. Query by topic, not just by address.
2. Chunk block ranges (start with small windows on OP, then tune).
3. On provider `eth_getLogs` limit errors, reduce range adaptively and continue.
4. Persist checkpoints:
   - `last_processed_block`
   - `balances` map
   - `last_activity_block` map
5. Reorg safety:
   - process to a safe head (or reprocess trailing window).

## Case Study: OP Boost Contract

Target:

- `chainId`: `10` (Optimism)
- `stakingContract`: `0xB2c04C55979B6CA7EB10e666933DE5ED84E6876b`

Session findings (captured on 2026-02-26):

1. Classified as legacy Synthetix-style staking path (not transferable receipt-token holder scan).
2. Relevant topic0 signatures:
   - `Staked(address,uint256)`:
     `0x9e71bc8eea02a63969f509818f2dafb9254532904319f9dbda79b67bd34a5f3d`
   - `StakedFor(address,uint256)`:
     `0xd185ae938da574e9cd1073962e1972c75ec585ab222b200a88c0abe2bf0cfe67`
   - `Withdrawn(address,uint256)`:
     `0x7084f5476618d8e60b11ef0d7d3f06914655adb8793e28ff7f018d4c76d505d5`
3. Indexed staker address is in `topics[1]`.
4. Suggested initial block:
   - `0x51fcc6d` (`85970029`)
5. OP provider behavior observed in this research:
   - `eth_getLogs` range/results limits require chunking.
   - `StakedFor` may require split ranges on some providers.

Related token addresses observed in this case study:

- `stakingToken()`: `0xaD17A225074191d5c8a37B50FdA1AE278a2EE6A2`
- `rewardsToken()`: `0x7D2382b1f8Af621229d33464340541Db362B4907`

## Command Skeleton (Cast)

Set env:

```bash
RPC="<optimism_rpc>"
C="0xB2c04C55979B6CA7EB10e666933DE5ED84E6876b"
FROM="0x51fcc6d"
T_STAKED="0x9e71bc8eea02a63969f509818f2dafb9254532904319f9dbda79b67bd34a5f3d"
T_STAKEDFOR="0xd185ae938da574e9cd1073962e1972c75ec585ab222b200a88c0abe2bf0cfe67"
T_WITHDRAWN="0x7084f5476618d8e60b11ef0d7d3f06914655adb8793e28ff7f018d4c76d505d5"
```

Fetch logs per topic (chunk ranges as needed):

```bash
cast rpc --rpc-url "$RPC" eth_getLogs "{\"fromBlock\":\"$FROM\",\"toBlock\":\"latest\",\"address\":\"$C\",\"topics\":[\"$T_STAKED\"]}"
cast rpc --rpc-url "$RPC" eth_getLogs "{\"fromBlock\":\"$FROM\",\"toBlock\":\"latest\",\"address\":\"$C\",\"topics\":[\"$T_STAKEDFOR\"]}"
cast rpc --rpc-url "$RPC" eth_getLogs "{\"fromBlock\":\"$FROM\",\"toBlock\":\"latest\",\"address\":\"$C\",\"topics\":[\"$T_WITHDRAWN\"]}"
```

Verify any candidate holder:

```bash
cast call "$C" "balanceOf(address)(uint256)" "<holder>" --rpc-url "$RPC"
```

## Onboarding Template for New Staking Vaults

When adding another staking contract to this runbook, append:

1. `chainId`
2. `stakingContract`
3. Contract model classification (`receipt-token` vs `legacy-ledger`)
4. Event topic map used
5. `fromBlock` used
6. Provider-specific chunking limits
7. Validation notes (`balanceOf` parity, anomalies)

## Notes

- This document is process-focused and intended to avoid repeating discovery work.
- In this Codex shell session, direct RPC verification was DNS-blocked, so the case-study constants above come from prior validated agent research in this same session context.
