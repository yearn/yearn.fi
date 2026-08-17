# @yearn/vault-widget

Private, reusable deposit/withdraw widget source for apps in this Bun workspace. The package is not published to a registry: consumers declare `"@yearn/vault-widget": "workspace:*"`, and Bun links this directory directly.

## Use a preset

Render the widget inside the host's Wagmi and TanStack Query providers, then supply the host integrations through the runtime provider:

```tsx
import {
  type VaultWidgetRuntimeOverrides,
  VaultWidgetRuntimeProvider,
  YBoldVaultWidget
} from '@yearn/vault-widget'
import '@yearn/vault-widget/styles.css'

const runtime: VaultWidgetRuntimeOverrides = {
  wallet: {
    address,
    chainId,
    connected,
    connecting,
    open: openWallet
  },
  settings: {
    autoStake,
    setAutoStake,
    setSlippagePercent,
    slippagePercent
  },
  prices: {
    spotPriceEndpoint: '/api/prices/spot'
  }
}

<VaultWidgetRuntimeProvider value={runtime}>
  <YBoldVaultWidget apy={apy7d} />
</VaultWidgetRuntimeProvider>
```

The yBOLD preset pins the reviewed Ethereum contracts, forces staked deposits and withdrawals, disables token and chain zaps, and uses a 0.5% (50 bps) loss limit.

When `prices.spotPriceEndpoint` is supplied, the package requests Yearn-compatible spot-price data for the currently selected deposit and withdrawal tokens. It retains `prices.getUsdPrice` as a synchronous fallback.

## Ownership boundary

The package owns the reusable UI, deposit/withdraw transaction flows, reusable hooks, contract definitions, types, presets, and CSS. It may depend on other packages, but it must not import `apps/yearn`, `apps/ybold`, host aliases, or any file outside `packages/vault-widget`.

The consuming app owns:

- Wagmi, TanStack Query, and wallet UI providers
- wallet balances and connection UI
- supported-chain and execution-chain mapping
- prices, routing endpoints, and vault catalog data
- notifications, analytics, Safe status, settings, and asset URLs
- product pages, API routes, and product-specific policy

The app maps those services into `VaultWidgetRuntimeOverrides`. Every override is optional so a constrained preset can use safe disconnected defaults for services it does not need.

## Execute a headless plan with Wagmi

The optional Wagmi adapter maps the canonical chain IDs retained in a transaction plan to the host's configured execution chains at every wallet and RPC boundary:

```ts
import { buildTransactionPlan, executeTransactionPlan } from '@yearn/vault-widget/headless'
import { createWagmiVaultWidgetExecutionAdapter } from '@yearn/vault-widget/wagmi'

const adapter = createWagmiVaultWidgetExecutionAdapter({
  config: wagmiConfig,
  resolveExecutionChainId
})

const plan = buildTransactionPlan({
  intent,
  allowances,
  connectedChainId: resolveCanonicalChainId(connectedWalletChainId),
  walletType
})

const outcome = await executeTransactionPlan({
  account,
  adapter,
  plan,
  refresh
})
```

EOA requests are simulated before the wallet is invoked. Safe requests are simulated as an atomic ordered batch when the RPC supports `eth_simulateV1`, submitted with atomic execution required, and tracked with a bounded polling timeout. A Safe plan must target the chain on which that Safe is open because Safe connectors cannot switch chains programmatically.

Custom execution adapters return receipt waits as `{ receipt, replacement? }`.
When a wallet replaces a transaction, `replacement` must identify the original
hash and whether it was repriced, cancelled, or replaced. The executor follows
validated repriced transactions under their mined hash and rejects cancellations
or unrelated same-nonce transactions.

Run the import boundary guard from the repository root:

```bash
bun run check:vault-widget-boundary
```

## Consumer setup

Each app must:

1. Depend on `"@yearn/vault-widget": "workspace:*"`.
2. Install compatible React, Wagmi, Viem, and TanStack Query peer dependencies.
3. Add `@yearn/vault-widget` to Next.js `transpilePackages` because this package exports TypeScript source.
4. Import `@yearn/vault-widget/styles.css` once.
5. Add `packages/vault-widget/src` to Tailwind's source scan, with the relative path adjusted for the consuming stylesheet.
6. Mount its own providers and `VaultWidgetRuntimeProvider` above the widget.

Keep the dependency direction `apps/* -> packages/vault-widget`. Do not add a package-local lockfile or publish this private package to npm.

## Entry points

- `@yearn/vault-widget` — supported components, presets, runtime provider, and common types
- `@yearn/vault-widget/headless` — pure transaction intent, plan builder, and injectable plan executor
- `@yearn/vault-widget/runtime` — runtime contracts and provider utilities
- `@yearn/vault-widget/types` — widget data and prop types
- `@yearn/vault-widget/wagmi` — React-independent Wagmi execution adapter for headless plans
- `@yearn/vault-widget/ybold` — yBOLD addresses and preset policy
- `@yearn/vault-widget/advanced` — lower-level composition API
- `@yearn/vault-widget/styles.css` — widget styles

Paths under `@yearn/vault-widget/internal/*` are migration seams for the Yearn host and are not a stable API for new consumers.

The headless entry point has no React or Wagmi dependency. It converts plain
deposit or withdrawal intents into ordered approval, chain-switch, execution,
Safe proposal, and refresh steps. `executeTransactionPlan` runs the result
through an injected `VaultWidgetExecutionAdapter`, waits for every receipt,
reports progress, and preserves partial outcomes in typed errors.

The styled widget already uses this path for ready, same-chain, single-request
EOA deposits and withdrawals when the host supplies a complete execution
adapter. Approval, Safe, Enso, cross-chain, chain-switch, and dynamic
unstake-then-withdraw flows intentionally retain the established production
state machine until their confirmation and resume semantics are represented by
the public plan contract. If no complete execution adapter is configured, all
flows continue through that legacy path.
