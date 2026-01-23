import { KATANA_CHAIN_ID, SPECTRA_BOOST_VAULT_ADDRESSES } from '@pages/vaults/constants/addresses'
import { useVaultApyData } from '@pages/vaults/hooks/useVaultApyData'
import { RenderAmount } from '@shared/components/RenderAmount'
import { formatAmount } from '@shared/utils'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import type { ReactElement, ReactNode } from 'react'
import { Fragment, useState } from 'react'
import { APYDetailsModal } from './APYDetailsModal'
import { ApyDisplay } from './ApyDisplay'
import { resolveForwardApyDisplayConfig } from './apyDisplayConfig'

export type TVaultForwardAPYVariant = 'default' | 'factory-list'

const INLINE_DETAILS_CONTAINER_CLASS =
  'w-full rounded-xl border border-border bg-surface-secondary p-3 text-text-primary'
const INLINE_DETAILS_STACK_CLASS = 'flex flex-col gap-2'
const INLINE_DETAILS_LINK_CLASS =
  'font-bold underline sm:decoration-neutral-600/30 decoration-dotted underline-offset-4 ' +
  'transition-opacity hover:decoration-neutral-600'

type TVaultForwardAPYProps = {
  currentVault: TYDaemonVault
  onMobileToggle?: (e: React.MouseEvent) => void
  className?: string
  valueClassName?: string
  showSubline?: boolean
  showSublineTooltip?: boolean
  displayVariant?: TVaultForwardAPYVariant
  showBoostDetails?: boolean
  onInteractiveHoverChange?: (isHovering: boolean) => void
}

type TVaultForwardAPYInlineDetailsProps = {
  currentVault: TYDaemonVault
  showBoostDetails?: boolean
}

type TInlineDetailRowProps = {
  label: string
  value: ReactNode
}

