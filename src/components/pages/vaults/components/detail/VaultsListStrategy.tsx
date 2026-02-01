import { findLatestReportApr } from '@pages/vaults/domain/reports/findLatestReportApr'
import type { TKongReports } from '@pages/vaults/domain/reports/kongReports.schema'
import { kongReportsSchema } from '@pages/vaults/domain/reports/kongReports.schema'
import { KONG_REST_BASE } from '@pages/vaults/utils/kongRest'
import { TokenLogo } from '@shared/components/TokenLogo'
import { useFetch } from '@shared/hooks/useFetch'
import { IconChevron } from '@shared/icons/IconChevron'
import { IconCopy } from '@shared/icons/IconCopy'
import { IconLinkOut } from '@shared/icons/IconLinkOut'
import type { TAddress } from '@shared/types'
import { cl, formatAllocationPercent, formatApyDisplay, formatPercent, toAddress, truncateHex } from '@shared/utils'
import { formatDuration } from '@shared/utils/format.time'
import { copyToClipboard } from '@shared/utils/helpers'
import type { TYDaemonVault, TYDaemonVaultStrategy } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { getNetwork } from '@shared/utils/wagmi/utils'
import type { ReactElement } from 'react'
import { useMemo, useState } from 'react'
import Link from '/src/components/Link'

