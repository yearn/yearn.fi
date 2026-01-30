import { findLatestReportApr } from '@pages/vaults/domain/reports/findLatestReportApr'
import type { TKongReports } from '@pages/vaults/domain/reports/kongReports.schema'
import { kongReportsSchema } from '@pages/vaults/domain/reports/kongReports.schema'
import { KONG_REST_BASE } from '@pages/vaults/utils/kongRest'
import { RenderAmount } from '@shared/components/RenderAmount'
import { TokenLogo } from '@shared/components/TokenLogo'
import { useFetch } from '@shared/hooks/useFetch'
import { IconChevron } from '@shared/icons/IconChevron'
import { IconCopy } from '@shared/icons/IconCopy'
import { IconLinkOut } from '@shared/icons/IconLinkOut'
import type { TAddress } from '@shared/types'
import { cl, formatPercent, toAddress, truncateHex } from '@shared/utils'
import { formatDuration } from '@shared/utils/format.time'
import { copyToClipboard } from '@shared/utils/helpers'
import type { TYDaemonVault, TYDaemonVaultStrategy } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { getNetwork } from '@shared/utils/wagmi/utils'
import type { ReactElement } from 'react'
import { useMemo, useState } from 'react'
import Link from '/src/components/Link'

export function VaultsListStrategy({
  details,
  chainId,
  allocation,
  name,
  tokenAddress,
  address,
  isVault = false,
  variant = 'v3',
  apr,
  fees,
  isUnallocated = false,
  vaultAddress
}: {
  details: TYDaemonVaultStrategy['details']
  chainId: number
  allocation: string
  name: string
  tokenAddress: TAddress
  address: TAddress
  isVault?: boolean
  variant: 'v2' | 'v3'
  apr: number | null | undefined
  fees: TYDaemonVault['apr']['fees']
  isUnallocated?: boolean
  vaultAddress?: TAddress
}): ReactElement {
  const [isExpanded, setIsExpanded] = useState(false)
  const shouldFetchReports = variant === 'v2' && !isVault && apr == null

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
    (): number | null => (reportEndpoint ? findLatestReportApr(reports, address) : null),
    [reports, reportEndpoint, address]
  )
  const displayApr = apr ?? latestApr

  const lastReportTime = details?.lastReport ? formatDuration(details.lastReport * 1000 - Date.now(), true) : 'N/A'

  return (
    <div className={cl('w-full', 'rounded-lg', 'text-text-primary', isUnallocated ? 'opacity-50' : '')}>
      {/* Collapsible header - always visible */}
      <div
        className={cl(
          'flex flex-col md:grid md:grid-cols-24 items-start md:items-center w-full gap-3 md:gap-4 py-3 px-4 md:px-8 cursor-pointer',
          'transition-colors duration-200 hover:bg-surface-secondary/50'
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Top row on mobile: Name + Chevron */}
        <div className={'flex flex-row items-center justify-between w-full md:col-span-9 md:w-auto'}>
          <div className={'flex flex-row items-center gap-2 flex-1 min-w-0'}>
            <div className={'flex items-center justify-center size-6 flex-shrink-0'}>
              <div
                className={cl(
                  'size-2 rounded-full',
                  (details?.debtRatio || 0) > 0 ? 'bg-green-500' : 'bg-text-secondary'
                )}
              />
            </div>
            <TokenLogo
              src={`${
                import.meta.env.VITE_BASE_YEARN_ASSETS_URI
              }/tokens/${chainId}/${tokenAddress.toLowerCase()}/logo-32.png`}
              tokenSymbol={name}
              tokenName={name}
              width={24}
              height={24}
              className="rounded-full flex-shrink-0"
            />
            <strong title={name} className={'block truncate font-bold min-w-0'}>
              {name}
            </strong>
          </div>
          <div className={'flex md:hidden ml-2'}>
            <IconChevron
              className={cl('size-4 text-text-secondary transition-transform duration-200')}
              direction={isExpanded ? 'up' : 'down'}
            />
          </div>
        </div>

        {/* Stats row - 3 columns on mobile */}
        <div className={'grid grid-cols-3 gap-2 w-full md:col-span-14 md:grid-cols-15 md:gap-4'}>
          <div className={'flex flex-col md:col-span-5 md:items-end'}>
            <p className={'text-xs text-text-primary/60 mb-1 md:hidden'}>{'Allocation %'}</p>
            <p className={'font-semibold'}>{formatPercent((details?.debtRatio || 0) / 100, 0)}</p>
          </div>
          <div className={'flex flex-col md:col-span-5 md:items-end'}>
            <p className={'text-xs text-text-primary/60 mb-1 md:hidden'}>{'Amount'}</p>
            <p className={'font-semibold truncate'} title={allocation}>
              {allocation}
            </p>
          </div>
          <div className={'flex flex-col md:col-span-5 md:items-end'}>
            <p className={'text-xs text-text-primary/60 mb-1 md:hidden'}>{'APY'}</p>
            <p className={'font-semibold'}>
              {displayApr == null ? (
                '--'
              ) : (
                <RenderAmount shouldHideTooltip value={displayApr} symbol={'percent'} decimals={6} />
              )}
            </p>
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
              <span className={'w-full text-text-secondary md:w-36'}>{'Management Fee:'}</span>
              <span>{formatPercent((fees?.management || 0) * 100, 0)}</span>
            </div>
            <div className={'flex flex-col items-start gap-1 md:flex-row md:items-center md:gap-3'}>
              <span className={'w-full text-text-secondary md:w-36'}>{'Performance Fee:'}</span>
              <span>{formatPercent((details?.performanceFee || 0) / 100, 0)}</span>
            </div>
            <div className={'flex flex-col items-start gap-1 md:flex-row md:items-center md:gap-3'}>
              <span className={'w-full text-text-secondary md:w-36'}>{'Last Report:'}</span>
              <span>{lastReportTime}</span>
            </div>
            <div className={'flex flex-col items-start gap-1 md:flex-row md:items-center md:gap-3'}>
              <span className={'w-full text-text-secondary md:w-36'}>{'Address:'}</span>
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
                  className={cl('flex gap-1 items-center text-text-secondary hover:text-text-primary')}
                  target={'_blank'}
                  rel={'noopener noreferrer'}
                >
                  {'View Vault Page'}
                  <IconLinkOut className={'inline-block size-4'} />
                </Link>
              </div>
            ) : null}
            <div className={'flex items-start'}>
              <Link
                href={`${getNetwork(chainId)?.defaultBlockExplorer}/address/${address}`}
                onClick={(event: React.MouseEvent): void => event.stopPropagation()}
                className={cl('flex gap-1 items-center text-text-secondary hover:text-text-primary')}
                target={'_blank'}
                rel={'noopener noreferrer'}
              >
                {'View on Block Explorer'}
                <IconLinkOut className={'inline-block size-4'} />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
