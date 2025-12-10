import { RenderAmount } from '@lib/components/RenderAmount'
import { Renderable } from '@lib/components/Renderable'
import { cl, formatAmount, isZero } from '@lib/utils'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { KATANA_CHAIN_ID, SPECTRA_BOOST_VAULT_ADDRESSES } from '@vaults-v3/constants/addresses'
import { useVaultApyData } from '@vaults-v3/hooks/useVaultApyData'
import type { ReactElement } from 'react'
import { Fragment, useState } from 'react'
import { APYDetailsModal } from './APYDetailsModal'
import { APYSubline } from './APYSubline'
import { APYTooltipContent } from './APYTooltip'
import { KatanaApyTooltipContent } from './KatanaApyTooltip'

export function VaultForwardAPY({
  currentVault,
  onMobileToggle,
  className,
  valueClassName,
  showSubline = true
}: {
  currentVault: TYDaemonVault
  onMobileToggle?: (e: React.MouseEvent) => void
  className?: string
  valueClassName?: string
  showSubline?: boolean
}): ReactElement {
  const data = useVaultApyData(currentVault)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Check if vault is eligible for Spectra boost (Katana chain only)
  const isEligibleForSpectraBoost =
    currentVault.chainID === KATANA_CHAIN_ID &&
    SPECTRA_BOOST_VAULT_ADDRESSES.includes(currentVault.address.toLowerCase())
  const handleValueClick = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (onMobileToggle) {
      onMobileToggle(e)
      return
    }
    setIsModalOpen(true)
  }
  const handleInfoOpen = (): void => setIsModalOpen(true)
  const handleInfoClose = (): void => setIsModalOpen(false)

  // Katana
  if (currentVault.chainID === KATANA_CHAIN_ID && data.katanaExtras && data.katanaTotalApr !== undefined) {
    const katanaDetails = (
      <KatanaApyTooltipContent
        extrinsicYield={data.katanaExtras.extrinsicYield}
        katanaNativeYield={data.katanaExtras.katanaNativeYield}
        fixedRateKatanRewardsAPR={data.katanaExtras.FixedRateKatanaRewards}
        katanaAppRewardsAPR={data.katanaExtras.katanaAppRewardsAPR}
        katanaBonusAPR={data.katanaExtras.katanaBonusAPY}
        steerPointsPerDollar={data.katanaExtras.steerPointsPerDollar}
        isEligibleForSpectraBoost={isEligibleForSpectraBoost}
        currentVault={currentVault}
        maxWidth={'w-full'}
      />
    )

    return (
      <Fragment>
        <div className={cl('relative flex flex-col items-end md:text-right', className)}>
          <b className={cl('yearn--table-data-section-item-value', valueClassName)} onClick={handleValueClick}>
            <Renderable shouldRender={true} fallback={'NEW'}>
              <div className={'flex items-center gap-2'}>
                <span
                  className={
                    'flex cursor-pointer items-center gap-1 underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
                  }
                >
                  {'⚔️ '}
                  <RenderAmount value={data.katanaTotalApr} symbol={'percent'} decimals={6} />
                </span>
              </div>
            </Renderable>
          </b>
          {showSubline ? (
            <APYSubline
              hasPendleArbRewards={false}
              hasKelpNEngenlayer={false}
              hasKelp={false}
              isEligibleForSteer={data.isEligibleForSteer}
              steerPointsPerDollar={data.steerPointsPerDollar}
              isEligibleForSpectraBoost={isEligibleForSpectraBoost}
              onExtraRewardsClick={handleInfoOpen}
            />
          ) : null}
        </div>
        <APYDetailsModal isOpen={isModalOpen} onClose={handleInfoClose} title={'Katana APY breakdown'}>
          {katanaDetails}
        </APYDetailsModal>
      </Fragment>
    )
  }

  // No forward APY (or Katana with no extras)
  if (data.mode === 'noForward' || currentVault.chainID === KATANA_CHAIN_ID) {
    const hasZeroAPY = isZero(data.netApr) || Number((data.netApr || 0).toFixed(2)) === 0
    const boostedAPY = data.rewardsAprSum + data.netApr
    const hasZeroBoostedAPY = isZero(boostedAPY) || Number(boostedAPY.toFixed(2)) === 0

    if (data.rewardsAprSum > 0) {
      const modalContent = (
        <APYTooltipContent
          baseAPY={data.netApr}
          rewardsAPY={data.rewardsAprSum}
          hasPendleArbRewards={data.hasPendleArbRewards}
          hasKelp={data.hasKelp}
          hasKelpNEngenlayer={data.hasKelpNEngenlayer}
        />
      )

      return (
        <Fragment>
          <div className={cl('relative flex flex-col items-end md:text-right', className)}>
            <b className={cl('yearn--table-data-section-item-value', valueClassName)} onClick={handleValueClick}>
              <Renderable shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')} fallback={'NEW'}>
                <div className={'flex items-center gap-2'}>
                  <span
                    className={
                      'flex cursor-pointer items-center gap-1 underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
                    }
                  >
                    {'⚡️ '}
                    <RenderAmount
                      shouldHideTooltip={hasZeroBoostedAPY}
                      value={boostedAPY}
                      symbol={'percent'}
                      decimals={6}
                    />
                  </span>
                </div>
              </Renderable>
            </b>
            {showSubline ? (
              <APYSubline
                hasPendleArbRewards={data.hasPendleArbRewards}
                hasKelpNEngenlayer={data.hasKelpNEngenlayer}
                hasKelp={data.hasKelp}
                isEligibleForSteer={data.isEligibleForSteer}
                steerPointsPerDollar={data.steerPointsPerDollar}
                isEligibleForSpectraBoost={isEligibleForSpectraBoost}
                onExtraRewardsClick={handleInfoOpen}
              />
            ) : null}
          </div>
          <APYDetailsModal isOpen={isModalOpen} onClose={handleInfoClose} title={'APY breakdown'}>
            {modalContent}
          </APYDetailsModal>
        </Fragment>
      )
    }

    return (
      <div className={cl('relative flex flex-col items-end md:text-right', className)}>
        <b className={cl('yearn--table-data-section-item-value', valueClassName)} onClick={handleValueClick}>
          <Renderable shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')} fallback={'NEW'}>
            <RenderAmount value={data.netApr} shouldHideTooltip={hasZeroAPY} symbol={'percent'} decimals={6} />
          </Renderable>
        </b>
        {showSubline ? (
          <APYSubline
            hasPendleArbRewards={data.hasPendleArbRewards}
            hasKelpNEngenlayer={data.hasKelpNEngenlayer}
            hasKelp={data.hasKelp}
            isEligibleForSteer={data.isEligibleForSteer}
            steerPointsPerDollar={data.steerPointsPerDollar}
            isEligibleForSpectraBoost={isEligibleForSpectraBoost}
          />
        ) : null}
      </div>
    )
  }

  // Boosted
  if (data.mode === 'boosted' && data.isBoosted) {
    const unBoostedAPY = data.unboostedApr || 0
    const modalContent = (
      <APYTooltipContent
        baseAPY={unBoostedAPY}
        hasPendleArbRewards={data.hasPendleArbRewards}
        hasKelpNEngenlayer={data.hasKelpNEngenlayer}
        hasKelp={data.hasKelp}
        boost={data.boost}
      />
    )

    return (
      <Fragment>
        <div className={cl('flex flex-col items-end md:text-right', className)}>
          <b
            className={cl(
              'yearn--table-data-section-item-value underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600',
              valueClassName
            )}
            onClick={handleValueClick}
          >
            <Renderable shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')} fallback={'NEW'}>
              <div className={'flex cursor-pointer items-center gap-2'}>
                <RenderAmount
                  shouldHideTooltip
                  value={currentVault.apr.forwardAPR.netAPR}
                  symbol={'percent'}
                  decimals={6}
                />
              </div>
            </Renderable>
          </b>
          <small className={'text-xs text-text-primary'}>
            <Renderable shouldRender={data.isBoosted}>{`BOOST ${formatAmount(data.boost || 0, 2, 2)}x`}</Renderable>
          </small>
          {showSubline ? (
            <APYSubline
              hasPendleArbRewards={data.hasPendleArbRewards}
              hasKelpNEngenlayer={data.hasKelpNEngenlayer}
              hasKelp={data.hasKelp}
              isEligibleForSteer={data.isEligibleForSteer}
              steerPointsPerDollar={data.steerPointsPerDollar}
              isEligibleForSpectraBoost={isEligibleForSpectraBoost}
              onExtraRewardsClick={handleInfoOpen}
            />
          ) : null}
        </div>
        <APYDetailsModal isOpen={isModalOpen} onClose={handleInfoClose} title={'APY breakdown'}>
          {modalContent}
        </APYDetailsModal>
      </Fragment>
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

    const modalContent = (
      <APYTooltipContent
        baseAPY={data.baseForwardApr}
        rewardsAPY={veYFIRange ? undefined : data.rewardsAprSum}
        hasPendleArbRewards={data.hasPendleArbRewards}
        hasKelpNEngenlayer={data.hasKelpNEngenlayer}
        hasKelp={data.hasKelp}
        range={veYFIRange}
      />
    )

    return (
      <Fragment>
        <div className={cl('relative flex flex-col items-end md:text-right', className)}>
          <b
            className={cl('yearn--table-data-section-item-value whitespace-nowrap', valueClassName)}
            onClick={handleValueClick}
          >
            <Renderable shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')} fallback={'NEW'}>
              <div className={'flex items-center gap-2'}>
                <span
                  className={
                    'flex cursor-pointer items-center gap-1 underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
                  }
                >
                  {'⚡️ '}
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
              </div>
            </Renderable>
          </b>
          {showSubline ? (
            <APYSubline
              hasPendleArbRewards={data.hasPendleArbRewards}
              hasKelp={data.hasKelp}
              hasKelpNEngenlayer={data.hasKelpNEngenlayer}
              isEligibleForSteer={data.isEligibleForSteer}
              steerPointsPerDollar={data.steerPointsPerDollar}
              isEligibleForSpectraBoost={isEligibleForSpectraBoost}
              onExtraRewardsClick={handleInfoOpen}
            />
          ) : null}
        </div>
        <APYDetailsModal isOpen={isModalOpen} onClose={handleInfoClose} title={'APY breakdown'}>
          {modalContent}
        </APYDetailsModal>
      </Fragment>
    )
  }

  // Spot forward APY
  if (data.mode === 'spot') {
    return (
      <div className={cl('relative flex flex-col items-end md:text-right', className)}>
        <b className={cl('yearn--table-data-section-item-value', valueClassName)} onClick={handleValueClick}>
          <Renderable shouldRender={!currentVault.apr.forwardAPR?.type.includes('new')} fallback={'NEW'}>
            {currentVault?.info?.isBoosted ? '⚡️ ' : ''}
            <RenderAmount shouldHideTooltip value={data.baseForwardApr} symbol={'percent'} decimals={6} />
          </Renderable>
        </b>
        {showSubline ? (
          <APYSubline
            hasPendleArbRewards={data.hasPendleArbRewards}
            hasKelp={data.hasKelp}
            hasKelpNEngenlayer={data.hasKelpNEngenlayer}
            isEligibleForSteer={data.isEligibleForSteer}
            steerPointsPerDollar={data.steerPointsPerDollar}
            isEligibleForSpectraBoost={isEligibleForSpectraBoost}
          />
        ) : null}
      </div>
    )
  }

  // Fallback historical APY - This will always be reached for any unhandled case
  const hasZeroAPY = isZero(data.netApr) || Number((data.netApr || 0).toFixed(2)) === 0
  return (
    <div className={cl('relative flex flex-col items-end md:text-right', className)}>
      <b className={cl('yearn--table-data-section-item-value', valueClassName)} onClick={handleValueClick}>
        <Renderable
          shouldRender={!currentVault.apr.forwardAPR?.type.includes('new') && !currentVault.apr.type.includes('new')}
          fallback={'NEW'}
        >
          {currentVault?.info?.isBoosted ? '⚡️ ' : ''}
          <RenderAmount shouldHideTooltip={hasZeroAPY} value={data.netApr} symbol={'percent'} decimals={6} />
        </Renderable>
      </b>
      {showSubline ? (
        <APYSubline
          hasPendleArbRewards={data.hasPendleArbRewards}
          hasKelp={data.hasKelp}
          hasKelpNEngenlayer={data.hasKelpNEngenlayer}
          isEligibleForSteer={data.isEligibleForSteer}
          steerPointsPerDollar={data.steerPointsPerDollar}
          isEligibleForSpectraBoost={isEligibleForSpectraBoost}
        />
      ) : null}
    </div>
  )
}

