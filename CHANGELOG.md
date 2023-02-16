# 0.1.23 (14/02/2023)
- Add the vl-yCRV page by @karelianpie

# 0.1.22 (13/02/2023)
- Fix an issue with the deposit/approve button in the deposit/withdraw flow not being correctly updated
- Update the default slippage value from `0.1` to `0.5`
- Rename the `localStorage` variables to all use a specific format for Yearn
- Fix the balances from being wipped if two `updateSome` are triggered at the same time because of a race condition
- Update the `ActionFlow` and the tabs available in the vault details page to hide the `Deposit` tab for a deprecated vault
- Update the `ImageWithFallback` to trigger a custom error catcher when the initial image is errored.
- Update the `placeholder.png` with a better one
- Prepare a new component for the mixed Tokens Icons (ex: for pools)
- Update the `ValueAnimation` to use external better hooks for the flow
- Add the `MigratableTokens` in the `useWallet` context instead of an external group of context to avoid code duplicate
- Add a Migrate tab in the vault Details page to have a consistant flow for the migration, only available when a migration is possible for a given vault.
- Add a new custom Solver `INTERNAL_MIGRATION` to handle the vault-to-vault migration
- Fix an issue with the Frame Injector being triggered in loop


# 0.1.21 (08/02/2023)
- Move the `useBalances` hook to use some Service Workers to prevent UI freeze and have better performances 
- Replace the multiple `useBalances` hook usage over the context to use the same global logic and avoid multiple balance list (making it easier to play with prices)
- Rename unused components to `something.unused.tsx`
- Add some more checks in various place to avoid undefined values and crashed
- Fix the return value of the `useBalances` hook to only return the new balance fetched in `getBalances` function
- Some cleaning and refactor to make code easier.

# 0.1.20 (06/02/2023)
- Replace the CowAppData to use a specific one for the UI
- Add a fallback for the `useBalances` hook to use the default provider if the wallet one is down/unavailable
- Add the Boost information on the vault page to display Curve's boost
- Replace APY > 500 to `APY ≧ 500%` and sort the gauges by APY in the GaugeDropdown for the Vault Factory page.

# 0.1.19 (30/01/2023)
- Add redirections to twitter via `https://yearn.finance/twitter`
- Add redirections to github via `https://yearn.finance/github`
- Add redirections to telegram via `https://yearn.finance/telegram`
- Add redirections to medium via `https://yearn.finance/medium`
- Add redirections to governance via `https://yearn.finance/governance`
- Add redirections to snapshot via `https://yearn.finance/snapshot`
- Refactor the `useAsync` to use an external hook library with expected behaviors

# 0.1.18 (24/01/2023)
- Fix the markdown not being parsed in the vault token description section
- Add a default check over nil/undef and a default fallback for the BigNumbers with `formatBN` and remove extra code
- Add an info about the contract used in the yCRV about page
- Add a fix on the signature of the coworder being triggered too early and breaking the logical flow
- Add a `isDisabled` solver info, to be able to enable/disable a specific solver.
- Replace the style of the `Connect Wallet` button to make it more visible
- Correctly reset values on the solvers on error/after a success

# 0.1.17 (23/01/2023)
- Rework the `useBalances` hook to be lighter and more reliable
- Fix some CSS issues on mobile and some global lint style
- Fix the errored Vault logo when loading a vault page from the wrong network

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
