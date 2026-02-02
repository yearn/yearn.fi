import type { TVaultForwardAPYHandle } from '@pages/vaults/components/table/VaultForwardAPY'
import { VaultForwardAPY } from '@pages/vaults/components/table/VaultForwardAPY'
import { useVaultApyData } from '@pages/vaults/hooks/useVaultApyData'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { cl, formatApyDisplay, toNormalizedBN } from '@shared/utils'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import type { KeyboardEvent, ReactElement, ReactNode } from 'react'
import { useRef } from 'react'

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
  currentVault: TYDaemonVault
}

export function VaultMetricsGrid({ currentVault }: VaultMetricsGridProps): ReactElement {
  const apyData = useVaultApyData(currentVault)
  const forwardAPY =
    apyData.mode === 'katana' && apyData.katanaEstApr !== undefined
      ? apyData.katanaEstApr
      : currentVault.apr.forwardAPR.netAPR

  return (
    <div className="md:hidden">
      {/* Top row: TVL, Forward APY */}
      <div className="grid grid-cols-2 gap-1.5 min-[375px]:gap-2">
        <StatCard label="TVL" value={formatUSD(currentVault.tvl.tvl)} />
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
  currentVault: TYDaemonVault
  showSectionNav?: boolean
  depositedValue?: bigint
  tokenPrice: number
}

export function MobileKeyMetrics({
  currentVault,
  showSectionNav = true,
  depositedValue,
  tokenPrice
}: MobileKeyMetricsProps): ReactElement {
  const { address, isActive } = useWeb3()
  const forwardApyRef = useRef<TVaultForwardAPYHandle>(null)

  const hasVaultBalance = isActive && address && depositedValue !== undefined && depositedValue > 0n
  const depositedAmount = toNormalizedBN(depositedValue ?? 0n, currentVault.token.decimals)
  const depositUsdValue = depositedAmount.normalized * tokenPrice
  const depositValue = hasVaultBalance ? formatUSD(depositUsdValue) : '$0.00'

  return (
    <div className="md:hidden space-y-2">
      <div className="grid grid-cols-3 gap-1.5 min-[375px]:gap-2">
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
        <CompactStatBox label="TVL" value={formatUSD(currentVault.tvl.tvl)} />
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
