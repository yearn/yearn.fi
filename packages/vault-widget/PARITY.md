# Vault widget parity gate

The package must not replace the complete yearn.fi widget surface until every
row below is complete.

| Area | Status | Evidence |
| --- | --- | --- |
| Direct ERC-4626 deposit/withdraw | Complete | Exact-share `redeem` for Max, partial `withdraw`, package tests |
| Direct Yearn V2 deposit/withdraw | Complete | Exact-share Max withdrawal, V2 price-per-share adapter, live Kong snapshot resolver, package tests, parity fixture |
| yBOLD direct zap in/out | Complete | Exact-position Max zap-out, `presets/yBold.ts`, yearn-bold build |
| Enso same-chain yBOLD routes | Complete | Exact-position Max routing, trusted-route validation, and package tests |
| Allowance reset and approval planning | Complete | `transactionPlan.test.ts` |
| Compatibility and namespaced browser storage | Complete | Existing yearn.fi keys/IndexedDB plus isolated external-app settings/activity stores, failure-safe transaction recording, and service tests |
| Package artifact isolation | Complete | Automated pack/install validation in an isolated consumer, native Node ESM imports for every JavaScript entry point, peer/export checks, CSS and declaration checks, and repository/framework import scanning |
| Stake, unstake, and combined routes | Complete | Kong staking metadata, selectable vault/staked positions, source-aware partial conversion, exact-share nested Max redemption, composed valuation, ordered plans, and stateful V3 deposit QA; the current stale VNet reward callback blocks stake completion |
| Generic same-chain and cross-chain Enso | Complete | Exact-position Max routing, source/destination policy validation, secure-by-default package server policies for chains, addresses, uint256 amounts, routing strategy, and slippage, controller-level stale-quote refresh, failed/expired re-quote cancellation, approval-identity-safe re-planning, bridge protocol discovery, destination-aware activity, submitted state, destination completion polling, stateful same-chain DAI-to-yvUSD execution, and stateful Optimism-to-mainnet source execution |
| Safe proposal and delayed execution | In progress | Atomic plan batching, sequential state-carrying RPC simulation when `eth_simulateV1` is available, Safe-wallet simulation fallback on canonical RPCs, incomplete/failing simulation rejection, receipt-backed completion with transaction-hash validation for live and reloaded activity, Safe connector and EIP-5792 provider contract tests, mandatory execution tracking, rejection/revert transitions, delayed Safe/cross-chain completion tests, and a dismissible widget-bounded Safe proposal overlay that continues background tracking with a reopenable compact status complete. The deterministic execution-state harness verifies Safe confirmation and queued-proposal states at desktop and mobile sizes; live Safe iframe QA remains pending |
| yvUSD locked/unlocked and cooldown | In progress | Live family presets, nested share valuation, protocol-executable two-vault Max redemption, zap deposit, cooldown reads, styled start/cancel plans, stateful unlocked/locked cooldown QA, and connected desktop/mobile family-state parity complete; wallet-confirmation QA pending |
| yvBTC locked/unlocked | Complete for current production behavior | Unlocked cbBTC ERC-4626 preset, family selector, and connected desktop/mobile state parity complete; plan validation confirms the live vault asset while stateful deposits remain unavailable because `maxDeposit=0`; locked remains explicitly unavailable while its address is the legacy zero-address placeholder |
| Permit and approval migration | In progress | Kong target discovery, destination metadata, full-balance panel, registry-compatible migrator/router/zap selectors, EOA permit detection/signing with nonce-read failure handling, normalized recovery IDs, account/chain/token/value binding, and deadline invalidation, multi-approval and chain-aware allowance planning, Safe approval batching, V2/V3 calls, shared execution, activity persistence, a dedicated permit-signature confirmation overlay, tests, stateful approval migration QA, a stateful signed V3 EIP-2612 migration, and connected legacy/package mode parity against a live V2 holder complete; live wallet-confirmation prompt QA pending |
| Merkle and staking rewards | In progress | Allowlisted Merkl and source-compatible VeYFI/Juiced/OP Boost staking discovery, browser-safe fetch behavior, bounded claimed-total RPC reads with a validated API fallback, cumulative-proof calldata with claimable outcome accounting, claims preserved after a staking program finishes, per-token formatted activity persistence, styled claim rows with the shared widget-bounded transaction overlay, shared execution, chain-switch/Safe plans, tests, a stateful Juiced reward discovery/claim, and connected legacy/package parity for live claimable Juiced AJNA, VeYFI dYFI, and Katana Merkl KAT positions complete. A current Kong inventory of all 35 staking-enabled vaults contains 12 Juiced, 7 V3 Staking, and 16 VeYFI sources, with no live OP Boost source; stateful Merkl and VeYFI wallet-confirmation/execution QA remains |
| Full styled My Info/settings/activity parity | In progress | Combined family positions, vault-filtered recent activity, reload reconciliation for EOA/Safe/cross-chain execution, preset defaults that preserve stored host preferences, controlled settings and copy, mobile settings popover, fully reachable My Info, roving keyboard tabs with tabpanel relationships, widget-constrained token and transaction overlays with focus containment/restoration, component/service tests, an automated 18-case connected legacy/package desktop/mobile matrix including every currently live reward source, a 14-case deterministic desktop/mobile transaction-state matrix, and a four-case production-route cutover matrix proving package-owned navigation, settings, My Info, migration, rewards, and mobile drawer chrome complete; live wallet-confirmation QA remains tracked in its workflow rows |
| Tenderly transaction-family QA | In progress | Reproducible snapshot/revert harness executes 27 transactions across ERC-4626 yvUSD, locked yvUSD cooldown/nested redemption, yBOLD zap, V3 deposit, V2 approval migration, signed V3 EIP-2612 migration, Juiced rewards, same-chain Enso, and an Optimism-to-mainnet Enso source route. yvBTC is plan-only while the live vault reports `maxDeposit=0`; staking is partial-stateful because the stale VNet gauge reward callback reverts; isolated cross-chain QA cannot deliver the destination leg without a bridge relayer. Live Safe iframe and destination-delivery QA remain |

