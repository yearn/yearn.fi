import { KATANA_CHAIN_ID } from '@pages/vaults/constants/addresses'
import { useVaultApyData } from '@pages/vaults/hooks/useVaultApyData'
import { RenderAmount } from '@shared/components/RenderAmount'
import { Renderable } from '@shared/components/Renderable'
import { Tooltip } from '@shared/components/Tooltip'
import { cl, isZero } from '@shared/utils'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import type { ReactElement } from 'react'
import { Fragment, useState } from 'react'
import { APYDetailsModal } from './APYDetailsModal'
import { KatanaApyTooltipContent } from './KatanaApyTooltip'

export function VaultHistoricalAPY({
  currentVault,
  className,
  valueClassName
}: {
  currentVault: TYDaemonVault
  className?: string
  valueClassName?: string
}): ReactElement {
  const data = useVaultApyData(currentVault)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const shouldUseKatanaAPRs = currentVault.chainID === KATANA_CHAIN_ID
  const monthlyAPY = currentVault.apr.points.monthAgo
  const weeklyAPY = currentVault.apr.points.weekAgo

  const katanaThirtyDayApr = data.katanaThirtyDayApr
  const hasKatanaApr = typeof katanaThirtyDayApr === 'number'
  const standardThirtyDayApr = isZero(monthlyAPY) ? weeklyAPY : monthlyAPY
  const displayValue = shouldUseKatanaAPRs ? (katanaThirtyDayApr ?? 0) : standardThirtyDayApr
  const shouldRenderValue = shouldUseKatanaAPRs ? hasKatanaApr : !currentVault.apr?.type.includes('new')
  const fallbackLabel = shouldUseKatanaAPRs ? '-' : 'NEW'
  const hasZeroAPY = isZero(displayValue || 0) || Number((displayValue || 0).toFixed(2)) === 0
  const tooltipUnderlineClass = shouldRenderValue
    ? 'underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
    : undefined
  const valueInteractiveClass = shouldRenderValue ? 'cursor-pointer' : undefined

  const tooltipContent = (
    <div className={'rounded-xl border border-border bg-surface-secondary px-2 py-1 text-xs text-text-primary'}>
      {'Average realized APY over the previous 30 days.'}
    </div>
  )

  const modalTitle = shouldUseKatanaAPRs ? 'Katana 30 Day APY breakdown' : '30 Day APY breakdown'
  const modalContent =
    shouldUseKatanaAPRs && data.katanaExtras ? (
      <KatanaApyTooltipContent
        katanaNativeYield={data.katanaExtras.katanaNativeYield ?? 0}
        fixedRateKatanRewardsAPR={data.katanaExtras.FixedRateKatanaRewards ?? 0}
        katanaAppRewardsAPR={data.katanaExtras.katanaAppRewardsAPR ?? data.katanaExtras.katanaRewardsAPR ?? 0}
        katanaBonusAPR={data.katanaExtras.katanaBonusAPY ?? 0}
        steerPointsPerDollar={data.katanaExtras.steerPointsPerDollar}
        currentVault={currentVault}
        maxWidth={'w-full'}
      />
    ) : (
      <div
        className={
          'w-fit rounded-xl border border-border bg-surface-secondary p-4 text-center text-sm text-text-primary'
        }
      >
        <div
          className={'flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-text-primary md:text-sm'}
        >
          <p>{'30 Day APY '}</p>
          <span className={'font-number'}>
            <RenderAmount shouldHideTooltip value={displayValue || 0} symbol={'percent'} decimals={6} />
          </span>
        </div>
      </div>
    )

  const handleValueClick = (): void => {
    if (!shouldRenderValue) {
      return
    }
    setIsModalOpen(true)
  }

  const valueNode = (
    <b
      className={cl(
        'yearn--table-data-section-item-value',
        valueClassName,
        tooltipUnderlineClass,
        valueInteractiveClass
      )}
      onClick={handleValueClick}
    >
      <Renderable shouldRender={shouldRenderValue} fallback={fallbackLabel}>
        <RenderAmount shouldHideTooltip={hasZeroAPY} value={displayValue || 0} symbol={'percent'} decimals={6} />
      </Renderable>
    </b>
  )

  return (
    <Fragment>
      <div className={cl('flex flex-col items-end md:text-right', className)}>
        {shouldRenderValue ? (
          <Tooltip
            className={'apy-subline-tooltip gap-0 h-auto md:justify-end'}
            openDelayMs={150}
            side={'top'}
            tooltip={tooltipContent}
          >
            {valueNode}
          </Tooltip>
        ) : (
          valueNode
        )}
      </div>
      <APYDetailsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalTitle}>
        {modalContent}
      </APYDetailsModal>
    </Fragment>
  )
}
