# Vault widget parity gate

The package must not replace the complete yearn.fi widget surface or be
published as the production dependency until every row below is complete.

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
| Generic same-chain and cross-chain Enso | Complete | Exact-position Max routing, source/destination policy validation, package-owned server handlers, protected re-quotes, bridge protocol discovery, destination-aware activity, submitted state, destination completion polling, stateful same-chain DAI-to-yvUSD execution, and stateful Optimism-to-mainnet source execution |
| Safe proposal and delayed execution | In progress | Atomic plan batching, Safe connector and EIP-5792 provider contract tests, mandatory execution tracking, rejection/revert transitions, delayed Safe and cross-chain completion tests complete; live Safe iframe QA pending |
| yvUSD locked/unlocked and cooldown | In progress | Live family presets, nested share valuation, protocol-executable two-vault Max redemption, zap deposit, cooldown reads, styled start/cancel plans, and stateful unlocked/locked cooldown QA complete; wallet-connected QA pending |
| yvBTC locked/unlocked | Complete for current production behavior | Unlocked cbBTC ERC-4626 preset and family selector complete; plan validation confirms the live vault asset while stateful deposits remain unavailable because `maxDeposit=0`; locked remains explicitly unavailable while its address is the legacy zero-address placeholder |
| Permit and approval migration | In progress | Kong target discovery, destination metadata, full-balance panel, registry-compatible migrator/router/zap selectors, EOA permit detection/signing, Safe approval batching, V2/V3 calls, shared execution, activity persistence, tests, stateful approval migration QA, and a stateful signed V3 EIP-2612 migration complete; connected-wallet prompt QA pending |
| Merkle and staking rewards | In progress | Allowlisted Merkl and source-compatible VeYFI/Juiced/OP Boost staking discovery, claimed accounting, styled claim rows, shared execution/activity persistence, chain-switch/Safe plans, tests, and a stateful Juiced reward discovery/claim complete; connected-wallet and other live-source visual QA pending |
| Full styled My Info/settings/activity parity | In progress | Combined family positions, vault-filtered recent activity, reload reconciliation for EOA/Safe/cross-chain execution, preset defaults that preserve stored host preferences, controlled settings and copy, mobile settings popover, fully reachable My Info, roving keyboard tabs with tabpanel relationships, widget-constrained token dialog with focus containment/restoration, and component/service tests complete; connected-wallet visual QA remains |
| Tenderly transaction-family QA | In progress | Reproducible snapshot/revert harness executes 27 transactions across ERC-4626 yvUSD, locked yvUSD cooldown/nested redemption, yBOLD zap, V3 deposit, V2 approval migration, signed V3 EIP-2612 migration, Juiced rewards, same-chain Enso, and an Optimism-to-mainnet Enso source route. yvBTC is plan-only while the live vault reports `maxDeposit=0`; staking is partial-stateful because the stale VNet gauge reward callback reverts; isolated cross-chain QA cannot deliver the destination leg without a bridge relayer. Live Safe iframe and destination-delivery QA remain |

Current rollout state:

- `NEXT_PUBLIC_VAULT_WIDGET_ENABLED=true` switches the complete yearn.fi vault
  widget surface to the package for generic V2/ERC-4626 vaults, staking vaults,
  yBOLD, yvUSD, and yvBTC. The host retains only wallet-provider setup,
  page-level navigation, family-aware refresh callbacks, analytics event
  bridging, live per-variant display metrics, and design-token mapping.
- `/dev/vault-widget` remains the development-only side-by-side harness, with
  package fixtures for yBOLD and direct Yearn V2 vaults, a real retired V2
  migration, a V3 vault with staking and rewards, and locked/unlocked yvUSD.
  Its comparison frame explicitly retains the legacy surface even when the
  package cutover flag is enabled. Production-like private previews may expose
  it explicitly with `NEXT_PUBLIC_VAULT_WIDGET_PARITY_ENABLED=true`; deployed
  production builds leave that flag unset.
- The flag remains a QA/rollback gate until connected-wallet and Tenderly
  validation is complete. The legacy surface is not removed before that gate.
- yearn-bold keeps its legacy card by default. Setting
  `NEXT_PUBLIC_VAULT_WIDGET_ENABLED=true` switches its entire card to the
  package for parity testing.
- The npm publish workflow requires the protected `npm` environment and an
  authorized `NPM_TOKEN`; package ownership has not been verified locally.
- `bun run qa:vault-widget:tenderly` snapshots configured mainnet and Optimism
  VNets, funds isolated QA accounts, exercises package-generated plans, reports
  stateful versus environment-limited coverage, and always reverts both
  snapshots.
