import { useVaultApyData } from '@pages/vaults/hooks/useVaultApyData'
import { useWallet } from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { cl, formatAmount } from '@shared/utils'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import type { ReactElement } from 'react'
import { useConnect } from 'wagmi'

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
  value: string
}

function CompactStatBox({ label, value }: CompactStatBoxProps): ReactElement {
  return (
    <div className="flex-1 min-w-0 rounded-lg bg-surface-secondary border border-border px-2 py-1.5 min-[375px]:px-3 min-[375px]:py-2">
      <p className="text-[10px] min-[375px]:text-xs text-text-secondary truncate">{label}</p>
      <p className="text-xs min-[375px]:text-sm font-semibold text-text-primary truncate">{value}</p>
    </div>
  )
}

// Format USD values
const formatUSD = (value: number): string => {
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

// Format APR/APY
const formatPercent = (value: number): string => {
  return `${(value * 100).toFixed(2)}%`
}

// Format balances
const formatBalance = (balance: number, symbol: string): string => {
  return `${formatAmount(balance, 0, 6)} ${symbol}`
}

interface VaultMetricsGridProps {
  currentVault: TYDaemonVault
}

export function VaultMetricsGrid({ currentVault }: VaultMetricsGridProps): ReactElement {
  // Get APY data
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
        <StatCard label="Fwd. APY" value={formatPercent(forwardAPY)} />
      </div>
    </div>
  )
}

interface UserBalanceGridProps {
  currentVault: TYDaemonVault
}

export function UserBalanceGrid({ currentVault }: UserBalanceGridProps): ReactElement {
  const { address, isActive, openLoginModal } = useWeb3()
  const { getToken } = useWallet()
  const { connectors, connect } = useConnect()

  // Get user balance
  const vaultToken = getToken({
    address: currentVault.address,
    chainID: currentVault.chainID
  })
  const underlyingToken = getToken({
    address: currentVault.token.address,
    chainID: currentVault.chainID
  })

  const hasVaultBalance = isActive && address && vaultToken?.balance && vaultToken.balance.raw > 0n
  const hasUnderlyingBalance = isActive && address && underlyingToken?.balance && underlyingToken.balance.raw > 0n

  const handleConnectWallet = (): void => {
    if (openLoginModal) {
      openLoginModal()
    } else if (connectors[0]) {
      connect({ connector: connectors[0] })
    }
  }

  return (
    <div className="md:hidden">
      {/* Bottom row: User balances or Connect button */}
      {isActive && address ? (
        <div className="grid grid-cols-2 gap-1.5 min-[375px]:gap-2">
          <StatCard
            label="Your Deposit"
            value={hasVaultBalance ? formatBalance(vaultToken.balance.normalized, currentVault.symbol) : '0.00'}
            subValue={hasVaultBalance && vaultToken.value ? formatUSD(vaultToken.value) : undefined}
          />
          <StatCard
            label={`${currentVault.token.symbol} Bal`}
            value={
              hasUnderlyingBalance
                ? formatBalance(underlyingToken.balance.normalized, currentVault.token.symbol)
                : '0.00'
            }
            subValue={hasUnderlyingBalance && underlyingToken.value ? formatUSD(underlyingToken.value) : undefined}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={handleConnectWallet}
          className={cl(
            'w-full rounded-lg bg-text-primary hover:bg-text-primary/90',
            'py-3 min-[375px]:py-3.5 px-3 min-[375px]:px-4 text-xs min-[375px]:text-sm font-semibold text-surface',
            'transition-colors duration-200',
            'active:scale-[0.99]',
            'min-h-[44px]'
          )}
        >
          <span className="hidden min-[375px]:inline">Connect Wallet to View Balances</span>
          <span className="min-[375px]:hidden">Connect Wallet</span>
        </button>
      )}
    </div>
  )
}

// Compact key metrics row for mobile - positioned above chart
interface MobileKeyMetricsProps {
  currentVault: TYDaemonVault
}

export function MobileKeyMetrics({ currentVault }: MobileKeyMetricsProps): ReactElement {
  const { address, isActive } = useWeb3()
  const { getToken } = useWallet()
  const apyData = useVaultApyData(currentVault)

  const forwardAPY =
    apyData.mode === 'katana' && apyData.katanaEstApr !== undefined
      ? apyData.katanaEstApr
      : currentVault.apr.forwardAPR.netAPR

  const vaultToken = getToken({
    address: currentVault.address,
    chainID: currentVault.chainID
  })

  const hasVaultBalance = isActive && address && vaultToken?.balance && vaultToken.balance.raw > 0n
  const depositValue = hasVaultBalance && vaultToken.value ? formatUSD(vaultToken.value) : '$0.00'

  return (
    <div className="md:hidden flex gap-1.5 min-[375px]:gap-2">
      <CompactStatBox label="Deposited" value={depositValue} />
      <CompactStatBox label="TVL" value={formatUSD(currentVault.tvl.tvl)} />
      <CompactStatBox label="Fwd. APY" value={formatPercent(forwardAPY)} />
    </div>
  )
}

// Legacy export for backwards compatibility
interface QuickStatsGridProps {
  currentVault: TYDaemonVault
}

export function QuickStatsGrid({ currentVault }: QuickStatsGridProps): ReactElement {
  return (
    <div className="md:hidden space-y-3">
      <VaultMetricsGrid currentVault={currentVault} />
      <UserBalanceGrid currentVault={currentVault} />
    </div>
  )
}
