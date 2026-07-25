# `@yearn/vault-widget`

Internal Yearn React package being extracted as the single owner of vault
transactions, wallet activity, and transaction settings.

The package expects the host application to provide Wagmi and TanStack Query
providers. It does not depend on Next.js, RainbowKit, or Tailwind.

```tsx
import { VaultWidget, yBoldMainnetPreset } from '@yearn/vault-widget'
import '@yearn/vault-widget/styles.css'

<VaultWidget
  chainId={1}
  vaultAddress={yBoldMainnetPreset.vaultAddress}
  onConnectWallet={openConnectModal}
/>
```

`chainId` and `vaultAddress` are the primary integration. The default service
resolves V2/ERC-4626 metadata from Kong, recognizes package presets such as
yBOLD, and decorates generic vaults with the supported Enso token catalog,
same-chain routes, and cross-chain routes. Pass `config` to override resolution
or inject a `configResolver` through `VaultWidgetProvider` for another metadata
source.

The styled widget uses the same in-widget asset picker as yearn.fi. Route-capable
tokens come from `depositTokens` and `withdrawTokens`. Use
`tokenSelector.defaultTokens` to choose which of those assets appear before a
user searches. The yBOLD preset provides the shorthand `defaultAssetTokens`:

```tsx
const config = createYBoldPreset({
  routeTokens: yBoldRouteTokens,
  defaultAssetTokens: yBoldRouteTokens.filter(({ symbol }) =>
    ['BOLD', 'USDC', 'ETH'].includes(symbol)
  )
})

<VaultWidget
  chainId={config.chainId}
  vaultAddress={config.vaultAddress}
  config={config}
  onConnectWallet={openConnectModal}
/>
```

Use `defaultDepositAssetTokens` or `defaultWithdrawAssetTokens` when the two
menus should feature different assets. Tokens omitted from these defaults
remain available through search as long as they are present in `routeTokens`.

Vaults with Kong staking metadata automatically expose separate direct-vault
and staked position sources. The selected source controls the available output
assets and selects direct withdraw, unstake, or combined unstake-and-withdraw
routing. Enabling automatic staking produces one ordered deposit-then-stake
plan, including both approvals when required. Custom integrations can define
the same behavior with `positionSources` and source-aware route adapters.
Max withdrawals preserve the user's exact share balance and use `redeem`
semantics where supported, avoiding the dust left by an asset-to-share
round-trip. This applies to direct ERC-4626, V2, staked, routed, yBOLD, and
nested locked-vault positions.

The default execution service detects the Wagmi Safe connector, combines
same-chain approval and execution calls into an atomic wallet-call proposal,
and tracks it until execution. Hosts with another Safe transport can inject
`createSafeAwareExecutionService` through `VaultWidgetProvider`.

Cross-chain Enso routes retain a submitted state after the source receipt and
are promoted to success only after the selected Stargate, CCIP, or Relay
status endpoint reports destination delivery. The default provider polls
`/api/enso/bridge-status` at Enso's ten-second minimum interval; hosts may
override `ensoBridge` through `VaultWidgetProvider`. Route quotes are
automatically repeated with only the slippage remaining after price impact.

Vault families with product variants use `VaultFamilyWidget`. The package
ships a live locked/unlocked yvUSD family and an unlocked yvBTC family whose
locked variant remains visibly unavailable until its contract launches:

```tsx
import {
  createYvUsdFamilyPreset,
  VaultFamilyWidget
} from '@yearn/vault-widget'

<VaultFamilyWidget
  family={createYvUsdFamilyPreset()}
  onConnectWallet={openConnectModal}
/>
```

The locked yvUSD preset owns nested share valuation, USDC zap deposits, the
ordered locked-yvUSD-to-USDC withdrawal calls (including protocol-executable
Max redemption when vault rounding leaves unavoidable share dust), and
contextual start/cancel cooldown plans. Headless consumers can use
`readVaultWidgetCooldownState`, `createStartCooldownTransaction`, and
`createCancelCooldownTransaction` directly.

