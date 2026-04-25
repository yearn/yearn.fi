import { APYDetailsModal } from '@pages/vaults/components/table/APYDetailsModal'
import type { TVaultForwardAPYHandle } from '@pages/vaults/components/table/VaultForwardAPY'
import { VaultForwardAPY } from '@pages/vaults/components/table/VaultForwardAPY'
import { YvUsdApyDetailsContent } from '@pages/vaults/components/yvUSD/YvUsdBreakdown'
import { getVaultAPR, getVaultToken, getVaultTVL, type TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { useVaultApyData } from '@pages/vaults/hooks/useVaultApyData'
import { getYvUsdInfinifiPointsNote, type TYvUsdVariant } from '@pages/vaults/utils/yvUsd'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { IconInfinifiPoints } from '@shared/icons/IconInfinifiPoints'
import { IconLock } from '@shared/icons/IconLock'
import { IconLockOpen } from '@shared/icons/IconLockOpen'
import { cl, formatApyDisplay, toNormalizedBN } from '@shared/utils'
import type { KeyboardEvent, MouseEvent, ReactElement, ReactNode } from 'react'
import { useRef, useState } from 'react'

interface StatCardProps {
  label: string
  value: string | number
  subValue?: string
}

function StatCard({ label, value, subValue }: StatCardProps): ReactElement {
  return (
    <div
      className={cl('rounded-lg bg-surface-secondary border border-border p-2 min-[375px]:p-3 min-w-0 overflow-hidden')}
    >
      <p className={'text-[10px] min-[375px]:text-xs text-text-secondary mb-0.5 min-[375px]:mb-1 truncate'}>{label}</p>
      <p className={'text-xs min-[375px]:text-sm md:text-base font-semibold text-text-primary truncate'}>{value}</p>
      {subValue && <p className={'text-[10px] min-[375px]:text-xs text-text-secondary mt-0.5 truncate'}>{subValue}</p>}
    </div>
  )
}

interface CompactStatBoxProps {
  label: string
  value: ReactNode
  onClick?: () => void
}

function CompactStatBox({ label, value, onClick }: CompactStatBoxProps): ReactElement {
  const isInteractive = Boolean(onClick)

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!isInteractive) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onClick?.()
  }

  return (
    <div
      className={cl(
        'flex-1 min-w-0 rounded-lg bg-surface-secondary border border-border px-2 py-1.5 min-[375px]:px-3 min-[375px]:py-2',
        isInteractive ? 'cursor-pointer' : undefined
      )}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      <p className="text-[10px] min-[375px]:text-xs text-text-secondary truncate">{label}</p>
      <div className="text-xs min-[375px]:text-sm font-semibold text-text-primary truncate">{value}</div>
    </div>
  )
}

