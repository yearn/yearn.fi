import { KATANA_CHAIN_ID, SPECTRA_BOOST_VAULT_ADDRESSES } from '@pages/vaults/constants/addresses'
import { useVaultApyData } from '@pages/vaults/hooks/useVaultApyData'
import { RenderAmount } from '@shared/components/RenderAmount'
import { formatAmount } from '@shared/utils'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import type { ReactElement } from 'react'
import { Fragment, useState } from 'react'
import { APYDetailsModal } from './APYDetailsModal'
import { ApyDisplay } from './ApyDisplay'
import { resolveForwardApyDisplayConfig } from './apyDisplayConfig'

export type TVaultForwardAPYVariant = 'default' | 'factory-list'

export function VaultForwardAPY({
  currentVault,
  onMobileToggle,
  className,
  valueClassName,
  showSubline = true,
  showSublineTooltip = false,
  displayVariant = 'default',
  showBoostDetails = true,
  onInteractiveHoverChange
}: {
  currentVault: TYDaemonVault
  onMobileToggle?: (e: React.MouseEvent) => void
  className?: string
  valueClassName?: string
  showSubline?: boolean
  showSublineTooltip?: boolean
  displayVariant?: TVaultForwardAPYVariant
  showBoostDetails?: boolean
  onInteractiveHoverChange?: (isHovering: boolean) => void
}): ReactElement {
  const data = useVaultApyData(currentVault)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const canOpenModal = displayVariant !== 'factory-list'
  const { displayConfig, modalConfig } = resolveForwardApyDisplayConfig({
    currentVault,
    data,
    displayVariant,
    showSubline,
    showSublineTooltip,
    showBoostDetails,
    canOpenModal,
    onRequestModalOpen: (): void => setIsModalOpen(true)
  })

  const handleValueClick = (e: React.MouseEvent): void => {
    if (onMobileToggle) {
      e.preventDefault()
      e.stopPropagation()
      onMobileToggle(e)
      return
    }
    if (!modalConfig?.canOpen) {
      return
    }
    e.preventDefault()
    e.stopPropagation()
    setIsModalOpen(true)
  }

  return (
    <Fragment>
      <ApyDisplay
        config={displayConfig}
        className={className}
        valueClassName={valueClassName}
        onValueClick={handleValueClick}
        onHoverChange={onInteractiveHoverChange}
      />
      {modalConfig?.canOpen ? (
        <APYDetailsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalConfig.title}>
          {modalConfig.content}
        </APYDetailsModal>
      ) : null}
    </Fragment>
  )
}

