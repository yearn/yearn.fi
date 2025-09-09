import Link from '@components/Link'
import { ImageWithFallback } from '@lib/components/ImageWithFallback'
import { RenderAmount } from '@lib/components/RenderAmount'
import { Renderable } from '@lib/components/Renderable'
import { useWallet } from '@lib/contexts/useWallet'
import { useYearn } from '@lib/contexts/useYearn'
import { useYearnBalance } from '@lib/hooks/useYearnBalance'
import { IconLinkOut } from '@lib/icons/IconLinkOut'
import type { TNormalizedBN } from '@lib/types'
import { cl, formatAmount, isZero, toAddress, toNormalizedBN } from '@lib/utils'
import { ETH_TOKEN_ADDRESS, WETH_TOKEN_ADDRESS, WFTM_TOKEN_ADDRESS } from '@lib/utils/constants'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { getNetwork } from '@lib/utils/wagmi/utils'

import type { ReactElement } from 'react'
import { Fragment, useMemo } from 'react'
import type { TKatanaAprData } from '../../../lib/hooks/useKatanaAprs'
import { VaultChainTag } from '../VaultChainTag'

type TAPYSublineProps = {
  hasPendleArbRewards: boolean
  hasKelpNEngenlayer: boolean
  hasKelp: boolean
  isEligibleForSteer?: boolean
  steerPointsPerDollar?: number
}

function APYSubline({
  hasPendleArbRewards,
  hasKelpNEngenlayer,
  hasKelp,
  isEligibleForSteer,
  steerPointsPerDollar
}: TAPYSublineProps): ReactElement {
  if (hasKelpNEngenlayer) {
    return (
      <small className={cl('whitespace-nowrap text-xs text-neutral-500 self-end -mb-1')}>
        {'+1x Kelp Miles'}
        <br />
        {'+1x EigenLayer Points'}
      </small>
    )
  }
  if (hasKelp) {
    return (
      <small className={cl('whitespace-nowrap text-xs text-neutral-500 self-end -mb-1')}>{'+ 1x Kelp Miles'}</small>
    )
  }
  if (hasPendleArbRewards) {
    return (
      <small className={cl('whitespace-nowrap text-xs text-neutral-500 self-end -mb-1')}>{'+ 2500 ARB/week'}</small>
    )
  }
  if (isEligibleForSteer) {
    return (
      <span className={'tooltip'}>
        <small
          className={cl(
            'whitespace-nowrap text-xs text-neutral-500 self-end -mb-1 underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
          )}
        >
          {'Eligible for Steer Points'}
        </small>
        <span className={'tooltipLight top-full left-4 '}>
          <div
            className={
              'font-number min-w-[360px] rounded-xl border border-neutral-300 bg-neutral-100 p-4 pb-1 text-center text-xxs text-neutral-900'
            }
          >
            <p className={'-mt-1 mb-2 w-full text-left text-xs text-neutral-700 break-words whitespace-normal'}>
              {'This vault earns '}
              {formatAmount(steerPointsPerDollar ?? 0, 2, 2)}
              {' Steer Points / dollar deposited, but you must '}
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  window.open('https://app.steer.finance/points', '_blank', 'noopener,noreferrer')
                }}
                className={
                  'font-bold underline decoration-neutral-600/30 decoration-dotted underline-offset-4 hover:decoration-neutral-600 cursor-pointer'
                }
              >
                {'register here to earn them.'}
              </span>
            </p>
          </div>
        </span>
      </span>
    )
  }
  return <Fragment />
}

