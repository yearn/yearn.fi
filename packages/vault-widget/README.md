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

## Development

```bash
bun run --cwd packages/vault-widget tslint
bun run --cwd packages/vault-widget test
bun run --cwd packages/vault-widget build
npm pack --dry-run --workspace @yearn/vault-widget
```

Publishing requires membership in the private `yearn` npm organization.
See [PARITY.md](./PARITY.md) for the production cutover gate.
