# ERC-4626 app implementation

The old 4626 app is `yearn/vaults-app`. Its deposit/withdrawal functionality is the reference for `apps/4626` in this monorepo. The existing `packages/vault-widget` is extended in place; the main Yearn app and existing yBOLD app continue consuming it.

## Public API

`@yearn/vault-widget` exports `Erc4626VaultWidget` and `useErc4626Vault`.

```tsx
<Erc4626VaultWidget address={vaultAddress} chainId={chainId} />
```

Mount it within Wagmi, TanStack Query, wallet UI and `VaultWidgetRuntimeProvider`, as demonstrated in `apps/4626/app/providers.tsx`. The preset loads metadata directly from the selected chain, does not require `pricePerShare`, `apiVersion`, APR, a vault catalog or USD prices, and supports direct underlying-token deposits/withdrawals only.

`VaultWidgetVault.contractKind` explicitly selects `erc4626` or `yearn-v2`. Existing consumers that omit it retain version-based dispatch. `version` and `forwardAPR` are optional. `VaultUserData.erc4626` supplies standard operation limits; existing consumers without that field retain their existing data behavior.

## Accounting and execution

| Purpose | On-chain source |
| --- | --- |
| Position accounting value | `convertToAssets(balanceOf(owner))` |
| Deposit capacity | Minimum of underlying balance and `maxDeposit(receiver)` |
| Deposit quote | `previewDeposit(assets)` |
| Asset withdrawal capacity | `maxWithdraw(owner)` |
| Partial withdrawal shares | `previewWithdraw(assets)` |
| Redeem capacity | Minimum of share balance and `maxRedeem(owner)` |
| Redeem proceeds | `previewRedeem(shares)` |

Snapshot reads use a common block number, explicit chain and account-specific query key. An unavailable balance, limit, conversion or decimals read fails the snapshot; it does not become a genuine zero. Missing names/symbols can use display fallbacks. Background read failures disable dependent actions while keeping the current transaction presentation mounted.

Partial withdrawals call `withdraw(assets, receiver, owner)`. MAX calls `redeem(allowedShares, receiver, owner)` only when the snapshot’s redeem proceeds match the permitted asset withdrawal amount; otherwise it uses `withdraw(maxWithdraw, receiver, owner)`. Fresh previews and transaction simulation check the operation. Direct deposit approval is exact to the requested asset amount, and zero-share deposit previews are blocked in generic mode.

The old 4626 app used a Yearn-specific four-argument withdrawal with zero maxLoss. The new app uses standard three-argument methods. Vault-specific loss policies, async request/claim vaults, routers with enforced output bounds, swaps and staking orchestration are not inferred from an arbitrary address.

## Verification

- Reader tests cover unpriced, non-Yearn vaults, unequal decimals, fees/caps and failed critical reads.
- Transaction hook tests cover exact asset/share calldata, missing allowances, zero-share deposits, invalid caps, failed previews, capped MAX redemption and legacy V2 dispatch.
- App tests cover supported networks and address validation.
- Run `bun run check:vault-widget-boundary`, `bun run tslint:all`, `bun run test:all` and the app production build after changes.

### Validation performed on 2026-09-17

- Widget boundary check and all four workspace type checks passed.
- Tests passed: 336 shared-widget tests, 823 Yearn app tests, 5 yBOLD app tests and 8 new ERC-4626 app tests. The reader regression also asserts an uncached block-number lookup so the first read after confirmation sees the new balance.
- The new app's production build passed with Webpack. Turbopack could not create worker sockets in this environment. The build retains upstream wallet-library optional-dependency and dynamic-import warnings.
- Browser transactions ran against an isolated local Anvil chain, using an independent vault with a 6-decimal unpriced asset, 18-decimal shares, a 1% deposit fee, a 2% withdrawal fee and configurable liquidity caps. The fixture exposes no Yearn-specific metadata or price-per-share method.
- Browser checks verified exact approval and deposit, a partial standard `withdraw`, capped MAX `redeem` preserving the remaining position, full MAX `redeem` leaving zero shares, confirmed transaction notices and immediate position refresh. A 2-token deposit returned 0.99 shares; a 1.96-token capped MAX redeemed exactly one share. No browser exceptions or mobile horizontal overflow occurred.
- A disconnected, read-only browser check loaded live Savings Dai metadata and its underlying asset from Ethereum public RPC through the production preview. Local transaction tests do not certify arbitrary third-party vault implementations.

Safe proposal/execution integration is wired to the shared widget but has not been exercised end to end with a real Safe. WalletConnect requires a deployment-specific project ID; injected-wallet testing used the local fixture. Transaction notices are session-only, and standard direct calls have no additional minimum-output router protection. Async vaults remain out of scope. No public deployment, existing-app cutover or real-funds transaction was performed.
