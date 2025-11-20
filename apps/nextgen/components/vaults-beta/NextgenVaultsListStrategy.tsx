import { ImageWithFallback } from '@lib/components/ImageWithFallback'
import { RenderAmount } from '@lib/components/RenderAmount'
import { useFetch } from '@lib/hooks/useFetch'
import { useYDaemonBaseURI } from '@lib/hooks/useYDaemonBaseURI'
import { IconChevron } from '@lib/icons/IconChevron'
import { IconCopy } from '@lib/icons/IconCopy'
import { IconLinkOut } from '@lib/icons/IconLinkOut'
import type { TAddress } from '@lib/types'
import { cl, formatPercent, toAddress } from '@lib/utils'
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
    <div className={cl('w-full', 'rounded-lg', 'text-neutral-900', isUnallocated ? 'opacity-50' : '')}>
      {/* Collapsible header - always visible */}
      <div
        className={cl(
          'grid grid-cols-1 md:grid-cols-24 items-center w-full gap-4 py-3 px-4 md:px-8 cursor-pointer',
          'transition-colors duration-200 hover:bg-neutral-100/50'
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className={cl('col-span-9 flex flex-row items-center gap-4')}>
          <div className={'rounded-full'}>
            <ImageWithFallback
              src={`${
                import.meta.env.VITE_BASE_YEARN_ASSETS_URI
              }/tokens/${chainId}/${tokenAddress.toLowerCase()}/logo-32.png`}
              alt={''}
              width={24}
              height={24}
            />
          </div>
          <strong title={name} className={'block truncate font-bold '}>
            {name}
          </strong>
        </div>

        <div
          className={cl('md:col-span-14', 'grid grid-cols-1 sm:grid-cols-3 md:grid-cols-15 md:gap-4', 'mt-4 md:mt-0')}
        >
          <div
            className={'items-right flex flex-row justify-between sm:flex-col md:col-span-5 md:text-right'}
            datatype={'number'}
          >
            <p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'Allocation %'}</p>
            <p>{formatPercent((details?.debtRatio || 0) / 100, 0)}</p>
          </div>
          <div
            className={'items-right flex flex-row justify-between sm:flex-col md:col-span-5 md:text-right'}
            datatype={'number'}
          >
            <p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'Amount'}</p>
            <p>{allocation}</p>
          </div>
          <div
            className={'items-right flex flex-row justify-between sm:flex-col md:col-span-5 md:text-right'}
            datatype={'number'}
          >
            <p className={'inline text-start text-xs text-neutral-800/60 md:hidden'}>{'APY'}</p>
            <p>
              <RenderAmount shouldHideTooltip value={finalApr} symbol={'percent'} decimals={6} />
            </p>
          </div>
        </div>

        <div className={'col-span-1 flex justify-end items-center'}>
          <IconChevron
            className={cl('size-4 text-neutral-600 transition-transform duration-200')}
            direction={isExpanded ? 'up' : 'down'}
          />
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className={'px-4 pb-4 md:px-8 md:pb-6'}>
          <div className={'h-px w-full bg-neutral-200 mb-4'} />
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
              {variant === 'v3' && isVault ? (
                <div className={'flex flex-row gap-2'}>
                  <Link
                    href={`/vaults-beta/${chainId}/${toAddress(address)}`}
                    className={cl('flex gap-1 items-center text-neutral-800 hover:text-neutral-600')}
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
                  className={cl('flex gap-1 items-center text-neutral-800 hover:text-neutral-600')}
                  target={'_blank'}
                  rel={'noopener noreferrer'}
                >
                  {'View on Block Explorer'}
                  <IconLinkOut className={'inline-block size-4'} />
                </Link>
              </div>
              <div className={'flex flex-row gap-2'}>
                <span className={''}>{'Address:'}</span>
                <div className={'flex items-center gap-2'}>
                  <span className={'font-mono text-sm'}>{address}</span>
                  <button
                    type={'button'}
                    onClick={(e): void => {
                      e.stopPropagation()
                      copyToClipboard(address)
                    }}
                    className={'text-neutral-600 hover:text-neutral-900 transition-colors'}
                    aria-label={'Copy address'}
                  >
                    <IconCopy className={'size-4'} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
