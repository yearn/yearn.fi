import Link from '@components/Link'
import { VaultRiskScoreTag } from '@pages/vaults/components/table/VaultRiskScoreTag'
import { deriveListKind } from '@pages/vaults/utils/vaultListFacets'
import { TokenLogo } from '@shared/components/TokenLogo'
import { getVaultKey } from '@shared/hooks/useVaultFilterUtils'
import { IconClose } from '@shared/icons/IconClose'
import { IconLinkOut } from '@shared/icons/IconLinkOut'
import { cl, formatApyDisplay, formatPercent, formatTvlDisplay, isZero, toAddress } from '@shared/utils'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { getNetwork } from '@shared/utils/wagmi'
import type { ReactElement, ReactNode } from 'react'

type TCompareVaultCardProps = {
  vault: TYDaemonVault
  onRemove: (vaultKey: string) => void
}

type TVaultStrategyItem = NonNullable<TYDaemonVault['strategies']>[number]

const listKindLabels = {
  allocator: 'Allocator',
  strategy: 'Strategy',
  factory: 'Factory',
  legacy: 'Legacy'
}

function formatFee(value: number | undefined): string {
  return formatPercent((value ?? 0) * 100, 0)
}

function MetricRow({
  label,
  sublabel,
  children
}: {
  label: string
  sublabel?: string
  children: ReactNode
}): ReactElement {
  return (
    <div className={'flex items-start justify-between gap-4 border-b border-border py-3'}>
      <div className={'min-w-0 flex-shrink-0'}>
        <span className={'text-xs font-semibold uppercase tracking-wide text-text-secondary'}>{label}</span>
        {sublabel ? <span className={'mt-0.5 block text-[10px] text-text-secondary/70'}>{sublabel}</span> : null}
      </div>
      <div className={'text-left text-sm text-text-primary'}>{children}</div>
    </div>
  )
}

function renderPercentValue(value: number | undefined): ReactElement {
  if (value === undefined || Number.isNaN(value)) {
    return <span className={'text-text-secondary'}>{'—'}</span>
  }
  return <span className={'font-semibold'}>{formatApyDisplay(value)}</span>
}

function resolveThirtyDayApy(vault: TYDaemonVault): number {
  const monthly = vault.apr?.points?.monthAgo ?? 0
  const weekly = vault.apr?.points?.weekAgo ?? 0
  return isZero(monthly) ? weekly : monthly
}

function hasAllocatedFunds(strategy: TVaultStrategyItem): boolean {
  const { debtRatio, totalDebt } = strategy.details ?? {}
  return Boolean(debtRatio && debtRatio > 0 && totalDebt && totalDebt !== '0')
}

function normalizeRiskLevel(riskLevel: number): number {
  return Math.min(Math.max(riskLevel, 0), 5)
}

