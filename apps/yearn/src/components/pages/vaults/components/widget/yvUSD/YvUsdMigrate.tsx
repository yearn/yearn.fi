import { WidgetMigrate } from '@pages/vaults/components/widget/migrate'
import { useYvUsdMigrationFlow } from '@pages/vaults/components/widget/yvUSD/useYvUsdMigrationFlow'
import { YvUsdVariantToggle } from '@pages/vaults/components/widget/yvUSD/YvUsdVariantToggle'
import {
  getTranchedVaultRowByAddress,
  type TTranchedProductKind,
  YVUSD_TRANCHE_DEPLOYMENT
} from '@pages/vaults/constants/tranchedProducts'
import type { TKongVaultView } from '@pages/vaults/domain/kongVaultSelectors'
import { useVaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import { useYvUsdVaults } from '@pages/vaults/hooks/useYvUsdVaults'
import {
  convertYvUsdLockedPricePerShareToUnderlying,
  type TYvUsdVariant,
  YVUSD_LOCKED_ADDRESS,
  YVUSD_UNLOCKED_ADDRESS
} from '@pages/vaults/utils/yvUsd'
import { Button } from '@shared/components/Button'
import { cl, isZeroAddress, SELECTOR_BAR_STYLES, YEARN_4626_ROUTER } from '@shared/utils'
import { InfoOverlay } from '@yearn/vault-widget/advanced'
import type { ReactElement } from 'react'
import { useState } from 'react'
import { useAccount } from 'wagmi'
import { isTenderlyModeEnabled } from '@/config/tenderly'
import { env } from '@/env'

const YTRANCHE_DOCS_URL = 'https://github.com/yearn/ytranche#readme'
const YTRANCHE_LIVE_DATA_URL = 'https://ytranche-git-separate-ui-w84aprils-projects.vercel.app/institutions'

type Props = {
  currentVault: TKongVaultView
  chainId: number
  destination: TTranchedProductKind
  onDestinationChange: (destination: TTranchedProductKind) => void
  onUnlock: () => void
  onMigrateSuccess?: () => void
}

export function YvUsdMigrate({
  currentVault,
  chainId,
  destination,
  onDestinationChange,
  onUnlock,
  onMigrateSuccess
}: Props): ReactElement {
  const { address: account } = useAccount()
  const { unlockedVault, assetAddress } = useYvUsdVaults()
  const [variant, setVariant] = useState<TYvUsdVariant | null>(null)
  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const unlockedUserData = useVaultUserData({
    vaultAddress: YVUSD_UNLOCKED_ADDRESS,
    assetAddress,
    chainId,
    account
  })
  const lockedUserData = useVaultUserData({
    vaultAddress: YVUSD_LOCKED_ADDRESS,
    assetAddress: YVUSD_UNLOCKED_ADDRESS,
    chainId,
    account
  })
  const unlockedBalance = unlockedUserData.vaultToken?.balance.raw ?? 0n
  const lockedBalance = lockedUserData.vaultToken?.balance.raw ?? 0n
  const activeVariant = variant ?? (lockedBalance > 0n && unlockedBalance === 0n ? 'locked' : 'unlocked')
  const isLockedVariant = activeVariant === 'locked'
  const selectedUserData = isLockedVariant
    ? {
        ...lockedUserData,
        assetToken: unlockedUserData.assetToken,
        pricePerShare: convertYvUsdLockedPricePerShareToUnderlying({
          lockedPricePerShare: lockedUserData.pricePerShare,
          unlockedPricePerShare: unlockedUserData.pricePerShare,
          unlockedVaultDecimals: unlockedUserData.vaultToken?.decimals ?? unlockedVault.decimals
        }),
        isLoading: lockedUserData.isLoading || unlockedUserData.isLoading
      }
    : unlockedUserData
  const destinationAddress =
    destination === 'senior' ? YVUSD_TRANCHE_DEPLOYMENT.tranches.fixed : YVUSD_TRANCHE_DEPLOYMENT.tranches.levered
  const migrationContract =
    env.DEV && isTenderlyModeEnabled() && isZeroAddress(currentVault.migration.contract)
      ? YEARN_4626_ROUTER
      : currentVault.migration.contract
  const flow = useYvUsdMigrationFlow({
    account,
    chainId,
    isLocked: isLockedVariant,
    router: migrationContract,
    assetAddress,
    destination: destinationAddress,
    unlockedUserData,
    lockedUserData,
    onVariantChange: setVariant,
    onMigrateSuccess
  })
  const destinationLabel = destination === 'senior' ? 'Senior' : 'Junior'
  const destinationLogoURI = getTranchedVaultRowByAddress(destinationAddress)?.logoSrc
  const destinationItems =
    destination === 'senior'
      ? ['5% Target APY', 'Lower risk, steady return', 'No lockups or cooldowns']
      : ['No target APY', 'Higher risk, higher yield', 'No lockups or cooldown']

  return (
    <div className="relative flex flex-col">
      <WidgetMigrate
        key={`${activeVariant}-${destinationAddress}`}
        vaultAddress={YVUSD_UNLOCKED_ADDRESS}
        assetAddress={assetAddress}
        chainId={chainId}
        vaultSymbol={'yvUSD (Unlocked)'}
        vaultVersion={unlockedVault.version}
        vaultUserData={unlockedUserData}
        displayVaultUserData={flow.needsUnlock ? selectedUserData : undefined}
        balanceLabel={flow.hasPendingMigration && !flow.needsUnlock ? 'Ready to migrate' : 'Total Balance'}
        readyBalance={flow.readyLockedShares}
        migrationBalanceOverride={flow.migrationAmount}
        transactionStepOverride={flow.transactionStep}
        onTransactionStepSuccess={flow.onStepSuccess}
        actionLabelOverride={
          flow.isReadyToUnlock ? 'Unlock & Migrate' : flow.hasPendingMigration ? 'Finish Migration' : undefined
        }
        migrationTarget={destinationAddress}
        migrationTargetSymbol={`yvUSD ${destinationLabel}`}
        migrationTargetLogoURI={destinationLogoURI}
        migrationContract={migrationContract}
        handleMigrateSuccess={flow.completeMigration}
        disableFlow={isLockedVariant && !flow.isReadyToUnlock && !flow.hasPendingMigration}
        hideContainerBorder
        onTransactionOpenChange={flow.onTransactionOpenChange}
        headerActions={
          <YvUsdVariantToggle
            activeVariant={activeVariant}
            onChange={flow.selectVariant}
            disabled={flow.isTransactionOpen}
          />
        }
        destinationActions={
          <fieldset
            aria-label="Destination tranche"
            className={cl('flex items-center gap-0.5 md:gap-1', SELECTOR_BAR_STYLES.container)}
          >
            {(['senior', 'junior'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                aria-pressed={destination === kind}
                disabled={flow.isTransactionOpen}
                onClick={() => onDestinationChange(kind)}
                className={cl(
                  'rounded-sm px-2 md:px-3 h-[36px] md:h-[26px] text-xs font-semibold transition-all',
                  'active:scale-[0.98] whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50',
                  SELECTOR_BAR_STYLES.buttonBase,
                  destination === kind ? SELECTOR_BAR_STYLES.buttonActive : SELECTOR_BAR_STYLES.buttonInactive
                )}
              >
                {kind === 'senior' ? 'Senior' : 'Junior'}
              </button>
            ))}
          </fieldset>
        }
        contentAboveButton={
          <div className="space-y-3" aria-live="polite">
            <div className="rounded-lg border border-primary/80 bg-surface-tertiary/80 px-3 py-2 text-sm text-text-primary">
              <div className="flex items-center gap-2 mb-2">
                <p className="font-semibold">{`${destinationLabel} vault`}</p>
                <button
                  type="button"
                  onClick={() => setIsInfoOpen(true)}
                  className="text-xs font-medium text-text-secondary underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-colors hover:text-text-primary hover:decoration-neutral-600"
                >
                  {'more info'}
                </button>
              </div>
              <ul className="list-disc space-y-1 pl-5">
                {destinationItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            {isLockedVariant ? (
              <p className="text-sm text-text-secondary">
                {flow.isReadyToUnlock
                  ? 'Your cooldown is complete. Unlock & Migrate moves the available capital into the selected vault. Confirm each wallet request to continue.'
                  : flow.hasPendingMigration
                    ? 'Your yvUSD is unlocked. Continuing to migration.'
                    : 'Complete the cooldown in Withdraw. Once the withdrawal window opens, return here to Unlock & Migrate.'}
              </p>
            ) : null}
            {flow.hasPendingMigration && !flow.isTransactionOpen ? (
              <p className="text-sm text-text-secondary">
                {
                  'Unlock complete. Your funds are available as unlocked yvUSD. Finish the migration when you are ready.'
                }
              </p>
            ) : null}
          </div>
        }
        actionButtonOverride={
          isLockedVariant && account && !flow.isReadyToUnlock && !flow.hasPendingMigration ? (
            <Button
              variant="filled"
              disabled={lockedBalance === 0n || selectedUserData.isLoading}
              classNameOverride="yearn--button--nextgen w-full"
              onClick={onUnlock}
            >
              {'Unlock'}
            </Button>
          ) : undefined
        }
      />
      {isInfoOpen ? (
        <InfoOverlay isOpen onClose={() => setIsInfoOpen(false)} title={`${destinationLabel} vault info`}>
          <div className="space-y-4 text-sm text-text-secondary">
            <div className="space-y-1">
              <p className="font-semibold text-text-primary">{'How returns work'}</p>
              <p>
                {destination === 'senior'
                  ? 'Senior has priority over Junior when yield is distributed and aims for a 5% APY. This is a target, not a guaranteed return.'
                  : 'Junior receives a share of yield after Senior obligations. Returns vary with vault performance and the allocation of excess yield. The controller can use an internal target rate for accounting; this does not make Junior a fixed-return product.'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-text-primary">{'Risk and protection'}</p>
              <p>
                {destination === 'senior'
                  ? 'Junior and any available reserve or equity buffers absorb losses before Senior. Senior can still lose value if those buffers are exhausted. Lower risk refers to its position relative to Junior.'
                  : 'Junior absorbs losses before Senior, after any available reserve and equity buffers. Higher yield is possible, but it is not guaranteed.'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-text-primary">{'Withdrawals'}</p>
              <p>
                {
                  'There is no scheduled lockup or cooldown for this destination. Withdrawals remain subject to available liquidity and protocol limits. Check the live data for the current configuration.'
                }
              </p>
              {isLockedVariant ? (
                <p>
                  {
                    'After the Legacy cooldown finishes, Unlock & Migrate guides you through unlocking and migration. Wallets that support atomic batches can combine the steps.'
                  }
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-4">
              <a
                href={YTRANCHE_DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-text-primary underline underline-offset-4"
              >
                {'Documentation'}
              </a>
              <a
                href={YTRANCHE_LIVE_DATA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-text-primary underline underline-offset-4"
              >
                {'Live data'}
              </a>
            </div>
          </div>
        </InfoOverlay>
      ) : null}
    </div>
  )
}
