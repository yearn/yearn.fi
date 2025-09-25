import { RenderAmount } from '@lib/components/RenderAmount'
import { Renderable } from '@lib/components/Renderable'
import { formatAmount, isZero } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { KATANA_CHAIN_ID } from '@vaults-v3/constants/addresses'
import { useVaultApyData } from '@vaults-v3/hooks/useVaultApyData'
import type { ReactElement } from 'react'
import { Fragment, useState } from 'react'
import { APYSubline } from './APYSubline'
import { APYTooltip } from './APYTooltip'
import { KatanaApyTooltip } from './KatanaApyTooltip'

export function VaultForwardAPY({
  currentVault,
  onMobileToggle
}: {
  currentVault: TYDaemonVault
  onMobileToggle?: (e: React.MouseEvent) => void
}): ReactElement {
  const data = useVaultApyData(currentVault)
  const [mobileOpen, setMobileOpen] = useState(false)
  const handleToggle = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (onMobileToggle) {
      onMobileToggle(e)
      return
    }
    setMobileOpen((v) => !v)
  }

  // Katana
  if (currentVault.chainID === KATANA_CHAIN_ID && data.katanaExtras && data.katanaTotalApr !== undefined) {
    return (
      <div className={'relative flex flex-col items-end md:text-right'}>
        <span className={onMobileToggle ? 'tooltip' : 'tooltip w-full justify-end'}>
          <b className={'yearn--table-data-section-item-value'}>
            <Renderable shouldRender={true} fallback={'NEW'}>
              {'⚔️ '}
              <span
                className={
                  'underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
                }
                onClick={handleToggle}
              >
                <RenderAmount value={data.katanaTotalApr} symbol={'percent'} decimals={6} />
              </span>
            </Renderable>
          </b>
          {!onMobileToggle && (
            <KatanaApyTooltip
              extrinsicYield={data.katanaExtras.extrinsicYield}
              katanaNativeYield={data.katanaExtras.katanaNativeYield}
              fixedRateKatanRewardsAPR={data.katanaExtras.FixedRateKatanaRewards}
              katanaAppRewardsAPR={data.katanaExtras.katanaAppRewardsAPR}
              katanaBonusAPR={data.katanaExtras.katanaBonusAPY}
              steerPointsPerDollar={data.katanaExtras.steerPointsPerDollar}
              currentVault={currentVault}
            />
          )}
        </span>
        {onMobileToggle ? null : mobileOpen ? (
          <div
            className={'md:hidden mt-2 w-full rounded-xl border border-neutral-300 bg-neutral-100 p-3 text-neutral-900'}
            onClick={(e): void => e.stopPropagation()}
          >
            <div className={'flex flex-col gap-2'}>
              <div className={'flex items-center justify-between'}>
                <p className={'text-xs text-neutral-800'}>{'Extrinsic Yield'}</p>
                <span className={'font-number'}>
                  <RenderAmount
                    shouldHideTooltip
                    value={data.katanaExtras.extrinsicYield}
                    symbol={'percent'}
                    decimals={6}
                  />
                </span>
              </div>
              <div className={'flex items-center justify-between'}>
                <p className={'text-xs text-neutral-800'}>{'Katana APY'}</p>
                <span className={'font-number'}>
                  <RenderAmount
                    shouldHideTooltip
                    value={data.katanaExtras.katanaNativeYield}
                    symbol={'percent'}
                    decimals={6}
                  />
                </span>
              </div>
              <div className={'my-1 h-px w-full bg-neutral-300/60'} />
              <div className={'flex items-center justify-between'}>
                <p className={'text-xs text-neutral-800'}>{'Base Rewards APR'}</p>
                <span className={'font-number'}>
                  <RenderAmount
                    shouldHideTooltip
                    value={data.katanaExtras.FixedRateKatanaRewards}
                    symbol={'percent'}
                    decimals={6}
                  />
                </span>
              </div>
              <div className={'flex items-center justify-between'}>
                <p className={'text-xs text-neutral-800'}>{'App Rewards APR'}</p>
                <span className={'font-number'}>
                  <RenderAmount
                    shouldHideTooltip
                    value={data.katanaExtras.katanaAppRewardsAPR}
                    symbol={'percent'}
                    decimals={6}
                  />
                </span>
              </div>
              <div className={'flex items-center justify-between'}>
                <p className={'text-xs text-neutral-800'}>{'Deposit Bonus APR'}</p>
                <span className={'font-number'}>
                  <RenderAmount
                    shouldHideTooltip
                    value={data.katanaExtras.katanaBonusAPY}
                    symbol={'percent'}
                    decimals={6}
                  />
                </span>
              </div>
              {data.katanaExtras.steerPointsPerDollar && data.katanaExtras.steerPointsPerDollar > 0 ? (
                <div className={'flex items-center justify-between'}>
                  <p className={'text-xs text-neutral-800'}>{'Steer Points / $'}</p>
                  <span className={'font-number'}>{data.katanaExtras.steerPointsPerDollar.toFixed(2)}</span>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        <APYSubline
          hasPendleArbRewards={false}
          hasKelpNEngenlayer={false}
          hasKelp={false}
          isEligibleForSteer={data.isEligibleForSteer}
          steerPointsPerDollar={data.steerPointsPerDollar}
          onMobileToggle={onMobileToggle}
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
          <span className={'tooltip'} onClick={handleToggle}>
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
          {onMobileToggle ? null : mobileOpen ? (
            <div
              className={
                'md:hidden mt-2 w-full rounded-xl border border-neutral-300 bg-neutral-100 p-3 text-neutral-900'
              }
              onClick={(e): void => e.stopPropagation()}
            >
              <div className={'flex flex-col gap-2'}>
                <div className={'flex items-center justify-between'}>
                  <p className={'text-xs text-neutral-800'}>{'Base APY'}</p>
                  <span className={'font-number'}>
                    <RenderAmount shouldHideTooltip value={data.netApr} symbol={'percent'} decimals={6} />
                  </span>
                </div>
                <div className={'flex items-center justify-between'}>
                  <p className={'text-xs text-neutral-800'}>{'Rewards APR'}</p>
                  <span className={'font-number'}>
                    <RenderAmount shouldHideTooltip value={data.rewardsAprSum} symbol={'percent'} decimals={6} />
                  </span>
                </div>
                {data.hasPendleArbRewards ? (
                  <div className={'flex items-center justify-between'}>
                    <p className={'text-xs text-neutral-800'}>{'Extra ARB'}</p>
                    <span className={'font-number'}>{'2 500/week'}</span>
                  </div>
                ) : null}
                {data.hasKelp ? (
                  <div className={'flex items-center justify-between'}>
                    <p className={'text-xs text-neutral-800'}>{'Extra Kelp Miles'}</p>
                    <span className={'font-number'}>{'1x'}</span>
                  </div>
                ) : null}
                {data.hasKelpNEngenlayer ? (
                  <>
                    <div className={'flex items-center justify-between'}>
                      <p className={'text-xs text-neutral-800'}>{'Extra Kelp Miles'}</p>
                      <span className={'font-number'}>{'1x'}</span>
                    </div>
                    <div className={'flex items-center justify-between'}>
                      <p className={'text-xs text-neutral-800'}>{'Extra EigenLayer Points'}</p>
                      <span className={'font-number'}>{'1x'}</span>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
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
      <span className={'tooltip'} onClick={handleToggle}>
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
          {mobileOpen ? (
            <div
              className={
                'md:hidden mt-2 w-full rounded-xl border border-neutral-300 bg-neutral-100 p-3 text-neutral-900'
              }
              onClick={(e): void => e.stopPropagation()}
            >
              <div className={'flex flex-col gap-2'}>
                <div className={'flex items-center justify-between'}>
                  <p className={'text-xs text-neutral-800'}>{'Base APY'}</p>
                  <span className={'font-number'}>
                    <RenderAmount shouldHideTooltip value={unBoostedAPY} symbol={'percent'} decimals={6} />
                  </span>
                </div>
                <div className={'flex items-center justify-between'}>
                  <p className={'text-xs text-neutral-800'}>{'Boost'}</p>
                  <span className={'font-number'}>{formatAmount(data.boost || 0, 2, 2)}x</span>
                </div>
                {data.hasPendleArbRewards ? (
                  <div className={'flex items-center justify-between'}>
                    <p className={'text-xs text-neutral-800'}>{'Extra ARB'}</p>
                    <span className={'font-number'}>{'2 500/week'}</span>
                  </div>
                ) : null}
                {data.hasKelp ? (
                  <div className={'flex items-center justify-between'}>
                    <p className={'text-xs text-neutral-800'}>{'Extra Kelp Miles'}</p>
                    <span className={'font-number'}>{'1x'}</span>
                  </div>
                ) : null}
                {data.hasKelpNEngenlayer ? (
                  <>
                    <div className={'flex items-center justify-between'}>
                      <p className={'text-xs text-neutral-800'}>{'Extra Kelp Miles'}</p>
                      <span className={'font-number'}>{'1x'}</span>
                    </div>
                    <div className={'flex items-center justify-between'}>
                      <p className={'text-xs text-neutral-800'}>{'Extra EigenLayer Points'}</p>
                      <span className={'font-number'}>{'1x'}</span>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
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
        <span className={'tooltip'} onClick={handleToggle}>
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
        {mobileOpen ? (
          <div
            className={'md:hidden mt-2 w-full rounded-xl border border-neutral-300 bg-neutral-100 p-3 text-neutral-900'}
            onClick={(e): void => e.stopPropagation()}
          >
            <div className={'flex flex-col gap-2'}>
              <div className={'flex items-center justify-between'}>
                <p className={'text-xs text-neutral-800'}>{'Base APY'}</p>
                <span className={'font-number'}>
                  <RenderAmount shouldHideTooltip value={data.baseForwardApr} symbol={'percent'} decimals={6} />
                </span>
              </div>
              {veYFIRange ? (
                <div className={'flex items-center justify-between'}>
                  <p className={'text-xs text-neutral-800'}>{'Rewards APR'}</p>
                  <span className={'font-number'}>
                    <RenderAmount shouldHideTooltip value={veYFIRange[0]} symbol={'percent'} decimals={6} />
                    {' → '}
                    <RenderAmount shouldHideTooltip value={veYFIRange[1]} symbol={'percent'} decimals={6} />
                  </span>
                </div>
              ) : (
                <div className={'flex items-center justify-between'}>
                  <p className={'text-xs text-neutral-800'}>{'Rewards APR'}</p>
                  <span className={'font-number'}>
                    <RenderAmount shouldHideTooltip value={data.rewardsAprSum} symbol={'percent'} decimals={6} />
                  </span>
                </div>
              )}
              {data.hasPendleArbRewards ? (
                <div className={'flex items-center justify-between'}>
                  <p className={'text-xs text-neutral-800'}>{'Extra ARB'}</p>
                  <span className={'font-number'}>{'2 500/week'}</span>
                </div>
              ) : null}
              {data.hasKelp ? (
                <div className={'flex items-center justify-between'}>
                  <p className={'text-xs text-neutral-800'}>{'Extra Kelp Miles'}</p>
                  <span className={'font-number'}>{'1x'}</span>
                </div>
              ) : null}
              {data.hasKelpNEngenlayer ? (
                <>
                  <div className={'flex items-center justify-between'}>
                    <p className={'text-xs text-neutral-800'}>{'Extra Kelp Miles'}</p>
                    <span className={'font-number'}>{'1x'}</span>
                  </div>
                  <div className={'flex items-center justify-between'}>
                    <p className={'text-xs text-neutral-800'}>{'Extra EigenLayer Points'}</p>
                    <span className={'font-number'}>{'1x'}</span>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
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

// Inline details for mobile accordion rendering controlled by parent
export function VaultForwardAPYInlineDetails({ currentVault }: { currentVault: TYDaemonVault }): ReactElement | null {
  const data = useVaultApyData(currentVault)

  if (currentVault.chainID === KATANA_CHAIN_ID && data.katanaExtras && data.katanaTotalApr !== undefined) {
    return (
      <div className={'w-full rounded-xl border border-neutral-300 bg-neutral-100 p-3 text-neutral-900'}>
        <div className={'flex flex-col gap-2'}>
          <div className={'flex items-center justify-between'}>
            <p className={'text-xs text-neutral-800'}>{'Extrinsic Yield'}</p>
            <span className={'font-number'}>
              <RenderAmount
                shouldHideTooltip
                value={data.katanaExtras.extrinsicYield}
                symbol={'percent'}
                decimals={6}
              />
            </span>
          </div>
          <div className={'flex items-center justify-between'}>
            <p className={'text-xs text-neutral-800'}>{'Katana APY'}</p>
            <span className={'font-number'}>
              <RenderAmount
                shouldHideTooltip
                value={data.katanaExtras.katanaNativeYield}
                symbol={'percent'}
                decimals={6}
              />
            </span>
          </div>
          <div className={'my-1 h-px w-full bg-neutral-300/60'} />
          <div className={'flex items-center justify-between'}>
            <p className={'text-xs text-neutral-800'}>{'Base Rewards APR'}</p>
            <span className={'font-number'}>
              <RenderAmount
                shouldHideTooltip
                value={data.katanaExtras.FixedRateKatanaRewards}
                symbol={'percent'}
                decimals={6}
              />
            </span>
          </div>
          <div className={'flex items-center justify-between'}>
            <p className={'text-xs text-neutral-800'}>{'App Rewards APR'}</p>
            <span className={'font-number'}>
              <RenderAmount
                shouldHideTooltip
                value={data.katanaExtras.katanaAppRewardsAPR}
                symbol={'percent'}
                decimals={6}
              />
            </span>
          </div>
          <div className={'flex items-center justify-between'}>
            <p className={'text-xs text-neutral-800'}>{'Deposit Bonus APR'}</p>
            <span className={'font-number'}>
              <RenderAmount
                shouldHideTooltip
                value={data.katanaExtras.katanaBonusAPY}
                symbol={'percent'}
                decimals={6}
              />
            </span>
          </div>
          {data.katanaExtras.steerPointsPerDollar && data.katanaExtras.steerPointsPerDollar > 0 ? (
            <div className={'flex items-center justify-between'}>
              <p className={'text-xs text-neutral-800'}>{'Steer Points / $'}</p>
              <span className={'font-number'}>{data.katanaExtras.steerPointsPerDollar.toFixed(2)}</span>
            </div>
          ) : null}
          <div className={'mt-2 p-3 pb-0 text-neutral-700 md:text-xs text-bold'}>
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
                {'here'}
              </a>
            </li>
            {data.katanaExtras.steerPointsPerDollar && data.katanaExtras.steerPointsPerDollar > 0 ? (
              <li className={'-mt-1 mb-2 w-full text-left text-xs text-neutral-700 break-words whitespace-normal'}>
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
        <div className={'w-full rounded-xl border border-neutral-300 bg-neutral-100 p-3 text-neutral-900'}>
          <div className={'flex flex-col gap-2'}>
            <div className={'flex items-center justify-between'}>
              <p className={'text-xs text-neutral-800'}>{'Base APY'}</p>
              <span className={'font-number'}>
                <RenderAmount shouldHideTooltip value={data.netApr} symbol={'percent'} decimals={6} />
              </span>
            </div>
            <div className={'flex items-center justify-between'}>
              <p className={'text-xs text-neutral-800'}>{'Rewards APR'}</p>
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
    const unBoostedAPY = data.unboostedApr || 0
    return (
      <div className={'w-full rounded-xl border border-neutral-300 bg-neutral-100 p-3 text-neutral-900'}>
        <div className={'flex flex-col gap-2'}>
          <div className={'flex items-center justify-between'}>
            <p className={'text-xs text-neutral-800'}>{'Base APY'}</p>
            <span className={'font-number'}>
              <RenderAmount shouldHideTooltip value={unBoostedAPY} symbol={'percent'} decimals={6} />
            </span>
          </div>
          <div className={'flex items-center justify-between'}>
            <p className={'text-xs text-neutral-800'}>{'Boost'}</p>
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
      <div className={'w-full rounded-xl border border-neutral-300 bg-neutral-100 p-3 text-neutral-900'}>
        <div className={'flex flex-col gap-2'}>
          <div className={'flex items-center justify-between'}>
            <p className={'text-xs text-neutral-800'}>{'Base APY'}</p>
            <span className={'font-number'}>
              <RenderAmount shouldHideTooltip value={data.baseForwardApr} symbol={'percent'} decimals={6} />
            </span>
          </div>
          {isSourceVeYFI && veYFIRange ? (
            <div className={'flex items-center justify-between'}>
              <p className={'text-xs text-neutral-800'}>{'Rewards APR'}</p>
              <span className={'font-number'}>
                <RenderAmount shouldHideTooltip value={veYFIRange[0]} symbol={'percent'} decimals={6} />
                {' → '}
                <RenderAmount shouldHideTooltip value={veYFIRange[1]} symbol={'percent'} decimals={6} />
              </span>
            </div>
          ) : (
            <div className={'flex items-center justify-between'}>
              <p className={'text-xs text-neutral-800'}>{'Rewards APR'}</p>
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