export function VaultsListStrategy({
  details,
  status,
  chainId,
  allocation,
  name,
  tokenAddress,
  address,
  isVault = false,
  variant = 'v3',
  apr,
  fees,
  vaultAddress
}: {
  details: TYDaemonVaultStrategy['details']
  status: TYDaemonVaultStrategy['status']
  chainId: number
  allocation: string
  name: string
  tokenAddress: TAddress
  address: TAddress
  isVault?: boolean
  variant: 'v2' | 'v3'
  apr: number | null | undefined
  fees: TYDaemonVault['apr']['fees']
  vaultAddress?: TAddress
}): ReactElement {
  const [isExpanded, setIsExpanded] = useState(false)
  const isInactive = status === 'not_active'
  const isUnallocated = status === 'unallocated'
  const shouldShowPlaceholders = isInactive || isUnallocated
  const ONE_WEEK_IN_SECONDS = 7 * 24 * 60 * 60
  const nowSeconds = Math.floor(Date.now() / 1000)
  const lastReportSeconds =
    details?.lastReport && details.lastReport > 0
      ? details.lastReport > 1_000_000_000_000
        ? Math.floor(details.lastReport / 1000)
        : details.lastReport
      : null
  const isLatestReportFresh = lastReportSeconds ? nowSeconds - lastReportSeconds <= ONE_WEEK_IN_SECONDS : true
  const shouldFetchReports = variant === 'v2' && !isVault && status === 'active' && apr == null && isLatestReportFresh

  const reportEndpoint =
    shouldFetchReports && vaultAddress ? `${KONG_REST_BASE}/reports/${chainId}/${toAddress(vaultAddress)}` : null

  const { data: reports } = useFetch<TKongReports>({
    endpoint: reportEndpoint,
    schema: kongReportsSchema,
    config: {
      keepPreviousData: true
    }
  })

  const latestApr = useMemo(
    (): number | null =>
      reportEndpoint ? findLatestReportApr(reports, address, { maxAgeSeconds: ONE_WEEK_IN_SECONDS }) : null,
    [reports, reportEndpoint, address]
  )
  const displayApr = apr ?? latestApr

  const lastReportTime = details?.lastReport ? formatDuration(details.lastReport * 1000 - Date.now(), true) : 'N/A'
  let apyContent: ReactElement | string = '--'
  if (shouldShowPlaceholders) {
    apyContent = '-'
  } else if (displayApr != null) {
    apyContent = <RenderAmount shouldHideTooltip value={displayApr} symbol={'percent'} decimals={6} />
  }

  const allocationContent = isInactive ? '-' : isUnallocated ? '-' : formatPercent((details?.debtRatio || 0) / 100, 0)

  const amountContent = isInactive ? '-' : isUnallocated ? '-' : allocation

  return (
    <div className={cl('w-full rounded-lg text-text-primary', isUnallocated ? 'opacity-50' : '')}>
      {/* Collapsible header - always visible */}
      <div
        className={cl(
          'flex flex-col md:grid md:grid-cols-24 items-start md:items-center w-full gap-3 md:gap-4 py-3 px-4 md:px-8 cursor-pointer',
          'transition-colors duration-200 hover:bg-surface-secondary/50'
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Top row on mobile: Name + Chevron */}
        <div className={'flex w-full items-center justify-between md:col-span-9 md:w-auto'}>
          <div className={'flex min-w-0 flex-1 items-center gap-2'}>
            <div className={'flex items-center justify-center size-6 flex-shrink-0'}>
              <div
                className={cl(
                  'size-2 rounded-full',
                  (details?.debtRatio || 0) > 0 ? 'bg-green-500' : 'bg-text-secondary'
                )}
              />
            </div>
            <div className="flex-shrink-0 flex items-center md:hidden">
              <TokenLogo
                src={`${
                  import.meta.env.VITE_BASE_YEARN_ASSETS_URI
                }/tokens/${chainId}/${tokenAddress.toLowerCase()}/logo-32.png`}
                tokenSymbol={name}
                tokenName={name}
                width={20}
                height={20}
                className="rounded-full"
              />
            </div>
            <div className="flex-shrink-0 hidden md:flex md:items-center">
              <TokenLogo
                src={`${
                  import.meta.env.VITE_BASE_YEARN_ASSETS_URI
                }/tokens/${chainId}/${tokenAddress.toLowerCase()}/logo-32.png`}
                tokenSymbol={name}
                tokenName={name}
                width={28}
                height={28}
                className="rounded-full"
              />
            </div>
            <strong title={name} className={'block truncate font-bold min-w-0'}>
              {name}
            </strong>
          </div>
          <div className={'ml-2 flex md:hidden'}>
            <IconChevron
              className={cl('size-4 text-text-secondary transition-transform duration-200')}
              direction={isExpanded ? 'up' : 'down'}
            />
          </div>
        </div>

        {/* Stats row - 3 columns on mobile */}
        <div className={'grid w-full grid-cols-3 gap-2 md:col-span-14 md:grid-cols-15 md:gap-4'}>
          <div className={'flex flex-col items-center md:items-end md:col-span-5'}>
            <p className={'text-xs text-text-primary/60 mb-1 md:hidden'}>{'Allocation %'}</p>
            <p className={'font-semibold'}>{formatAllocationPercent((details?.debtRatio || 0) / 100)}</p>
          </div>
          <div className={'flex flex-col items-center md:items-end md:col-span-5'}>
            <p className={'text-xs text-text-primary/60 mb-1 md:hidden'}>{'Amount'}</p>
            <p className={'font-semibold truncate'} title={allocation}>
              {amountContent}
            </p>
          </div>
          <div className={'flex flex-col items-center md:items-end md:col-span-5'}>
            <p className={'text-xs text-text-primary/60 mb-1 md:hidden'}>{'APY'}</p>
            <p className={'font-semibold'}>{displayApr == null ? '--' : formatApyDisplay(displayApr)}</p>
          </div>
        </div>

        {/* Chevron - desktop only */}
        <div className={'hidden md:flex col-span-1 justify-end items-center'}>
          <IconChevron
            className={cl('size-4 text-text-secondary transition-transform duration-200')}
            direction={isExpanded ? 'up' : 'down'}
          />
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className={'px-4 pb-4 md:px-12 md:pb-6'}>
          <div className={'flex flex-col gap-1 text-sm pt-2'}>
            <div className={'flex flex-col items-start gap-1 md:flex-row md:items-center md:gap-3'}>
              <span className={'w-full text-text-secondary md:w-36'}>Management Fee:</span>
              <span>{formatPercent((fees?.management || 0) * 100, 0)}</span>
            </div>
            <div className={'flex flex-col items-start gap-1 md:flex-row md:items-center md:gap-3'}>
              <span className={'w-full text-text-secondary md:w-36'}>Performance Fee:</span>
              <span>{formatPercent((details?.performanceFee || 0) / 100, 0)}</span>
            </div>
            <div className={'flex flex-col items-start gap-1 md:flex-row md:items-center md:gap-3'}>
              <span className={'w-full text-text-secondary md:w-36'}>Last Report:</span>
              <span>{lastReportTime}</span>
            </div>
            <div className={'flex flex-col items-start gap-1 md:flex-row md:items-center md:gap-3'}>
              <span className={'w-full text-text-secondary md:w-36'}>Address:</span>
              <div className={'flex items-center gap-2'}>
                <span title={address}>{truncateHex(address, 6)}</span>
                <button
                  type={'button'}
                  onClick={(e): void => {
                    e.stopPropagation()
                    copyToClipboard(address)
                  }}
                  className={'text-text-secondary hover:text-text-primary transition-colors'}
                  aria-label={'Copy address'}
                >
                  <IconCopy className={'size-4'} />
                </button>
              </div>
            </div>
            {variant === 'v3' && isVault ? (
              <div className={'flex items-start'}>
                <Link
                  href={`/vaults/${chainId}/${toAddress(address)}`}
                  className={'flex items-center gap-1 text-text-secondary hover:text-text-primary'}
                  target={'_blank'}
                  rel={'noopener noreferrer'}
                >
                  View Vault Page
                  <IconLinkOut className={'inline-block size-4'} />
                </Link>
              </div>
            ) : null}
            <div className={'flex items-start'}>
              <Link
                href={`${getNetwork(chainId)?.defaultBlockExplorer}/address/${address}`}
                onClick={(event: React.MouseEvent): void => event.stopPropagation()}
                className={'flex items-center gap-1 text-text-secondary hover:text-text-primary'}
                target={'_blank'}
                rel={'noopener noreferrer'}
              >
                View on Block Explorer
                <IconLinkOut className={'inline-block size-4'} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