function APYTooltip(props: {
  baseAPY: number
  rewardsAPY?: number
  boost?: number
  range?: [number, number]
  hasPendleArbRewards?: boolean
  hasKelpNEngenlayer?: boolean
  hasKelp?: boolean
}): ReactElement {
  return (
    <span className={'tooltipLight bottom-full mb-1'}>
      <div
        className={
          'font-number w-fit border border-neutral-300 bg-neutral-100 p-1 px-2 text-center text-xxs text-neutral-900'
        }
      >
        <div className={'flex flex-col items-start justify-start text-left'}>
          <div
            className={
              'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
            }
          >
            <p>{'• Base APY '}</p>
            <RenderAmount shouldHideTooltip value={props.baseAPY} symbol={'percent'} decimals={6} />
          </div>

          {props.rewardsAPY ? (
            <div
              className={
                'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
              }
            >
              <p>{'• Rewards APY '}</p>
              <RenderAmount shouldHideTooltip value={props.rewardsAPY} symbol={'percent'} decimals={6} />
            </div>
          ) : null}

          {props.boost ? (
            <div
              className={
                'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
              }
            >
              <p>{'• Boost '}</p>
              <p>{`${formatAmount(props.boost, 2, 2)} x`}</p>
            </div>
          ) : null}

          {props.range ? (
            <div
              className={
                'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
              }
            >
              <p>{'• Rewards APY '}</p>
              <div>
                <RenderAmount shouldHideTooltip value={props.range[0]} symbol={'percent'} decimals={6} />
                &nbsp;&rarr;&nbsp;
                <RenderAmount shouldHideTooltip value={props.range[1]} symbol={'percent'} decimals={6} />
              </div>
            </div>
          ) : null}

          {props.hasPendleArbRewards ? (
            <div
              className={
                'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
              }
            >
              <p>{'• Extra ARB '}</p>
              <p>{'2 500/week'}</p>
            </div>
          ) : null}

          {props.hasKelp ? (
            <div
              className={
                'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
              }
            >
              <p>{'• Extra Kelp Miles '}</p>
              <p>{'1x'}</p>
            </div>
          ) : null}

          {props.hasKelpNEngenlayer ? (
            <>
              <div
                className={
                  'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
                }
              >
                <p>{'• Extra Kelp Miles '}</p>
                <p>{'1x'}</p>
              </div>
              <div
                className={
                  'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
                }
              >
                <p>{'• Extra EigenLayer Points '}</p>
                <p>{'1x'}</p>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </span>
  )
}

export function KatanaApyTooltip(props: {
  extrinsicYield: number
  katanaNativeYield: number
  fixedRateKatanRewardsAPR: number
  katanaAppRewardsAPR: number
  katanaBonusAPR: number
  steerPointsPerDollar?: number
  position?: 'bottom' | 'top'
  maxWidth?: string
  currentVault: TYDaemonVault
}): ReactElement {
  const position = props.position || 'bottom'
  const positionClass = position === 'bottom' ? 'bottom-full' : 'top-full '
  const maxWidth = props.maxWidth || 'min-w-[360px] w-max'

  return (
    <span className={`tooltipLight ${positionClass}`}>
      <div
        className={`${maxWidth} border border-neutral-300 bg-neutral-100 p-6 text-center text-xxs text-neutral-900 rounded-2xl`}
      >
        <div className={'flex flex-col items-start justify-start text-left'}>
          {/* Group 1: Native APY */}
          <p
            className={
              'mb-1 w-full text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-700 md:text-sm text-bold pb-2'
            }
          >
            {'Native APY'}
          </p>
          <div
            className={
              'flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-700 md:text-sm text-bold pb-2'
            }
          >
            <div className={'flex flex-row items-center space-x-2'}>
              <ImageWithFallback
                src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/${props.currentVault.chainID}/${props.currentVault.token.address}/logo-32.png`}
                alt={''}
                width={16}
                height={16}
              />
              <p>{'Extrinsic Yield '}</p>
            </div>
            <RenderAmount shouldHideTooltip value={props.extrinsicYield} symbol={'percent'} decimals={6} />
          </div>
          <p className={'-mt-1 mb-2 w-full text-left text-xs text-neutral-500 break-words'}>
            {'Yield Earned from underlying bridged assets'}
          </p>

          <div
            className={
              'flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-700 md:text-sm text-bold pb-2'
            }
          >
            <div className={'flex flex-row items-center space-x-2'}>
              <ImageWithFallback
                src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/${props.currentVault.chainID}/${props.currentVault.token.address}/logo-32.png`}
                alt={''}
                width={16}
                height={16}
              />
              <p>{'Katana APY '}</p>
            </div>
            <RenderAmount shouldHideTooltip value={props.katanaNativeYield} symbol={'percent'} decimals={6} />
          </div>
          <p className={'-mt-1 mb-2 w-full text-left text-xs text-neutral-500 break-words'}>
            {'Yield Earned on Katana'}
          </p>

          <p className={'mb-2 w-full text-left text-xs italic text-neutral-500 break-words whitespace-normal'}>
            {'*This yield is guaranteed but may be paid in KAT tokens if actual rates are lower.'}
          </p>

          {/* Divider */}
          <div className={'my-2 h-px w-full bg-neutral-300/60'} />

          {/* Group 2: Rewards APR */}
          <p
            className={
              'mb-1 w-full text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-700 md:text-sm text-bold '
            }
          >
            {'Rewards APR'}
          </p>
          <div
            className={
              'flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-700 md:text-sm text-bold pb-2'
            }
          >
            <div className={'flex flex-row items-center space-x-2'}>
              <ImageWithFallback
                src={`${import.meta.env.VITE_BASE_YEARN_CHAIN_URI}/${props.currentVault.chainID}/logo-32.png`}
                alt={''}
                width={16}
                height={16}
              />
              <p>{'Base Rewards APR '}</p>
            </div>
            <RenderAmount shouldHideTooltip value={props.fixedRateKatanRewardsAPR} symbol={'percent'} decimals={6} />
          </div>
          <p className={'-mt-1 mb-2 w-full text-left text-xs text-neutral-500 break-words'}>
            {'Limited time fixed KAT rewards'}
          </p>

          <div
            className={
              'flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-700 md:text-sm text-bold pb-2'
            }
          >
            <div className={'flex flex-row items-center space-x-2'}>
              <ImageWithFallback
                src={`${import.meta.env.VITE_BASE_YEARN_CHAIN_URI}/${props.currentVault.chainID}/logo-32.png`}
                alt={''}
                width={16}
                height={16}
              />
              <p>{'App Rewards APR '}</p>
            </div>
            <RenderAmount shouldHideTooltip value={props.katanaAppRewardsAPR} symbol={'percent'} decimals={6} />
          </div>
          <p className={'-mt-1 mb-2 w-full text-left text-xs text-neutral-500 break-words'}>
            {'Kat Rewards passed through from Apps'}
          </p>
          <div
            className={
              'flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-700/35 md:text-sm text-bold pb-2'
            }
          >
            <div className={'flex flex-row items-center space-x-2'}>
              <ImageWithFallback
                src={`${import.meta.env.VITE_BASE_YEARN_CHAIN_URI}/${props.currentVault.chainID}/logo-32.png`}
                alt={''}
                width={16}
                height={16}
              />
              <p>{'Deposit Bonus APR '}</p>
            </div>
            <RenderAmount shouldHideTooltip value={props.katanaBonusAPR} symbol={'percent'} decimals={6} />
          </div>
          <p className={'-mt-1 mb-0 w-full text-left text-xs text-neutral-700/35 break-words'}>
            {'Applied if you deposited before Sept. 1st and hold for 90 days'}
          </p>
          {/* Steer Points (metadata, not part of APR) */}
          {props.steerPointsPerDollar && props.steerPointsPerDollar > 0 ? (
            <>
              <div className={'my-2 h-px w-full bg-neutral-300/60'} />
              <p
                className={
                  'mb-1 w-full text-left text-[10px] font-semibold uppercase tracking-wide text-neutral-700 md:text-sm text-bold pb-2'
                }
              >
                {'Steer Points'}
              </p>
              <p className={'-mt-1 mb-2 w-full text-left text-xs text-neutral-700 break-words whitespace-normal'}>
                {'This vault earns '}
                {formatAmount(props.steerPointsPerDollar, 2, 2)}
                {' Steer Points / dollar deposited, but you must '}
                <span
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    window.open('https://app.steer.finance/points', '_blank', 'noopener,noreferrer')
                  }}
                  className={
                    'font-bold underline decoration-neutral-600/30 decoration-dotted underline-offset-4 hover:decoration-neutral-600 cursor-pointer'
                  }
                >
                  {'register here to earn them.'}
                </span>
              </p>
            </>
          ) : null}
        </div>
      </div>
    </span>
  )
}