// Inline details for mobile accordion rendering controlled by parent
export function VaultForwardAPYInlineDetails({ currentVault }: { currentVault: TYDaemonVault }): ReactElement | null {
  const data = useVaultApyData(currentVault)

  // Check if vault is eligible for Spectra boost (Katana chain only)
  const isEligibleForSpectraBoost =
    currentVault.chainID === KATANA_CHAIN_ID &&
    SPECTRA_BOOST_VAULT_ADDRESSES.includes(currentVault.address.toLowerCase())

  if (currentVault.chainID === KATANA_CHAIN_ID && data.katanaExtras && data.katanaTotalApr !== undefined) {
    return (
      <div className={'w-full rounded-xl border border-border bg-surface-secondary p-3 text-text-primary'}>
        <div className={'flex flex-col gap-2'}>
          <div className={'flex items-center justify-between'}>
            <p className={'text-xs text-text-primary'}>{'Extrinsic Yield'}</p>
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
            <p className={'text-xs text-text-primary'}>{'Katana APY'}</p>
            <span className={'font-number'}>
              <RenderAmount
                shouldHideTooltip
                value={data.katanaExtras.katanaNativeYield}
                symbol={'percent'}
                decimals={6}
              />
            </span>
          </div>
          <div className={'my-1 h-px w-full bg-surface-tertiary/60'} />
          <div className={'flex items-center justify-between'}>
            <p className={'text-xs text-text-primary'}>{'Base Rewards APR'}</p>
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
            <p className={'text-xs text-text-primary'}>{'App Rewards APR'}</p>
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
            <p className={'text-xs text-text-primary'}>{'Deposit Bonus APR'}</p>
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
