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