Current rollout state:

- `NEXT_PUBLIC_VAULT_WIDGET_ENABLED=true` switches the complete yearn.fi vault
  widget surface to the package for generic V2/ERC-4626 vaults, staking vaults,
  yBOLD, yvUSD, and yvBTC. The package owns the summary, action navigation,
  settings, My Info, rewards, transaction panels, overlays, and responsive
  widget chrome. The host retains only the page grid/mobile drawer,
  wallet-provider setup, page-level navigation, family-aware refresh callbacks,
  analytics event bridging, live per-variant display metrics, and design-token
  mapping.
- `/dev/vault-widget` remains the development-only side-by-side harness, with
  package fixtures for yBOLD and direct Yearn V2 vaults, a real retired V2
  migration, a V3 vault with staking and rewards, and locked/unlocked yvUSD.
  Its comparison frame explicitly retains the legacy surface even when the
  package cutover flag is enabled. Production-like private previews may expose
  it explicitly with `NEXT_PUBLIC_VAULT_WIDGET_PARITY_ENABLED=true`; deployed
  production builds leave that flag unset.
- A production-like QA build may also set `NEXT_PUBLIC_AGENT_WALLET=true` and
  `NEXT_PUBLIC_AGENT_WALLET_ADDRESS=<QA account>`, then open the harness with
  `?agentWallet=true`. Individual deep-linked parity fixtures may use
  `agentWalletAddress=<EOA>` to exercise a real holder; that override is
  accepted only in development or an explicitly authorized production-like
  parity build. The same-origin legacy frame retains that session, so
  connected surfaces can be compared without a browser extension.
- The flag remains a QA/rollback gate until connected-wallet and Tenderly
  validation is complete. The legacy surface is not removed before that gate.
- yearn-bold keeps its legacy card by default. Setting
  `NEXT_PUBLIC_VAULT_WIDGET_ENABLED=true` switches its entire card to the
  package for parity testing.
- `bun run qa:vault-widget:tenderly` snapshots configured mainnet and Optimism
  VNets, funds isolated QA accounts, exercises package-generated plans, reports
  stateful versus environment-limited coverage, and always reverts both
  snapshots.
- `bun run qa:vault-widget:parity` drives the production-build harness
  sequentially across 18 connected desktop/mobile cases. It rejects package
  markup in the legacy frame and requires equivalent selected states for
  yBOLD, yvBTC, locked/unlocked yvUSD, V2 withdrawal/migration, V3 staking,
  settings, and My Info. Reward cases use live claimable Juiced AJNA, VeYFI
  dYFI, and Katana Merkl KAT positions and require both implementations to
  expose an enabled claim action with the same formatted reward amount.
- `bun run qa:vault-widget:execution-states` drives seven deterministic
  execution states at desktop and mobile sizes without a wallet or transaction.
  It verifies exact widget-overlay bounds, background isolation, non-dismissible
  wallet prompts, Safe and bridge dismissal/reopen behavior, terminal reset,
  and fails if the page makes any Tenderly request.
- `bun run qa:vault-widget:cutover` drives the actual feature-flagged yearn.fi
  vault routes for yBOLD, a connected V2 migration, and connected rewards on
  desktop plus the yBOLD mobile drawer. It requires full package navigation and
  verifies settings, My Info, migration, rewards, package-owned mobile
  header/close controls, and the absence of visible legacy widget controls.
  Tenderly traffic is blocked and treated as a failure.
