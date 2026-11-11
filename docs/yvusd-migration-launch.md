# Legacy yvUSD migration launch checklist

The playground branch can exercise both migration destinations on a local fork.
Use this checklist to switch the frontend to the production deployment.

## Deployment and Kong

- [ ] Update [`YVUSD_TRANCHE_DEPLOYMENT`](../apps/yearn/src/components/pages/vaults/constants/tranchedProducts.ts)
  with the confirmed chain, underlying asset, vault, controller, hook, and tranche
  addresses. The Migrate selector currently maps Senior to `tranches.fixed` and
  Junior to `tranches.levered`. Verify both destinations accept the asset
  redeemed from Legacy yvUSD and use the correct share decimals.
- [ ] Publish Legacy yvUSD's migration metadata in Kong. Set `migration: true`
  for the unlocked Legacy vault in `/list/vaults` and
  `meta.migration.available: true` plus `meta.migration.contract` in its
  `/snapshot/1/<legacy-unlocked-address>` response. The legacy widget uses that
  availability flag for both source tabs. It takes the selected target address
  from `YVUSD_TRANCHE_DEPLOYMENT`. Confirm that any consumers of Kong's single
  `meta.migration.target` field receive the intended default destination.
- [ ] Verify the migrator's ABI, spender, recipient, and transaction sequence.
  [`useMigrateFlow.ts`](../apps/yearn/src/components/pages/vaults/components/widget/migrate/useMigrateFlow.ts)
  falls back to the standard Yearn ERC-4626 router for addresses outside
  [`MIGRATOR_REGISTRY`](../apps/yearn/src/components/shared/utils/migratorRegistry.ts).
  If the deployment uses a new migrator, register it and update the
  [locked batch builder](../apps/yearn/src/components/pages/vaults/components/widget/yvUSD/lockedMigration.ts),
  which currently only builds batches for the standard router.
- [ ] Set and verify the minimum destination shares in both the unlocked
  migration and locked batch paths. The current router calls pass
  `minSharesOut = 0n`. Use a quote for the selected tranche and test that the
  transaction reverts below the accepted minimum.

## Playground overrides and displayed data

- [ ] After verifying both Kong responses, remove the Legacy yvUSD override
  from [`fetchQuery.ts`](../apps/yearn/src/components/shared/utils/fetchQuery.ts)
  and the fork-only router fallback from
  [`YvUsdMigrate.tsx`](../apps/yearn/src/components/pages/vaults/components/widget/yvUSD/YvUsdMigrate.tsx).
  Recheck the Migrate tab on a fresh page load with fork mode disabled.
- [ ] Replace the tranche catalog's sample TVL, APY, total assets, price per
  share, capacity, and token prices with indexed or onchain data. Point
  [`TranchedVaultChartsSection`](../apps/yearn/src/components/pages/vaults/components/tranched/TranchedVaultChartsSection.tsx)
  at each tranche's history. The playground charts currently derive series from
  underlying vaults and apply synthetic Senior and Junior values. Keep yvETH
  preview rows out of the live catalog until their addresses and data are ready.
- [ ] Update the Migrate panel's docs and live-data links to the launch URLs.
  Verify the 5% Senior target and each tranche's withdrawal terms against the
  deployed configuration. The current Migrate panel says Junior has no cooldown
  while the current Junior withdrawal widget implements one.

## End-to-end verification

- [ ] On a fresh fork of the production deployment, migrate unlocked Legacy
  yvUSD into Senior and Junior. Verify the recipient, shares received, and
  refreshed source and destination balances. Check permit and approval paths.
- [ ] Exercise locked positions before cooldown completion, during the
  withdrawal window, and after it expires. Verify that only the cooled amount
  can be unlocked and migrated. Test a wallet with atomic batching and one with
  sequential transactions. Reject the migration after a successful unlock and
  verify that the proceeds are available in the Unlocked tab.
- [ ] Verify that insufficient liquidity, deposit capacity, or minimum output
  blocks execution and gives the user a clear error. After success, confirm
  that the migration panel and its selectors remain usable when the source
  balance drops to zero.