Vaults whose Kong metadata exposes a migration target or reward sources gain
styled migration and rewards workflows automatically. Migration resolves the
destination vault, uses EIP-2612 when the source supports it, and falls back to
an approval plan. Reward discovery combines allowlisted Merkl claims with
source-aware staking reads, then persists each claim through the same activity
and transaction state machine as deposits and withdrawals.

`My Info` combines the configured direct, staked, and family position sources,
filters recent activity to the active account, chain, and related vault
addresses, and resumes final EOA, Safe, and cross-chain transactions after a
reload. Use `infoPositionSources` and `info` to describe product-specific
positions, `onViewAllActivity` to route into a host activity page, and the
`TransactionLink` slot to supply host-specific explorer links.

Every styled workflow uses the same widget-bounded transaction overlay for
wallet confirmation, Safe proposal tracking, receipt confirmation,
cross-chain delivery, success, and retryable errors. The overlay traps focus,
restores it when closed, uses the host `TransactionLink` slot, and can be
reworded through the widget `copy` overrides. Dismissing a queued Safe or
cross-chain overlay does not stop background execution tracking or enable a
duplicate submission; it leaves a compact status control that reopens the
overlay.

Headless or externally orchestrated integrations can compose the same styled
surface with the public `TransactionOverlay` primitive. Pass a
`VaultWidgetExecutionState`, optional copy overrides, and the same
`TransactionLink` slot; the package supplies the default copy and accessibility
behavior.

Transaction settings support controlled and uncontrolled presentation through
`settingsOpen`, `defaultSettingsOpen`, and `onSettingsOpenChange`. The desktop
surface replaces the action panel while settings are open; compact containers
use a widget-constrained popover and restore focus to the opening gear when
closed.

External applications can persist activity and settings without sharing
yearn.fi's compatibility keys:

```tsx
const services = {
  activityStore: createBrowserActivityStore({ namespace: 'my-app/vault-widget' }),
  settings: createBrowserSettingsStore({ namespace: 'my-app/vault-widget' })
}
```

Use `createYearnFiActivityStore` and `createYearnFiSettingsStore` only inside
yearn.fi, where they preserve its existing IndexedDB and local-storage schema.

The corresponding builders remain available from the headless entry point.
`createMigrationQuote` preserves the legacy migrator registry, V2/V3 router
selectors, veCRV zap arguments, and V3 EIP-2612 multicalls.
`createMerkleClaimQuote` and `createStakingClaimQuote` produce claim quotes
that can be passed to `buildTransactionPlan` with the `migrate` or `rewards`
mode, including Safe batching and chain switching. Hosts may override reward
discovery by supplying a `rewards` service through `VaultWidgetProvider`.

Framework-neutral Enso route, balance, status, and bridge-status handler
factories are exported from `@yearn/vault-widget/server`. Consumers keep their
API keys server-side and can constrain route source/destination chains through
the handler policy.

## Development

```bash
bun run --cwd packages/vault-widget tslint
bun run --cwd packages/vault-widget test
bun run --cwd packages/vault-widget build
bun run qa:vault-widget:tenderly --list
bun run qa:vault-widget:tenderly --flow yvusd-direct --max-rpc-methods 30
bun run qa:vault-widget:parity
bun run qa:vault-widget:execution-states
bun run qa:vault-widget:cutover
npm pack --dry-run --workspace @yearn/vault-widget
bun run --cwd packages/vault-widget verify:artifact
```

`qa:vault-widget:execution-states` renders seven deterministic execution
states at desktop and mobile widget sizes. It validates overlay bounds,
background isolation, dismissal/reopen behavior, and terminal reset behavior
without connecting a wallet or submitting a transaction.

Tenderly QA never selects a flow implicitly. Use an explicit `--flow` or
`--suite` together with a hard `--max-rpc-methods` limit. The full 11-flow
suite remains available through `qa:vault-widget:tenderly:full`, but it should
only be run intentionally with an appropriately reviewed RPC budget.

Publication, registry access, provenance, and release automation are outside
the extraction and yearn.fi cutover goal. The pack and isolated-consumer
commands above validate the local package artifact without publishing it.
See [PARITY.md](./PARITY.md) for the production cutover gate.