function formatUSD(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`
  }
  return `$${value.toFixed(2)}`
}

interface VaultMetricsGridProps {
  currentVault: TKongVaultInput
}

export function VaultMetricsGrid({ currentVault }: VaultMetricsGridProps): ReactElement {
  const apyData = useVaultApyData(currentVault)
  const apr = getVaultAPR(currentVault)
  const tvl = getVaultTVL(currentVault)
  const forwardAPY =
    apyData.mode === 'katana' && apyData.katanaEstApr !== undefined ? apyData.katanaEstApr : apr.forwardAPR.netAPR

  return (
    <div className="md:hidden">
      {/* Top row: TVL, Forward APY */}
      <div className="grid grid-cols-2 gap-1.5 min-[375px]:gap-2">
        <StatCard label="TVL" value={formatUSD(tvl.tvl)} />
        <StatCard label="Est. APY" value={formatApyDisplay(forwardAPY)} />
      </div>
    </div>
  )
}

const MOBILE_SECTIONS = [
  { id: 'about', label: 'Vault Info' },
  { id: 'strategies', label: 'Strategies' },
  { id: 'risk', label: 'Risk' },
  { id: 'info', label: 'More Info' }
] as const

function SectionNavButton({ sectionId, label }: { sectionId: string; label: string }): ReactElement {
  const handleClick = (): void => {
    const element = document.querySelector(`[data-scroll-spy-key="${sectionId}"]`)
    if (element) {
      const headerHeight = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--header-height') || '64',
        10
      )
      const offset = headerHeight + 16
      const top = element.getBoundingClientRect().top + window.scrollY - offset
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cl(
        'w-full rounded-full px-2 py-1.5 text-xs font-medium text-center',
        'bg-surface-secondary border border-border text-text-secondary',
        'active:scale-95 transition-all',
        'hover:text-text-primary hover:border-border-hover'
      )}
    >
      {label}
    </button>
  )
}

interface MobileKeyMetricsProps {
  currentVault: TKongVaultInput
  showSectionNav?: boolean
  depositedValue?: bigint
  depositedUsdValue?: number
  tokenPrice: number
  apyBox?: ReactElement
}

export function MobileKeyMetrics({
  currentVault,
  showSectionNav = true,
  depositedValue,
  depositedUsdValue,
  tokenPrice,
  apyBox
}: MobileKeyMetricsProps): ReactElement {
  const { address, isActive } = useWeb3()
  const forwardApyRef = useRef<TVaultForwardAPYHandle>(null)
  const token = getVaultToken(currentVault)
  const tvl = getVaultTVL(currentVault)

  const hasDepositedUsdOverride = isActive && address && typeof depositedUsdValue === 'number' && depositedUsdValue > 0
  const hasVaultBalance = isActive && address && depositedValue !== undefined && depositedValue > 0n
  const depositedAmount = toNormalizedBN(depositedValue ?? 0n, token.decimals)
  const resolvedDepositedUsdValue = depositedAmount.normalized * tokenPrice
  const depositValue = hasDepositedUsdOverride
    ? formatUSD(depositedUsdValue)
    : hasVaultBalance
      ? formatUSD(resolvedDepositedUsdValue)
      : '$0.00'

  return (
    <div className="md:hidden space-y-2">
      <div className="grid grid-cols-3 gap-1.5 min-[375px]:gap-2">
        {apyBox ?? (
          <CompactStatBox
            label="Est. APY"
            onClick={() => forwardApyRef.current?.openModal()}
            value={
              <VaultForwardAPY
                ref={forwardApyRef}
                currentVault={currentVault}
                showSubline={false}
                showSublineTooltip
                showBoostDetails={false}
                className="items-start text-left"
                valueClassName="text-xs min-[375px]:text-sm font-semibold text-text-primary"
                containerClassName="w-full"
                isContainerInteractive
              />
            }
          />
        )}
        <CompactStatBox label="TVL" value={formatUSD(tvl.tvl)} />
        <CompactStatBox label="Deposited" value={depositValue} />
      </div>
      {showSectionNav ? (
        <div className="grid grid-cols-4 gap-2">
          {MOBILE_SECTIONS.map((section) => (
            <SectionNavButton key={section.id} sectionId={section.id} label={section.label} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function YvUsdApyStatBox({
  lockedApy,
  unlockedApy,
  activeVariant,
  onVariantChange,
  lockedHasInfinifiPoints = false,
  unlockedHasInfinifiPoints = false,
  title = 'yvUSD APY'
}: {
  lockedApy: number
  unlockedApy: number
  activeVariant?: TYvUsdVariant
  onVariantChange?: (variant: TYvUsdVariant) => void
  lockedHasInfinifiPoints?: boolean
  unlockedHasInfinifiPoints?: boolean
  title?: string
}): ReactElement {
  const [internalVariant, setInternalVariant] = useState<TYvUsdVariant>('locked')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const isControlledVariant = activeVariant !== undefined
  const apyVariant = isControlledVariant ? activeVariant : internalVariant
  const isLockedVariant = apyVariant === 'locked'
  const selectedApy = isLockedVariant ? lockedApy : unlockedApy
  const selectedLabel = isLockedVariant ? 'Locked' : 'Unlocked'
  const toggleLabel = isLockedVariant ? 'Switch to unlocked APY display' : 'Switch to locked APY display'
  const hasInfinifiPoints = lockedHasInfinifiPoints || unlockedHasInfinifiPoints
  const infinifiPointsNote = hasInfinifiPoints ? getYvUsdInfinifiPointsNote() : undefined

  const handleToggle = (event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault()
    event.stopPropagation()
    const nextVariant = apyVariant === 'locked' ? 'unlocked' : 'locked'
    if (isControlledVariant) {
      onVariantChange?.(nextVariant)
      return
    }
    setInternalVariant(nextVariant)
  }

  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.target !== event.currentTarget) {
      return
    }
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }
    event.preventDefault()
    setIsModalOpen(true)
  }

  return (
    <>
      {/* biome-ignore lint/a11y/useSemanticElements: this card opens a modal while containing a nested variant toggle button */}
      <div
        className={
          'flex min-w-0 flex-1 cursor-pointer flex-col rounded-lg border border-border bg-surface-secondary px-2 py-1.5 min-[375px]:px-3 min-[375px]:py-2'
        }
        role={'button'}
        tabIndex={0}
        aria-label={`Open ${title} details`}
        onClick={() => setIsModalOpen(true)}
        onKeyDown={handleCardKeyDown}
      >
        <p className={'text-[10px] min-[375px]:text-xs text-text-secondary truncate'}>{'Est. APY'}</p>
        <div className={'mt-0.5 flex w-full items-center gap-2'}>
          <div className={'flex min-w-0 flex-col'}>
            <span
              className={'inline-flex items-center gap-1.5 text-xs min-[375px]:text-sm font-semibold text-text-primary'}
            >
              {hasInfinifiPoints ? (
                <IconInfinifiPoints className={'size-3.5 shrink-0'} aria-label={'Infinifi points'} />
              ) : null}
              {formatApyDisplay(selectedApy)}
            </span>
            <span className={'text-[10px] min-[375px]:text-xs text-text-secondary'}>{selectedLabel}</span>
          </div>
          <button
            type={'button'}
            onClick={handleToggle}
            aria-label={toggleLabel}
            className={'ml-auto inline-flex size-5 items-center justify-center rounded-sm text-text-secondary'}
          >
            {isLockedVariant ? <IconLock className={'size-3.5'} /> : <IconLockOpen className={'h-3.5 w-4'} />}
          </button>
        </div>
      </div>
      <APYDetailsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={title}>
        <YvUsdApyDetailsContent
          lockedValue={lockedApy}
          unlockedValue={unlockedApy}
          infinifiPointsNote={infinifiPointsNote}
        />
      </APYDetailsModal>
    </>
  )
}
