import { RenderAmount } from '@lib/components/RenderAmount'
import { Renderable } from '@lib/components/Renderable'
import { formatAmount, isZero } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { KATANA_CHAIN_ID } from '@vaults-v3/constants/addresses'
import { useVaultApyData } from '@vaults-v3/hooks/useVaultApyData'
import type { ReactElement } from 'react'
import { Fragment } from 'react'
import { APYSubline } from './APYSubline'
import { APYTooltip } from './APYTooltip'
import { KatanaApyTooltip } from './KatanaApyTooltip'

export function VaultForwardAPY({ currentVault }: { currentVault: TYDaemonVault }): ReactElement {
  const data = useVaultApyData(currentVault)

  // Katana
  if (currentVault.chainID === KATANA_CHAIN_ID && data.katanaExtras && data.katanaTotalApr !== undefined) {
    return (
      <div className={'relative flex flex-col items-end md:text-right'}>
        <span className={'tooltip w-full'}>
          <b className={'yearn--table-data-section-item-value'}>
            <Renderable shouldRender={true} fallback={'NEW'}>
              {'⚔️ '}
              <span
                className={
                  'underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
                }
              >
                <RenderAmount value={data.katanaTotalApr} symbol={'percent'} decimals={6} />
              </span>
            </Renderable>
          </b>
          <KatanaApyTooltip
            extrinsicYield={data.katanaExtras.extrinsicYield}
            katanaNativeYield={data.katanaExtras.katanaNativeYield}
            fixedRateKatanRewardsAPR={data.katanaExtras.FixedRateKatanaRewards}
            katanaAppRewardsAPR={data.katanaExtras.katanaAppRewardsAPR}
            katanaBonusAPR={data.katanaExtras.katanaBonusAPY}
            steerPointsPerDollar={data.katanaExtras.steerPointsPerDollar}
            currentVault={currentVault}
          />
        </span>
        <APYSubline
          hasPendleArbRewards={false}
          hasKelpNEngenlayer={false}
          hasKelp={false}
          isEligibleForSteer={data.isEligibleForSteer}
          steerPointsPerDollar={data.steerPointsPerDollar}
        />
      </div>
    )
  }

  // No forward APY (or Katana with no extras)
  if (data.mode === 'noForward' || currentVault.chainID === KATANA_CHAIN_ID) {
    const hasZeroAPY = isZero(data.netApr) || Number((data.netApr || 0).toFixed(2)) === 0
    const boostedAPY = data.rewardsAprSum + data.netApr
    const hasZeroBoostedAPY = isZero(boostedAPY) || Number(boostedAPY.toFixed(2)) === 0

    if (data.rewardsAprSum > 0) {
      return (
        <div className={'relative flex flex-col items-end md:text-right'}>
          <span className={'tooltip'}>
            <b className={'yearn--table-data-section-item-value'}>
              <Renderable shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')} fallback={'NEW'}>
                {'⚡️ '}
                <span
                  className={
                    'underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
                  }
                >
                  <RenderAmount
                    shouldHideTooltip={hasZeroBoostedAPY}
                    value={boostedAPY}
                    symbol={'percent'}
                    decimals={6}
                  />
                </span>
              </Renderable>
            </b>
            <APYTooltip
              baseAPY={data.netApr}
              hasPendleArbRewards={data.hasPendleArbRewards}
              hasKelp={data.hasKelp}
              hasKelpNEngenlayer={data.hasKelpNEngenlayer}
              rewardsAPY={data.rewardsAprSum}
            />
          </span>
          <APYSubline
            hasPendleArbRewards={data.hasPendleArbRewards}
            hasKelpNEngenlayer={data.hasKelpNEngenlayer}
            hasKelp={data.hasKelp}
          />
        </div>
      )
    }

    return (
      <div className={'relative flex flex-col items-end md:text-right'}>
        <b className={'yearn--table-data-section-item-value'}>
          <Renderable shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')} fallback={'NEW'}>
            <RenderAmount value={data.netApr} shouldHideTooltip={hasZeroAPY} symbol={'percent'} decimals={6} />
          </Renderable>
        </b>
        <APYSubline
          hasPendleArbRewards={data.hasPendleArbRewards}
          hasKelpNEngenlayer={data.hasKelpNEngenlayer}
          hasKelp={data.hasKelp}
        />
      </div>
    )
  }

  // Boosted
  if (data.mode === 'boosted' && data.isBoosted) {
    const unBoostedAPY = data.unboostedApr || 0
    return (
      <span className={'tooltip'}>
        <div className={'flex flex-col items-end md:text-right'}>
          <b
            className={
              'yearn--table-data-section-item-value underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
            }
          >
            <Renderable shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')} fallback={'NEW'}>
              <RenderAmount
                shouldHideTooltip
                value={currentVault.apr.forwardAPR.netAPR}
                symbol={'percent'}
                decimals={6}
              />
            </Renderable>
          </b>
          <small className={'text-xs text-neutral-800'}>
            <Renderable shouldRender={data.isBoosted}>{`BOOST ${formatAmount(data.boost || 0, 2, 2)}x`}</Renderable>
          </small>
          <APYTooltip
            baseAPY={unBoostedAPY}
            hasPendleArbRewards={data.hasPendleArbRewards}
            hasKelpNEngenlayer={data.hasKelpNEngenlayer}
            hasKelp={data.hasKelp}
            boost={data.boost}
          />
        </div>
      </span>
    )
  }

  // Rewards (VeYFI or generic)
  if (data.mode === 'rewards') {
    const isSourceVeYFI = currentVault.staking.source === 'VeYFI'
    let veYFIRange: [number, number] | undefined
    let estAPYRange: [number, number] | undefined
    let boostedAPY: number
    let hasZeroBoostedAPY: boolean

    if (isSourceVeYFI) {
      veYFIRange = data.veYfiRange
      boostedAPY = (veYFIRange?.[0] || 0) + data.baseForwardApr
      hasZeroBoostedAPY = isZero(boostedAPY) || Number(boostedAPY.toFixed(2)) === 0
      estAPYRange = data.estAprRange
    } else {
      boostedAPY = data.rewardsAprSum + data.baseForwardApr
      hasZeroBoostedAPY = isZero(boostedAPY) || Number(boostedAPY.toFixed(2)) === 0
    }

    return (
      <div className={'relative flex flex-col items-end md:text-right'}>
        <span className={'tooltip'}>
          <b className={'yearn--table-data-section-item-value whitespace-nowrap'}>
            <Renderable shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')} fallback={'NEW'}>
              {'⚡️ '}
              <span
                className={
                  'underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
                }
              >
                {estAPYRange ? (
                  <Fragment>
                    <RenderAmount shouldHideTooltip value={estAPYRange[0]} symbol={'percent'} decimals={6} />
                    &nbsp;&rarr;&nbsp;
                    <RenderAmount shouldHideTooltip value={estAPYRange[1]} symbol={'percent'} decimals={6} />
                  </Fragment>
                ) : (
                  <RenderAmount
                    shouldHideTooltip={hasZeroBoostedAPY}
                    value={boostedAPY}
                    symbol={'percent'}
                    decimals={6}
                  />
                )}
              </span>
            </Renderable>
          </b>
          <APYTooltip
            baseAPY={data.baseForwardApr}
            rewardsAPY={veYFIRange ? undefined : data.rewardsAprSum}
            hasPendleArbRewards={data.hasPendleArbRewards}
            hasKelpNEngenlayer={data.hasKelpNEngenlayer}
            hasKelp={data.hasKelp}
            range={veYFIRange}
          />
        </span>
        <APYSubline
          hasPendleArbRewards={data.hasPendleArbRewards}
          hasKelp={data.hasKelp}
          hasKelpNEngenlayer={data.hasKelpNEngenlayer}
        />
      </div>
    )
  }

  // Spot forward APY
  if (data.mode === 'spot') {
    return (
      <div className={'relative flex flex-col items-end md:text-right'}>
        <b className={'yearn--table-data-section-item-value'}>
          <Renderable shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')} fallback={'NEW'}>
            {currentVault?.info?.isBoosted ? '⚡️ ' : ''}
            <RenderAmount shouldHideTooltip value={data.baseForwardApr} symbol={'percent'} decimals={6} />
          </Renderable>
        </b>
        <APYSubline
          hasPendleArbRewards={data.hasPendleArbRewards}
          hasKelp={data.hasKelp}
          hasKelpNEngenlayer={data.hasKelpNEngenlayer}
        />
      </div>
    )
  }

  // Fallback historical APY
  const hasZeroAPY = isZero(data.netApr) || Number((data.netApr || 0).toFixed(2)) === 0
  return (
    <div className={'relative flex flex-col items-end md:text-right'}>
      <b className={'yearn--table-data-section-item-value'}>
        <Renderable
          shouldRender={!currentVault.apr.forwardAPR?.type.includes('new') && !currentVault.apr.type.includes('new')}
          fallback={'NEW'}
        >
          {currentVault?.info?.isBoosted ? '⚡️ ' : ''}
          <RenderAmount shouldHideTooltip={hasZeroAPY} value={data.netApr} symbol={'percent'} decimals={6} />
        </Renderable>
      </b>
      <APYSubline
        hasPendleArbRewards={data.hasPendleArbRewards}
        hasKelp={data.hasKelp}
        hasKelpNEngenlayer={data.hasKelpNEngenlayer}
      />
    </div>
  )
}
