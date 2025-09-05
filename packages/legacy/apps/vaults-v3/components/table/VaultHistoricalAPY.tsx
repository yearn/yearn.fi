import { RenderAmount } from '@lib/components/RenderAmount'
import { Renderable } from '@lib/components/Renderable'
import { isZero } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import type { ReactElement } from 'react'

export function VaultHistoricalAPY({ currentVault }: { currentVault: TYDaemonVault }): ReactElement {
  // TEMPORARY HACK: Force 'NEW' APY for chainID 747474
  const shouldUseKatanaAPRs = currentVault.chainID === 747474
  const hasZeroAPY = isZero(currentVault.apr?.netAPR) || Number((currentVault.apr?.netAPR || 0).toFixed(2)) === 0
  const monthlyAPY = currentVault.apr.points.monthAgo
  const weeklyAPY = currentVault.apr.points.weekAgo

  if (shouldUseKatanaAPRs) {
    return (
      <div className={'flex flex-col items-end md:text-right'}>
        <b className={'yearn--table-data-section-item-value'}>
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
    <div className={'flex flex-col items-end md:text-right'}>
      <b className={'yearn--table-data-section-item-value'}>
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
