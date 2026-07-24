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
resolves ERC-4626 metadata from Kong and recognizes package presets such as
yBOLD. Pass `config` to override resolution or inject a `configResolver`
through `VaultWidgetProvider` for another metadata source.

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
routing. Custom integrations can define the same behavior with
`positionSources` and source-aware route adapters.

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
ordered locked-yvUSD-to-USDC withdrawal calls, and contextual start/cancel
cooldown plans. Headless consumers can use `readVaultWidgetCooldownState`,
`createStartCooldownTransaction`, and `createCancelCooldownTransaction`
directly.

Vaults whose Kong metadata exposes a migration target or reward sources gain
styled migration and rewards workflows automatically. Migration resolves the
destination vault, uses EIP-2612 when the source supports it, and falls back to
an approval plan. Reward discovery combines allowlisted Merkl claims with
source-aware staking reads, then persists each claim through the same activity
and transaction state machine as deposits and withdrawals.

The corresponding builders remain available from the headless entry point.
`createMigrationQuote` preserves the legacy migrator registry, V2/V3 router
selectors, veCRV zap arguments, and V3 EIP-2612 multicalls.
`createMerkleClaimQuote` and `createStakingClaimQuote` produce claim quotes
that can be passed to `buildTransactionPlan` with the `migrate` or `rewards`
mode, including Safe batching and chain switching. Hosts may override reward
discovery by supplying a `rewards` service through `VaultWidgetProvider`.

## Development

```bash
bun run --cwd packages/vault-widget tslint
bun run --cwd packages/vault-widget test
bun run --cwd packages/vault-widget build
npm pack --dry-run --workspace @yearn/vault-widget
```

Publishing requires membership in the private `yearn` npm organization.
See [PARITY.md](./PARITY.md) for the production cutover gate.