export function CompareVaultCard({ vault, onRemove }: TCompareVaultCardProps): ReactElement {
  const network = getNetwork(vault.chainID)
  const chainLogoSrc = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${vault.chainID}/logo-32.png`
  const vaultKey = getVaultKey(vault)
  const vaultHref = `/vaults/${vault.chainID}/${toAddress(vault.address)}`
  const listKind = deriveListKind(vault)
  const label = listKindLabels[listKind]
  const riskLevel = vault.info?.riskLevel ?? -1
  const normalizedRisk = normalizeRiskLevel(riskLevel)
  const strategies = (vault.strategies ?? [])
    .filter((strategy) => strategy.status !== 'not_active' && hasAllocatedFunds(strategy))
    .sort((left, right) => (right.details?.debtRatio ?? 0) - (left.details?.debtRatio ?? 0))

  return (
    <div className={'group flex h-full w-full flex-col rounded-2xl border border-border bg-surface p-4'}>
      <div className={'flex flex-col gap-2 border-b border-border pb-4'}>
        <button
          type={'button'}
          onClick={(): void => onRemove(vaultKey)}
          className={cl(
            'inline-flex size-8 items-center justify-center self-end rounded-full border border-transparent text-text-secondary',
            'transition-opacity md:opacity-0 md:pointer-events-none',
            'md:group-hover:opacity-100 md:group-hover:pointer-events-auto',
            'md:group-focus-within:opacity-100 md:group-focus-within:pointer-events-auto',
            'hover:border-border hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'
          )}
          aria-label={`Remove ${vault.name} from comparison`}
        >
          <IconClose className={'size-4'} />
        </button>
        <Link
          href={vaultHref}
          target={'_blank'}
          rel={'noopener noreferrer'}
          className={cl(
            'flex w-full items-start justify-between gap-3 rounded-2xl px-2 py-1.5',
            'transition-colors hover:bg-surface-secondary/60',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'
          )}
          aria-label={`Open ${vault.name} vault in a new tab`}
        >
          <div className={'min-w-0 flex-1'}>
            <div className={'flex items-center gap-3'}>
              <TokenLogo
                src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${vault.chainID}/${vault.token.address.toLowerCase()}/logo-128.png`}
                tokenSymbol={vault.token.symbol || ''}
                width={36}
                height={36}
              />
              <div className={'min-w-0'}>
                <p className={'truncate text-sm font-semibold text-text-primary'}>{vault.name}</p>
                <div className={'mt-1 flex items-center gap-2 text-xs text-text-secondary'}>
                  <TokenLogo src={chainLogoSrc} tokenSymbol={network.name} width={14} height={14} />
                  <span>{network.name}</span>
                </div>
              </div>
            </div>
          </div>
          <IconLinkOut className={'mt-1 size-4 flex-shrink-0 text-text-secondary'} />
        </Link>
      </div>

      <div className={'flex-1 overflow-x-hidden overflow-y-auto'}>
        <MetricRow label={'Est. APY'} sublabel={'Forward net APR'}>
          {renderPercentValue(vault.apr?.forwardAPR?.netAPR)}
        </MetricRow>

        <MetricRow label={'30 Day APY'} sublabel={'Average realized'}>
          {renderPercentValue(resolveThirtyDayApy(vault))}
        </MetricRow>

        <MetricRow label={'TVL'} sublabel={'Total value locked'}>
          <span className={'font-semibold'}>{formatTvlDisplay(vault.tvl?.tvl ?? 0)}</span>
        </MetricRow>

        <MetricRow label={'Fees'} sublabel={'Mgmt / Perf'}>
          <div className={'flex flex-col gap-0.5 text-xs'}>
            <span>
              <span className={'text-text-secondary'}>{'Management:'}</span>{' '}
              <span>{formatFee(vault.apr?.fees?.management)}</span>
            </span>
            <span>
              <span className={'text-text-secondary'}>{'Performance:'}</span>{' '}
              <span>{formatFee(vault.apr?.fees?.performance)}</span>
            </span>
          </div>
        </MetricRow>

        <MetricRow label={'Risk'} sublabel={'Security score'}>
          <div className={'flex flex-col items-start gap-1'}>
            <VaultRiskScoreTag riskLevel={riskLevel} variant={'inline'} />
            <span className={'text-xs text-text-secondary'}>{`Level ${normalizedRisk} / 5`}</span>
          </div>
        </MetricRow>

        <MetricRow label={'Type'} sublabel={'Vault structure'}>
          <div className={'flex flex-col items-start'}>
            <span className={'text-sm font-semibold text-text-primary'}>{label}</span>
            <span className={'text-xs text-text-secondary'}>{vault.kind}</span>
          </div>
        </MetricRow>

        <div className={'py-3'}>
          <div className={'mb-2'}>
            <span className={'text-xs font-semibold uppercase tracking-wide text-text-secondary'}>{'Strategies'}</span>
            <span className={'mt-0.5 block text-[10px] text-text-secondary/70'}>{'Underlying positions'}</span>
          </div>
          {strategies.length === 0 ? (
            <span className={'text-sm text-text-secondary'}>{'—'}</span>
          ) : (
            <div className={'flex flex-col gap-2'}>
              {strategies.map((strategy) => {
                const debtRatio = strategy.details?.debtRatio
                const allocation = debtRatio ? formatPercent(debtRatio / 100, 0) : null
                return (
                  <div key={strategy.address} className={'flex items-start gap-2 text-xs'}>
                    <span className={'text-text-primary'}>{strategy.name}</span>
                    {allocation ? <span className={'text-text-secondary'}>{allocation}</span> : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
