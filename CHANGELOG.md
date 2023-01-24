# 0.1.16
- Add support for Solvers, aka external services used for zaps. Current zaps are Cowswap, Wido and Portals. Cowswap is implemented, Wido is waiting for a review from our security team, Portals is yet to be implemented.
- Add and fetch a tokenList with a supportedZap feature to determine which solver can be used for this IN token
- Add a separated tab for `Deposit` and `Withdraw` in the Vault Detail page
- Replace the `TokenDropdown` component to use Combobox instead of Listbox
- Draft a new version of `useBalances` hook to fetch the balances of the user
- Integrate `yearn.finance/zap-slippage` locale storage value to determine the slippage to use in the zaps
- Integrate `yearn.finance/zap-provider` locale storage value to determine the provider to use in the zaps
- Add some new custom hooks and context `apps/common/hooks/useAllowanceFetcher.tsx`, `apps/vaults/contexts/useSolver.tsx`, `apps/vaults/contexts/useWalletForZaps.tsx`, `apps/vaults/hooks/useSolverChainCoin.tsx`, `apps/vaults/hooks/useVaultEstimateOutFetcher.tsx`, `apps/vaults/contexts/useActionFlow.tsx`
- Add one solver hook per solver (`useVanilla`, `useChainChoin`, `usePartnerContract`, `useWido`, `useCowswap`)
- Fix some minor UI and UX issues
- Improve some typing and linting

# 0.1.15
- Add the fetch to `https://api.yearn.finance/v1/chains/1/apy-previews/curve-factory` to get the APY for the gauges on the factory page
- Extract and reuse hooks and functions from the web-lib
- Improve Vault's search
- Remove the performance fee from Vault's strategies

# 0.1.14
- Remove the `isActive` from the gauge dropdown, as wallet connect is not required to get that list
- Add a `isClientLoaded` in `DesktopCategories` to avoid a SSR hydratation issue leading to multiple categories being selected
- Replace `getGauges` with `getAllGauges` for useCurve and adapt code to handle the changes
- Rename `useWalletNonce` to `balancesNonce` to match actual behavior and use the nonce from the useBalances hook
- Use some `toNormalizedBN` instead of raw declarations
- Add a specific code to refresh balance for a vault when you access that vault page. This will enable any old vault to get the balance even if it's not loaded in the app because of retired status.
- Bump the web-lib to `0.17.85` for the updated `useBalances` hook and
- Add an estimate code warning for the migration with an increase of `gasLimit` to avoid revert `outOfGas` issues
- Merge branch to add a `Balancer` wrap around text to make them nicer to read
- Add the `useCurrentApp` hook to make the app management easier to handle

# 0.1.13
- Release the Vaults Factory page
- Fix issue with Messari Subgraph only returning 100 results

# 0.1.12
- Add a `mutateVaultList` function to ask to refresh the vaultList in the `useYearn` context
- Add a `VoidPromiseFunction` type to mimic the `VoidFunction` type but for a function returning a `Promise`. TODO: Move to web-lib.
- Tweek the `useAsync` function to fix some issues with the dependencies and have an internal `isLoading` state. Add a mutate callback.
- Bump web-lib to `0.17.81` to get latest changes
- In the `Factory` page, add the `fetchGaugeDisplayData` to fetch the name and symbol of the gauges in order to be able to compute the actual final name and symbol for that vault.
- Enable the factory gauge in the dropdown

# 0.1.11
- Add a `GaugeDropdown` component using Combobox. To replicate to the default `TokenDropdown` component.
- Fix background color for the inputs in the `vaults/[chainID]/[address]` page from `neutral-100` to `neutral-0`
- Add the `Factory` nav item for the Vaults app
- Remove unused `apps/vaults/components/list/MigratableVaultListRow.tsx`
- Remove unused `apps/vaults/components/list/MigratableVaultsListEmpty.tsx`
- Merge `apps/vaults/components/list/VaultListExternalMigrationEmpty.tsx` in `apps/vaults/components/list/VaultListEmpty.tsx`
- Create an `useAsync` hook to be able to use it like we could use `useSWR` to get some values. It require a `callbackFunction` which will be triggered and a `defaultValue`, which will be returned until the desired value from the `callbackFunction` is loaded.
- Add the possibility to create a Vault from the Factory page with the `createVaultFromFactory` action and the Factory page
- Add the `VAULT_FACTORY_ADDRESS` to address [`0x21b1FC8A52f179757bf555346130bF27c0C2A17A`](https://etherscan.io/address/0x21b1FC8A52f179757bf555346130bF27c0C2A17A)

# 0.1.10
- Add `.env` example and update `readme` from @patcito
- Fix typos from @engn33r

# 0.1.9
- Bump dependencies
- Set resolution for `json5` to `>= 2.2.2` to fix a low impact vulnerability: the parse method of the JSON5 library before and including version 2.2.1 does not restrict parsing of keys named __proto__, allowing specially crafted strings to pollute the prototype of the resulting object.

# 0.1.8
- Fix vault access crash

# 0.1.7
- Update the `AnimatePresence`/`motion.div`/`Wrapper` setup to keep the inner app contexts between the inner app pages
- Rename `VaultsListMigratableRow.tsx` to `VaultsListInternalMigrationRow.tsx` to match external pattern

# 0.1.6
- Update the web-lib to `0.17.79` to fix a crash with Gnosis Safe

# 0.1.5
- Fix an hydratation warning in the vault page (dev only)
- Update the web-lib to `0.17.77` to use `onLoadStart` and `onLoadDone` from the `useUI` context, allowing to show a loading bar for multiple load actions
- Integrate `onLoadStart` and `onLoadDone` in `useWallet`, `useWalletForExternalMigrations`, `useWalletForInternalMigrations` and `useExtendedWallet`.
- Rename some variables
- Remove useless `useMigratableWallet.tsx` file (unused)

# 0.1.4
- Write a redirection from `yearn.fi/*` to `yearn.finance/vaults/*`
- Write a redirection from `yearn.finance/*` to `yearn.finance/ycrv/*`
- Write a redirection from `ybribe.com/*` to `yearn.finance/ybribe/*`
- Fix the "Deposited" in the vault page to take into account the deposits from deprecated vaults

# 0.1.3
- Fix the open in explorer button not redirecting to the correct page

# 0.1.2
- Update web-lib to `0.17.73`
- Fix lint issues related to `no-else-return`
- Fix lint issues related to `eol-last`

# 0.1.1
- Add bump package to bump package
- Add CHANGELOG.md

# 0.1.0
- Initial release
