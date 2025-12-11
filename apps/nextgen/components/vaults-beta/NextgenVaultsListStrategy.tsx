import { RenderAmount } from '@lib/components/RenderAmount'
import { TokenLogo } from '@lib/components/TokenLogo'
import { useFetch } from '@lib/hooks/useFetch'
import { useYDaemonBaseURI } from '@lib/hooks/useYDaemonBaseURI'
import { IconChevron } from '@lib/icons/IconChevron'
import { IconCopy } from '@lib/icons/IconCopy'
import { IconLinkOut } from '@lib/icons/IconLinkOut'
import type { TAddress } from '@lib/types'
import { cl, formatPercent, toAddress, truncateHex } from '@lib/utils'
import { formatDuration } from '@lib/utils/format.time'
import { copyToClipboard } from '@lib/utils/helpers'
import type { TYDaemonVault, TYDaemonVaultStrategy } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { getNetwork } from '@lib/utils/wagmi/utils'
import { findLatestAPY } from '@vaults-v2/components/details/tabs/findLatestAPY'
import type { TYDaemonReports } from '@vaults-v2/schemas/reportsSchema'
import { yDaemonReportsSchema } from '@vaults-v2/schemas/reportsSchema'
import type { ReactElement } from 'react'
import { useMemo, useState } from 'react'
import Link from '/src/components/Link'

export function NextgenVaultsListStrategy({
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
  isUnallocated = false
}: {
  details: TYDaemonVaultStrategy['details']
  chainId: number
  allocation: string
  name: string
  tokenAddress: TAddress
  address: TAddress
  isVault?: boolean
  variant: 'v2' | 'v3'
  apr: number | undefined
  fees: TYDaemonVault['apr']['fees']
  isUnallocated?: boolean
}): ReactElement {
  const [isExpanded, setIsExpanded] = useState(false)

  const isStrategy = !apr

  const { yDaemonBaseUri } = useYDaemonBaseURI({ chainID: chainId })

  // Fetch if component is used for strategies that are not vaults
  const { data: reports } = useFetch<TYDaemonReports>({
    endpoint: isStrategy ? `${yDaemonBaseUri}/reports/${address}` : '',
    schema: yDaemonReportsSchema
  })
  const latestApr = useMemo((): number => findLatestAPY(reports), [reports])

  const finalApr = apr || latestApr

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
          <div className={'flex flex-row items-center gap-4 flex-1 min-w-0'}>
            <div className={'rounded-full flex-shrink-0'}>
              <TokenLogo
                src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${chainId}/${tokenAddress.toLowerCase()}/logo-32.png`}
                tokenSymbol={name}
                tokenName={name}
                width={24}
                height={24}
                className="rounded-full"
              />
            </div>
            <strong title={name} className={'block truncate font-bold'}>
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
          <div className={'flex flex-col md:col-span-5 md:text-right'}>
            <p className={'text-xs text-text-primary/60 mb-1'}>{'Allocation %'}</p>
            <p className={'font-medium'}>{formatPercent((details?.debtRatio || 0) / 100, 0)}</p>
          </div>
          <div className={'flex flex-col md:col-span-5 md:text-right'}>
            <p className={'text-xs text-text-primary/60 mb-1'}>{'Amount'}</p>
            <p className={'font-medium truncate'} title={allocation}>
              {allocation}
            </p>
          </div>
          <div className={'flex flex-col md:col-span-5 md:text-right'}>
            <p className={'text-xs text-text-primary/60 mb-1'}>{'APY'}</p>
            <p className={'font-medium'}>
              <RenderAmount shouldHideTooltip value={finalApr} symbol={'percent'} decimals={6} />
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
        <div className={'px-4 pb-4 md:px-8 md:pb-6'}>
          <div className={'h-px w-full bg-surface-secondary mb-4'} />
          <div className={'grid grid-cols-1 gap-6 md:grid-cols-2'}>
            {/* First column */}
            <div className={'flex flex-col gap-1'}>
              <div className={'flex flex-row gap-2'}>
                <span className={''}>{'Management Fee:'}</span>
                <span>{formatPercent((fees?.management || 0) * 100, 0)}</span>
              </div>
              <div className={'flex flex-row gap-2'}>
                <span className={''}>{'Performance Fee:'}</span>
                <span>{formatPercent((details?.performanceFee || 0) / 100, 0)}</span>
              </div>
              <div className={'flex flex-row gap-2'}>
                <span className={''}>{'Last Report:'}</span>
                {lastReportTime}
              </div>
              <div className={'flex flex-row gap-2'}>
                <span className={''}>{'Address:'}</span>
                <div className={'flex items-center gap-2'}>
                  <span className={'font-mono text-sm'} title={address}>
                    {truncateHex(address, 6)}
                  </span>
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
                <div className={'flex flex-row gap-2'}>
                  <Link
                    href={`/vaults-beta/${chainId}/${toAddress(address)}`}
                    className={cl('flex gap-1 items-center text-text-primary hover:text-text-secondary')}
                    target={'_blank'}
                    rel={'noopener noreferrer'}
                  >
                    {'View Vault Page'}
                    <IconLinkOut className={'inline-block size-4'} />
                  </Link>
                </div>
              ) : null}
              <div className={'flex flex-row gap-2'}>
                <Link
                  href={`${getNetwork(chainId)?.defaultBlockExplorer}/address/${address}`}
                  onClick={(event: React.MouseEvent): void => event.stopPropagation()}
                  className={cl('flex gap-1 items-center text-text-primary hover:text-text-secondary')}
                  target={'_blank'}
                  rel={'noopener noreferrer'}
                >
                  {'View on Block Explorer'}
                  <IconLinkOut className={'inline-block size-4'} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
