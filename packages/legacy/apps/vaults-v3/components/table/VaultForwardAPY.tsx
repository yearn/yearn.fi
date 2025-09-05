import { RenderAmount } from '@lib/components/RenderAmount'
import { Renderable } from '@lib/components/Renderable'
import { useYearn } from '@lib/contexts/useYearn'
import type { TKatanaAprData } from '@lib/hooks/useKatanaAprs'
import { formatAmount, isZero, toAddress } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { VAULT_ADDRESSES } from '@vaults-v3/constants/addresses'
import type { ReactElement } from 'react'
import { Fragment, useMemo } from 'react'
import { APYSubline } from './APYSubline'
import { APYTooltip } from './APYTooltip'
import { KatanaApyTooltip } from './KatanaApyTooltip'

export function VaultForwardAPY({ currentVault }: { currentVault: TYDaemonVault }): ReactElement {
  // Override for Katana vaults
  const shouldUseKatanaAPRs = currentVault.chainID === 747474
  // Always call hooks at the top level
  const { katanaAprs } = useYearn()

  // Memoize the Katana APR data to avoid unnecessary recalculations
  const katanaAprData = useMemo(
    () =>
      shouldUseKatanaAPRs
        ? (katanaAprs?.[toAddress(currentVault.address)]?.apr?.extra as TKatanaAprData | undefined)
        : undefined,
    [shouldUseKatanaAPRs, katanaAprs, currentVault.address]
  )

  const isEligibleForSteer =
    katanaAprData?.steerPointsPerDollar !== undefined && katanaAprData?.steerPointsPerDollar > 0

  const totalAPR = useMemo(() => {
    if (!katanaAprData) return 0
    // Exclude legacy katanaRewardsAPR to avoid double counting with katanaAppRewardsAPR
    const {
      katanaRewardsAPR: _katanaRewardsAPR,
      katanaBonusAPY: _bonus,
      steerPointsPerDollar: _points,
      ...relevantAprs
    } = katanaAprData
    return Object.values(relevantAprs).reduce((sum, value) => sum + value, 0)
  }, [katanaAprData])

  // if Katana, get the APRs from context
  if (shouldUseKatanaAPRs && katanaAprData) {
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
                <RenderAmount value={totalAPR} symbol={'percent'} decimals={6} />
              </span>
            </Renderable>
          </b>
          <KatanaApyTooltip
            extrinsicYield={katanaAprData.extrinsicYield}
            katanaNativeYield={katanaAprData.katanaNativeYield}
            fixedRateKatanRewardsAPR={katanaAprData.FixedRateKatanaRewards}
            katanaAppRewardsAPR={katanaAprData.katanaAppRewardsAPR}
            katanaBonusAPR={katanaAprData.katanaBonusAPY}
            steerPointsPerDollar={katanaAprData?.steerPointsPerDollar}
            currentVault={currentVault}
          />
        </span>
        <APYSubline
          hasPendleArbRewards={false}
          hasKelpNEngenlayer={false}
          hasKelp={false}
          isEligibleForSteer={isEligibleForSteer}
          steerPointsPerDollar={katanaAprData?.steerPointsPerDollar}
        />
      </div>
    )
  }

  const isEthMainnet = currentVault.chainID === 1
  const hasPendleArbRewards = currentVault.address === toAddress(VAULT_ADDRESSES.PENDLE_ARB_REWARDS)
  const hasKelpNEngenlayer = currentVault.address === toAddress(VAULT_ADDRESSES.KELP_N_ENGENLAYER)
  const hasKelp = currentVault.address === toAddress(VAULT_ADDRESSES.KELP)

  /**********************************************************************************************
   ** If there is no forwardAPY, we only have the historical APY to display.
   **********************************************************************************************/
  if (currentVault.apr.forwardAPR.type === '' || shouldUseKatanaAPRs) {
    const hasZeroAPY = isZero(currentVault.apr?.netAPR) || Number((currentVault.apr?.netAPR || 0).toFixed(2)) === 0
    const boostedAPY = currentVault.apr.extra.stakingRewardsAPR + currentVault.apr.netAPR
    const hasZeroBoostedAPY = isZero(boostedAPY) || Number(boostedAPY.toFixed(2)) === 0

    if (currentVault.apr?.extra.stakingRewardsAPR > 0) {
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
              baseAPY={currentVault.apr.netAPR}
              hasPendleArbRewards={hasPendleArbRewards}
              hasKelp={hasKelp}
              hasKelpNEngenlayer={hasKelpNEngenlayer}
              rewardsAPY={currentVault.apr.extra.stakingRewardsAPR}
            />
          </span>
          <APYSubline
            hasPendleArbRewards={hasPendleArbRewards}
            hasKelpNEngenlayer={hasKelpNEngenlayer}
            hasKelp={hasKelp}
          />
        </div>
      )
    }
    return (
      <div className={'relative flex flex-col items-end md:text-right'}>
        <b className={'yearn--table-data-section-item-value'}>
          <Renderable shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')} fallback={'NEW'}>
            <RenderAmount
              value={currentVault.apr?.netAPR}
              shouldHideTooltip={hasZeroAPY}
              symbol={'percent'}
              decimals={6}
            />
          </Renderable>
        </b>
        <APYSubline
          hasPendleArbRewards={hasPendleArbRewards}
          hasKelpNEngenlayer={hasKelpNEngenlayer}
          hasKelp={hasKelp}
        />
      </div>
    )
  }

  /**********************************************************************************************
   ** If we are on eth mainnet and the vault has a boost, we display the APY with the boost.
   ** This is mostly valid for Curve vaults.
   **********************************************************************************************/
  if (isEthMainnet && currentVault.apr.forwardAPR.composite?.boost > 0 && !currentVault.apr.extra.stakingRewardsAPR) {
    const unBoostedAPY = currentVault.apr.forwardAPR.netAPR / currentVault.apr.forwardAPR.composite.boost
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
            <Renderable
              shouldRender={
                isEthMainnet &&
                currentVault.apr.forwardAPR.composite?.boost > 0 &&
                !currentVault.apr.extra.stakingRewardsAPR
              }
            >
              {`BOOST ${formatAmount(currentVault.apr.forwardAPR.composite?.boost, 2, 2)}x`}
            </Renderable>
          </small>
          <APYTooltip
            baseAPY={unBoostedAPY}
            hasPendleArbRewards={hasPendleArbRewards}
            hasKelpNEngenlayer={hasKelpNEngenlayer}
            hasKelp={hasKelp}
            boost={currentVault.apr.forwardAPR.composite.boost}
          />
        </div>
      </span>
    )
  }

  /**********************************************************************************************
   ** Display the APY including the rewards APY if the rewards APY is greater than 0.
   **********************************************************************************************/
  const sumOfRewardsAPY = currentVault.apr.extra.stakingRewardsAPR + currentVault.apr.extra.gammaRewardAPR
  const isSourceVeYFI = currentVault.staking.source === 'VeYFI'
  if (sumOfRewardsAPY > 0) {
    let veYFIRange: [number, number] | undefined
    let estAPYRange: [number, number] | undefined
    let boostedAPY: number
    let hasZeroBoostedAPY: boolean

    if (isSourceVeYFI) {
      veYFIRange = [
        currentVault.apr.extra.stakingRewardsAPR / 10 + currentVault.apr.extra.gammaRewardAPR,
        sumOfRewardsAPY
      ] as [number, number]
      boostedAPY = veYFIRange[0] + currentVault.apr.forwardAPR.netAPR
      hasZeroBoostedAPY = isZero(boostedAPY) || Number(boostedAPY.toFixed(2)) === 0
      estAPYRange = [
        veYFIRange[0] + currentVault.apr.forwardAPR.netAPR,
        veYFIRange[1] + currentVault.apr.forwardAPR.netAPR
      ] as [number, number]
    } else {
      boostedAPY = sumOfRewardsAPY + currentVault.apr.forwardAPR.netAPR
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
            baseAPY={currentVault.apr.forwardAPR.netAPR}
            rewardsAPY={veYFIRange ? undefined : sumOfRewardsAPY}
            hasPendleArbRewards={hasPendleArbRewards}
            hasKelpNEngenlayer={hasKelpNEngenlayer}
            hasKelp={hasKelp}
            range={veYFIRange}
          />
        </span>
        <APYSubline
          hasPendleArbRewards={hasPendleArbRewards}
          hasKelp={hasKelp}
          hasKelpNEngenlayer={hasKelpNEngenlayer}
        />
      </div>
    )
  }

  /**********************************************************************************************
   ** Display the current spot APY, retrieved from the V3Oracle, only if the current APY is
   ** greater than 0.
   **********************************************************************************************/
  const hasCurrentAPY = !isZero(currentVault?.apr.forwardAPR.netAPR)
  if (hasCurrentAPY) {
    return (
      <div className={'relative flex flex-col items-end md:text-right'}>
        <b className={'yearn--table-data-section-item-value'}>
          <Renderable shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')} fallback={'NEW'}>
            {currentVault?.info?.isBoosted ? '⚡️ ' : ''}
            <RenderAmount
              shouldHideTooltip
              value={currentVault?.apr.forwardAPR.netAPR}
              symbol={'percent'}
              decimals={6}
            />
          </Renderable>
        </b>
        <APYSubline
          hasPendleArbRewards={hasPendleArbRewards}
          hasKelp={hasKelp}
          hasKelpNEngenlayer={hasKelpNEngenlayer}
        />
      </div>
    )
  }

  const hasZeroAPY = isZero(currentVault.apr?.netAPR) || Number((currentVault.apr?.netAPR || 0).toFixed(2)) === 0
  return (
    <div className={'relative flex flex-col items-end md:text-right'}>
      <b className={'yearn--table-data-section-item-value'}>
        <Renderable
          shouldRender={
            (!currentVault.apr.forwardAPR?.type.includes('new') && !currentVault.apr.type.includes('new')) ||
            currentVault.chainID === 747474
          }
          fallback={'NEW'}
        >
          {currentVault?.info?.isBoosted ? '⚡️ ' : ''}
          <RenderAmount
            shouldHideTooltip={hasZeroAPY}
            value={currentVault.apr.netAPR}
            symbol={'percent'}
            decimals={6}
          />
        </Renderable>
      </b>
      <APYSubline hasPendleArbRewards={hasPendleArbRewards} hasKelp={hasKelp} hasKelpNEngenlayer={hasKelpNEngenlayer} />
    </div>
  )
}
