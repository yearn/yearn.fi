import { RenderAmount } from '@lib/components/RenderAmount'
import { Renderable } from '@lib/components/Renderable'
import { cl, isZero } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { KATANA_CHAIN_ID } from '@vaults/constants/addresses'
import type { ReactElement } from 'react'

export function VaultHistoricalAPY({
  currentVault,
  className,
  valueClassName
}: {
  currentVault: TYDaemonVault
  className?: string
  valueClassName?: string
}): ReactElement {
  // TEMPORARY HACK: Force 'NEW' APY for chainID KATANA
  const shouldUseKatanaAPRs = currentVault.chainID === KATANA_CHAIN_ID
  const hasZeroAPY = isZero(currentVault.apr?.netAPR) || Number((currentVault.apr?.netAPR || 0).toFixed(2)) === 0
  const monthlyAPY = currentVault.apr.points.monthAgo
  const weeklyAPY = currentVault.apr.points.weekAgo

  if (shouldUseKatanaAPRs) {
    return (
      <div className={cl('flex flex-col items-end md:text-right', className)}>
        <b className={cl('yearn--table-data-section-item-value', valueClassName)}>
          <Renderable shouldRender={!shouldUseKatanaAPRs} fallback={'-'}>
            <RenderAmount
              value={isZero(monthlyAPY) ? weeklyAPY : monthlyAPY}
              shouldHideTooltip={hasZeroAPY}
              symbol={'percent'}
              decimals={6}
            />
          </Renderable>
        </b>
      </div>
    )
  }

  return (
    <div className={cl('flex flex-col items-end md:text-right', className)}>
      <b className={cl('yearn--table-data-section-item-value', valueClassName)}>
        <Renderable shouldRender={!currentVault.apr?.type.includes('new')} fallback={'NEW'}>
          <RenderAmount
            value={isZero(monthlyAPY) ? weeklyAPY : monthlyAPY}
            shouldHideTooltip={hasZeroAPY}
            symbol={'percent'}
            decimals={6}
          />
        </Renderable>
      </b>
    </div>
  )
}