function InlineDetailRow({ label, value }: TInlineDetailRowProps): ReactElement {
  return (
    <div className={'flex items-center justify-between'}>
      <p className={'text-xs text-text-primary'}>{label}</p>
      <span className={'font-number'}>{value}</span>
    </div>
  )
}

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
}: TVaultForwardAPYProps): ReactElement {
  const data = useVaultApyData(currentVault)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const canOpenModal = displayVariant !== 'factory-list'
  function openModal(): void {
    setIsModalOpen(true)
  }

  function closeModal(): void {
    setIsModalOpen(false)
  }

  const { displayConfig, modalConfig } = resolveForwardApyDisplayConfig({
    currentVault,
    data,
    displayVariant,
    showSubline,
    showSublineTooltip,
    showBoostDetails,
    canOpenModal,
    onRequestModalOpen: openModal
  })

  function handleValueClick(e: React.MouseEvent): void {
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
    openModal()
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
        <APYDetailsModal isOpen={isModalOpen} onClose={closeModal} title={modalConfig.title}>
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
}: TVaultForwardAPYInlineDetailsProps): ReactElement | null {
  const data = useVaultApyData(currentVault)
  const katanaExtras = data.katanaExtras

  // Check if vault is eligible for Spectra boost (Katana chain only)
  const isEligibleForSpectraBoost =
    currentVault.chainID === KATANA_CHAIN_ID &&
    SPECTRA_BOOST_VAULT_ADDRESSES.includes(currentVault.address.toLowerCase())

  const hasKatanaDetails = currentVault.chainID === KATANA_CHAIN_ID && katanaExtras && data.katanaEstApr !== undefined

  if (hasKatanaDetails && katanaExtras) {
    const steerPointsPerDollar = katanaExtras.steerPointsPerDollar ?? 0
    const hasSteerPoints = steerPointsPerDollar > 0
    const katanaAppRewardsAPR = katanaExtras.katanaAppRewardsAPR ?? katanaExtras.katanaRewardsAPR ?? 0
    return (
      <div className={INLINE_DETAILS_CONTAINER_CLASS}>
        <div className={INLINE_DETAILS_STACK_CLASS}>
          <InlineDetailRow
            label={'Est. Native APY'}
            value={<RenderAmount shouldHideTooltip value={data.baseForwardApr} symbol={'percent'} decimals={6} />}
          />
          <InlineDetailRow
            label={'Base Rewards APR'}
            value={
              <RenderAmount
                shouldHideTooltip
                value={katanaExtras.FixedRateKatanaRewards ?? 0}
                symbol={'percent'}
                decimals={6}
              />
            }
          />
          <InlineDetailRow
            label={'App Rewards APR'}
            value={<RenderAmount shouldHideTooltip value={katanaAppRewardsAPR} symbol={'percent'} decimals={6} />}
          />
          <InlineDetailRow
            label={'Deposit Bonus APR'}
            value={
              <RenderAmount
                shouldHideTooltip
                value={katanaExtras.katanaBonusAPY ?? 0}
                symbol={'percent'}
                decimals={6}
              />
            }
          />
          {hasSteerPoints ? (
            <InlineDetailRow label={'Steer Points / $'} value={steerPointsPerDollar.toFixed(2)} />
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
                className={INLINE_DETAILS_LINK_CLASS}
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
                  className={INLINE_DETAILS_LINK_CLASS}
                >
                  {'deposit to their protocol'}
                </a>
                {'.'}
              </li>
            )}
            {hasSteerPoints ? (
              <li className={'-mt-1 mb-2 w-full text-left text-xs text-text-secondary break-words whitespace-normal'}>
                {'This vault earns Steer Points, but you must '}
                <a
                  href={'https://app.steer.finance/points'}
                  target={'_blank'}
                  rel={'noopener noreferrer'}
                  className={INLINE_DETAILS_LINK_CLASS}
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
        <div className={INLINE_DETAILS_CONTAINER_CLASS}>
          <div className={INLINE_DETAILS_STACK_CLASS}>
            <InlineDetailRow
              label={'Base APY'}
              value={<RenderAmount shouldHideTooltip value={data.netApr} symbol={'percent'} decimals={6} />}
            />
            <InlineDetailRow
              label={'Rewards APR'}
              value={<RenderAmount shouldHideTooltip value={data.rewardsAprSum} symbol={'percent'} decimals={6} />}
            />
          </div>
        </div>
      )
    }
    return null
  }

  if (data.mode === 'boosted' && data.isBoosted) {
    const unBoostedAPY = data.unboostedApr || 0
    return showBoostDetails ? (
      <div className={INLINE_DETAILS_CONTAINER_CLASS}>
        <div className={INLINE_DETAILS_STACK_CLASS}>
          <InlineDetailRow
            label={'Base APY'}
            value={<RenderAmount shouldHideTooltip value={unBoostedAPY} symbol={'percent'} decimals={6} />}
          />
          <InlineDetailRow label={'Boost'} value={`${formatAmount(data.boost || 0, 2, 2)}x`} />
        </div>
      </div>
    ) : null
  }

  if (data.mode === 'rewards') {
    const isSourceVeYFI = currentVault.staking.source === 'VeYFI'
    const veYFIRange = data.veYfiRange
    return (
      <div className={INLINE_DETAILS_CONTAINER_CLASS}>
        <div className={INLINE_DETAILS_STACK_CLASS}>
          <InlineDetailRow
            label={'Base APY'}
            value={<RenderAmount shouldHideTooltip value={data.baseForwardApr} symbol={'percent'} decimals={6} />}
          />
          {isSourceVeYFI && veYFIRange ? (
            <InlineDetailRow
              label={'Rewards APR'}
              value={
                <>
                  <RenderAmount shouldHideTooltip value={veYFIRange[0]} symbol={'percent'} decimals={6} />
                  {' → '}
                  <RenderAmount shouldHideTooltip value={veYFIRange[1]} symbol={'percent'} decimals={6} />
                </>
              }
            />
          ) : (
            <InlineDetailRow
              label={'Rewards APR'}
              value={<RenderAmount shouldHideTooltip value={data.rewardsAprSum} symbol={'percent'} decimals={6} />}
            />
          )}
        </div>
      </div>
    )
  }

  return null
}