function VaultForwardAPY({ currentVault }: { currentVault: TYDaemonVault }): ReactElement {
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
    // Exclude legacy katanaRewardsAPR, bonus APR, and points
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
  const hasPendleArbRewards = currentVault.address === toAddress('0x1Dd930ADD968ff5913C3627dAA1e6e6FCC9dc544')
  const hasKelpNEngenlayer = currentVault.address === toAddress('0xDDa02A2FA0bb0ee45Ba9179a3fd7e65E5D3B2C90')
  const hasKelp = currentVault.address === toAddress('0x1Dd930ADD968ff5913C3627dAA1e6e6FCC9dc544')

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
              <Renderable
                shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')}
                /* TEMPORARY CODE TO NOTIFY 2500 ARB PER WEEK REWARD FOR SOME VAULTS */
                fallback={'NEW'}
              >
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
          <Renderable
            shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')}
            /* TEMPORARY CODE TO NOTIFY 2500 ARB PER WEEK REWARD FOR SOME VAULTS */
            fallback={'NEW'}
          >
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
            <Renderable
              shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')}
              /* TEMPORARY CODE TO NOTIFY 2500 ARB PER WEEK REWARD FOR SOME VAULTS */
              fallback={'NEW'}
            >
              {'⚡️ '}
              <span
                className={
                  'underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
                }
              >
                {/* <RenderAmount
									shouldHideTooltip={hasZeroBoostedAPY}
									value={boostedAPY}
									symbol={'percent'}
									decimals={6}
								/> */}
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
          <Renderable
            shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')}
            /* TEMPORARY CODE TO NOTIFY 2500 ARB PER WEEK REWARD FOR SOME VAULTS */
            fallback={'NEW'}
          >
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
          /* TEMPORARY CODE TO NOTIFY 2500 ARB PER WEEK REWARD FOR SOME VAULTS */
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

function VaultHistoricalAPY({ currentVault }: { currentVault: TYDaemonVault }): ReactElement {
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
  if (currentVault.apr?.extra.stakingRewardsAPR > 0) {
    return (
      <div className={'flex flex-col items-end md:text-right'}>
        <span className={'tooltip'}>
          <b className={'yearn--table-data-section-item-value'}>
            <Renderable shouldRender={!currentVault.apr?.type.includes('new')} fallback={'NEW'}>
              <span
                className={
                  'underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
                }
              >
                <RenderAmount
                  shouldHideTooltip={hasZeroAPY}
                  value={isZero(monthlyAPY) ? weeklyAPY : monthlyAPY}
                  symbol={'percent'}
                  decimals={6}
                />
              </span>
            </Renderable>
          </b>
          <span className={'tooltipLight bottom-full mb-1'}>
            <div
              className={
                'font-number w-fit border border-neutral-300 bg-neutral-100 p-1 px-2 text-center text-xxs text-neutral-900'
              }
            >
              <div className={'flex flex-col items-start justify-start text-left'}>
                <div
                  className={
                    'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
                  }
                >
                  <p>{'• Base APY '}</p>
                  <RenderAmount
                    shouldHideTooltip
                    value={isZero(monthlyAPY) ? weeklyAPY : monthlyAPY}
                    symbol={'percent'}
                    decimals={6}
                  />
                </div>

                <div
                  className={
                    'font-number flex w-full flex-row justify-between space-x-4 whitespace-nowrap text-neutral-400 md:text-xs'
                  }
                >
                  <p>{'• Rewards APY '}</p>
                  <p>{'N/A'}</p>
                </div>
              </div>
            </div>
          </span>
        </span>
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

function VaultRiskScoreTag({ riskLevel }: { riskLevel: number }): ReactElement {
  const level = riskLevel < 0 ? 0 : riskLevel > 5 ? 5 : riskLevel
  const riskColor = ['transparent', '#63C532', '#F8A908', '#F8A908', '#C73203', '#C73203']
  return (
    <div className={'md:justify-centere col-span-2 flex flex-row items-end justify-between md:flex-col md:pt-4'}>
      <p className={'inline whitespace-nowrap text-start text-xs text-neutral-800/60 md:hidden'}>{'Risk Score'}</p>
      <div className={cl('flex w-fit items-center justify-end gap-4 md:justify-center', 'tooltip relative z-50 h-6')}>
        <div className={'h-3 w-10 min-w-10 rounded-xs border-2 border-neutral-400 p-[2px]'}>
          <div
            className={'h-1 rounded-[1px]'}
            style={{
              backgroundColor: riskColor.length > level ? riskColor[level] : riskColor[0],
              width: `${(level / 5) * 100}%`
            }}
          />
        </div>
        <span
          suppressHydrationWarning
          className={'tooltiptext top-full mt-1 !text-[10px]'}
          style={{ marginRight: 'calc(-94px + 50%)' }}
        >
          <div
            className={
              'font-number relative border border-neutral-300 bg-neutral-100 p-1 px-2 text-center text-neutral-900'
            }
          >
            <p>
              <b className={'font-semibold'}>{`${level} / 5 :`}</b>
              {
                " This reflects the vault's security, with 1 being most secure and 5 least secure, based on strategy complexity, loss exposure, and external dependencies."
              }
            </p>
          </div>
        </span>
      </div>
    </div>
  )
}

export function VaultStakedAmount({ currentVault }: { currentVault: TYDaemonVault }): ReactElement {
  const { getToken } = useWallet()
  const { getPrice } = useYearn()

  const tokenPrice = useMemo(
    () => getPrice({ address: currentVault.address, chainID: currentVault.chainID }),
    [currentVault.address, currentVault.chainID, getPrice]
  )
  const staked = useMemo((): TNormalizedBN => {
    const vaultToken = getToken({ chainID: currentVault.chainID, address: currentVault.address })
    if (currentVault.staking.available) {
      const stakingToken = getToken({
        chainID: currentVault.chainID,
        address: currentVault.staking.address
      })
      return toNormalizedBN(vaultToken.balance.raw + stakingToken.balance.raw, stakingToken.decimals)
    }

    return toNormalizedBN(vaultToken.balance.raw, vaultToken.decimals)
  }, [
    currentVault.address,
    currentVault.chainID,
    currentVault.staking.address,
    currentVault.staking.available,
    getToken
  ])

  return (
    <div className={'flex flex-col pt-0 text-right'}>
      <p
        className={`yearn--table-data-section-item-value ${isZero(staked.raw) ? 'text-neutral-400' : 'text-neutral-900'}`}
      >
        <RenderAmount
          shouldFormatDust
          value={staked.normalized}
          symbol={currentVault.token.symbol}
          decimals={currentVault.token.decimals}
          options={{ shouldDisplaySymbol: false, maximumFractionDigits: 4 }}
        />
      </p>
      <small className={cl('text-xs text-neutral-900/40', staked.raw === 0n ? 'invisible' : 'visible')}>
        <RenderAmount
          value={staked.normalized * tokenPrice.normalized}
          symbol={'USD'}
          decimals={0}
          options={{
            shouldCompactValue: true,
            maximumFractionDigits: 2,
            minimumFractionDigits: 2
          }}
        />
      </small>
    </div>
  )
}

export function VaultsV3ListRow({ currentVault }: { currentVault: TYDaemonVault }): ReactElement {
  const balanceOfWant = useYearnBalance({
    chainID: currentVault.chainID,
    address: currentVault.token.address
  })
  const balanceOfCoin = useYearnBalance({
    chainID: currentVault.chainID,
    address: ETH_TOKEN_ADDRESS
  })
  const balanceOfWrappedCoin = useYearnBalance({
    chainID: currentVault.chainID,
    address: toAddress(currentVault.token.address) === WFTM_TOKEN_ADDRESS ? WFTM_TOKEN_ADDRESS : WETH_TOKEN_ADDRESS //TODO: Create a wagmi Chain upgrade to add the chain wrapper token address
  })
  const availableToDeposit = useMemo((): bigint => {
    if (toAddress(currentVault.token.address) === WETH_TOKEN_ADDRESS) {
      return balanceOfWrappedCoin.raw + balanceOfCoin.raw
    }
    if (toAddress(currentVault.token.address) === WFTM_TOKEN_ADDRESS) {
      return balanceOfWrappedCoin.raw + balanceOfCoin.raw
    }
    return balanceOfWant.raw
  }, [balanceOfCoin.raw, balanceOfWant.raw, balanceOfWrappedCoin.raw, currentVault.token.address])

  return (
    <Link href={`/v3/${currentVault.chainID}/${toAddress(currentVault.address)}`}>
      <div
        className={cl(
          'grid w-full grid-cols-1 md:grid-cols-12 rounded-3xl',
          'p-6 pt-2 md:pr-10',
          'cursor-pointer relative group'
        )}
      >
        <div
          className={cl(
            'absolute inset-0 rounded-3xl',
            'opacity-20 transition-opacity group-hover:opacity-100 pointer-events-none',
            'bg-[linear-gradient(80deg,#2C3DA6,#D21162)]'
          )}
        />

        <div className={cl('col-span-4 z-10', 'flex flex-row items-center justify-between')}>
          <div className={'flex flex-row gap-6 overflow-hidden pr-10'}>
            <div className={'mt-2.5 size-8 min-h-8 min-w-8 rounded-full md:flex'}>
              <ImageWithFallback
                src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/${currentVault.chainID}/${currentVault.token.address}/logo-128.png`}
                alt={''}
                width={32}
                height={32}
              />
            </div>
            <div className={'truncate'}>
              <strong
                title={currentVault.name}
                className={'block truncate font-black text-neutral-800 md:-mb-0.5 md:text-lg'}
              >
                {currentVault.name}
              </strong>
              <p className={'mb-0 block text-sm text-neutral-800/60 md:mb-2'}>{currentVault.token.name}</p>
              <div className={'hidden flex-row items-center md:flex'}>
                <VaultChainTag chainID={currentVault.chainID} />
                <button
                  type={'button'}
                  onClick={(event): void => {
                    event.stopPropagation()
                    window.open(
                      `${getNetwork(currentVault.chainID)?.defaultBlockExplorer}/address/${currentVault.address}`,
                      '_blank',
                      'noopener,noreferrer'
                    )
                  }}
                  className={'text-neutral-900/50 transition-opacity hover:text-neutral-900 cursor-pointer'}
                >
                  <div className={'px-2'}>
                    <IconLinkOut className={'inline-block size-4'} />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className={cl('col-span-8 z-10', 'grid grid-cols-2 md:grid-cols-12 gap-4', 'mt-4 md:mt-0')}>
          <div className={'yearn--table-data-section-item col-span-2 flex-row md:flex-col'} datatype={'number'}>
            <p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'Estimated APY'}</p>
            <VaultForwardAPY currentVault={currentVault} />
          </div>

          <div className={'yearn--table-data-section-item col-span-2 flex-row md:flex-col'} datatype={'number'}>
            <p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'Historical APY'}</p>
            <VaultHistoricalAPY currentVault={currentVault} />
          </div>

          <VaultRiskScoreTag riskLevel={currentVault.info.riskLevel} />

          <div className={'yearn--table-data-section-item col-span-2 flex-row md:flex-col'} datatype={'number'}>
            <p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'Available'}</p>
            <p
              className={`yearn--table-data-section-item-value ${isZero(availableToDeposit) ? 'text-neutral-400' : 'text-neutral-900'}`}
            >
              <RenderAmount
                value={Number(toNormalizedBN(availableToDeposit, currentVault.token.decimals).normalized)}
                symbol={currentVault.token.symbol}
                decimals={currentVault.token.decimals}
                shouldFormatDust
                options={{
                  shouldDisplaySymbol: false,
                  maximumFractionDigits:
                    Number(toNormalizedBN(availableToDeposit, currentVault.token.decimals).normalized) > 1000 ? 2 : 4
                }}
              />
            </p>
          </div>

          <div className={'yearn--table-data-section-item col-span-2 flex-row md:flex-col'} datatype={'number'}>
            <p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'Deposited'}</p>
            <VaultStakedAmount currentVault={currentVault} />
          </div>

          <div className={'yearn--table-data-section-item col-span-2 flex-row md:flex-col'} datatype={'number'}>
            <p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'TVL'}</p>
            <div className={'flex flex-col pt-0 text-right'}>
              <p className={'yearn--table-data-section-item-value'}>
                <RenderAmount
                  value={Number(toNormalizedBN(currentVault.tvl.totalAssets, currentVault.token.decimals).normalized)}
                  symbol={''}
                  decimals={6}
                  shouldFormatDust
                  options={{
                    shouldCompactValue: true,
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 2
                  }}
                />
              </p>
              <small className={'text-xs text-neutral-900/40'}>
                <RenderAmount
                  value={currentVault.tvl?.tvl}
                  symbol={'USD'}
                  decimals={0}
                  options={{
                    shouldCompactValue: true,
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 0
                  }}
                />
              </small>
            </div>
          </div>
        </div>

        <div className={'mt-4 flex flex-row items-center border-t border-neutral-900/20 pt-4 md:hidden'}>
          <VaultChainTag chainID={currentVault.chainID} />
          <button
            type={'button'}
            onClick={(event): void => {
              event.stopPropagation()
              window.open(
                `${getNetwork(currentVault.chainID)?.defaultBlockExplorer}/address/${currentVault.address}`,
                '_blank',
                'noopener,noreferrer'
              )
            }}
            className={'text-neutral-900/50 transition-opacity hover:text-neutral-900 cursor-pointer'}
          >
            <div className={'px-2'}>
              <IconLinkOut className={'inline-block size-4'} />
            </div>
          </button>
        </div>
      </div>
    </Link>
  )
}