// Inline details for mobile accordion rendering controlled by parent
export function VaultForwardAPYInlineDetails({
  currentVault,
  showBoostDetails = true
}: {
  currentVault: TYDaemonVault
  showBoostDetails?: boolean
}): ReactElement | null {
  const data = useVaultApyData(currentVault)

  // Check if vault is eligible for Spectra boost (Katana chain only)
  const isEligibleForSpectraBoost =
    currentVault.chainID === KATANA_CHAIN_ID &&
    SPECTRA_BOOST_VAULT_ADDRESSES.includes(currentVault.address.toLowerCase())

  if (currentVault.chainID === KATANA_CHAIN_ID && data.katanaExtras && data.katanaEstApr !== undefined) {
    return (
      <div className={'w-full rounded-xl border border-border bg-surface-secondary p-3 text-text-primary'}>
        <div className={'flex flex-col gap-2'}>
          <div className={'flex items-center justify-between'}>
            <p className={'text-xs text-text-primary'}>{'Est. Native APY'}</p>
            <span className={'font-number'}>
              <RenderAmount shouldHideTooltip value={data.baseForwardApr} symbol={'percent'} decimals={6} />
            </span>
          </div>
          <div className={'flex items-center justify-between'}>
            <p className={'text-xs text-text-primary'}>{'Base Rewards APR'}</p>
            <span className={'font-number'}>
              <RenderAmount
                shouldHideTooltip
                value={data.katanaExtras.FixedRateKatanaRewards ?? 0}
                symbol={'percent'}
                decimals={6}
              />
            </span>
          </div>
          <div className={'flex items-center justify-between'}>
            <p className={'text-xs text-text-primary'}>{'App Rewards APR'}</p>
            <span className={'font-number'}>
              <RenderAmount
                shouldHideTooltip
                value={data.katanaExtras.katanaAppRewardsAPR ?? data.katanaExtras.katanaRewardsAPR ?? 0}
                symbol={'percent'}
                decimals={6}
              />
            </span>
          </div>
          <div className={'flex items-center justify-between'}>
            <p className={'text-xs text-text-primary'}>{'Deposit Bonus APR'}</p>
            <span className={'font-number'}>
              <RenderAmount
                shouldHideTooltip
                value={data.katanaExtras.katanaBonusAPY ?? 0}
                symbol={'percent'}
                decimals={6}
              />
            </span>
          </div>
          {data.katanaExtras.steerPointsPerDollar && data.katanaExtras.steerPointsPerDollar > 0 ? (
            <div className={'flex items-center justify-between'}>
              <p className={'text-xs text-text-primary'}>{'Steer Points / $'}</p>
              <span className={'font-number'}>{data.katanaExtras.steerPointsPerDollar.toFixed(2)}</span>
            </div>
          ) : null}
          <div className={'mt-2 p-3 pb-0 text-text-secondary md:text-xs text-bold'}>
            <li className={'-mt-1 mb-2 w-full text-left text-xs break-words'}>
              {'KAT tokens are locked until no later than Feb. 20 2026.'}
            </li>
            <li className={'-mt-1 mb-2 w-full text-left text-xs break-words'}>
              {'KAT APR is calculated using an assumed $1B Fully Diluted Valuation.'}
            </li>
            <li className={'-mt-1 mb-2 w-full text-left text-xs break-words'}>
              {'Read more about KAT tokenomics '}
              <a
                href={'https://katana.network/blog/the-network-is-katana-the-token-is-kat'}
                target={'_blank'}
                rel={'noopener noreferrer'}
                className={
                  'font-bold underline sm:decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
                }
              >
                {'here.'}
              </a>
            </li>
            {isEligibleForSpectraBoost && (
              <li className={'-mt-1 mb-2 w-full text-left text-xs text-text-secondary break-words whitespace-normal'}>
                {'Earn boosted yield on Spectra if you '}
                <a
                  href={'https://app.spectra.finance/pools?networks=katana'}
                  target={'_blank'}
                  rel={'noopener noreferrer'}
                  className={
                    'font-bold underline sm:decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
                  }
                >
                  {'deposit to their protocol'}
                </a>
                {'.'}
              </li>
            )}
            {data.katanaExtras.steerPointsPerDollar && data.katanaExtras.steerPointsPerDollar > 0 ? (
              <li className={'-mt-1 mb-2 w-full text-left text-xs text-text-secondary break-words whitespace-normal'}>
                {'This vault earns Steer Points, but you must '}
                <a
                  href={'https://app.steer.finance/points'}
                  target={'_blank'}
                  rel={'noopener noreferrer'}
                  className={
                    'font-bold underline sm:decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
                  }
                >
                  {'register here to earn them.'}
                </a>
              </li>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  if (data.mode === 'noForward' || currentVault.chainID === KATANA_CHAIN_ID) {
    if (data.rewardsAprSum > 0) {
      return (
        <div className={'w-full rounded-xl border border-border bg-surface-secondary p-3 text-text-primary'}>
          <div className={'flex flex-col gap-2'}>
            <div className={'flex items-center justify-between'}>
              <p className={'text-xs text-text-primary'}>{'Base APY'}</p>
              <span className={'font-number'}>
                <RenderAmount shouldHideTooltip value={data.netApr} symbol={'percent'} decimals={6} />
              </span>
            </div>
            <div className={'flex items-center justify-between'}>
              <p className={'text-xs text-text-primary'}>{'Rewards APR'}</p>
              <span className={'font-number'}>
                <RenderAmount shouldHideTooltip value={data.rewardsAprSum} symbol={'percent'} decimals={6} />
              </span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  if (data.mode === 'boosted' && data.isBoosted) {
    if (!showBoostDetails) {
      return null
    }
    const unBoostedAPY = data.unboostedApr || 0
    return (
      <div className={'w-full rounded-xl border border-border bg-surface-secondary p-3 text-text-primary'}>
        <div className={'flex flex-col gap-2'}>
          <div className={'flex items-center justify-between'}>
            <p className={'text-xs text-text-primary'}>{'Base APY'}</p>
            <span className={'font-number'}>
              <RenderAmount shouldHideTooltip value={unBoostedAPY} symbol={'percent'} decimals={6} />
            </span>
          </div>
          <div className={'flex items-center justify-between'}>
            <p className={'text-xs text-text-primary'}>{'Boost'}</p>
            <span className={'font-number'}>{formatAmount(data.boost || 0, 2, 2)}x</span>
          </div>
        </div>
      </div>
    )
  }

  if (data.mode === 'rewards') {
    const isSourceVeYFI = currentVault.staking.source === 'VeYFI'
    const veYFIRange = data.veYfiRange
    return (
      <div className={'w-full rounded-xl border border-border bg-surface-secondary p-3 text-text-primary'}>
        <div className={'flex flex-col gap-2'}>
          <div className={'flex items-center justify-between'}>
            <p className={'text-xs text-text-primary'}>{'Base APY'}</p>
            <span className={'font-number'}>
              <RenderAmount shouldHideTooltip value={data.baseForwardApr} symbol={'percent'} decimals={6} />
            </span>
          </div>
          {isSourceVeYFI && veYFIRange ? (
            <div className={'flex items-center justify-between'}>
              <p className={'text-xs text-text-primary'}>{'Rewards APR'}</p>
              <span className={'font-number'}>
                <RenderAmount shouldHideTooltip value={veYFIRange[0]} symbol={'percent'} decimals={6} />
                {' → '}
                <RenderAmount shouldHideTooltip value={veYFIRange[1]} symbol={'percent'} decimals={6} />
              </span>
            </div>
          ) : (
            <div className={'flex items-center justify-between'}>
              <p className={'text-xs text-text-primary'}>{'Rewards APR'}</p>
              <span className={'font-number'}>
                <RenderAmount shouldHideTooltip value={data.rewardsAprSum} symbol={'percent'} decimals={6} />
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}
