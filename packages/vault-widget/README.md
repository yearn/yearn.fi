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

## Development

```bash
bun run --cwd packages/vault-widget tslint
bun run --cwd packages/vault-widget test
bun run --cwd packages/vault-widget build
npm pack --dry-run --workspace @yearn/vault-widget
```

Publishing requires membership in the private `yearn` npm organization.
See [PARITY.md](./PARITY.md) for the production cutover gate.
