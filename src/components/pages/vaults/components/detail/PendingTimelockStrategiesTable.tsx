import type { TPendingTimelockStrategy } from '@pages/vaults/types/timelockStrategies'
import {
  formatTimelockEta,
  formatTimelockMaxDebt,
  getTimelockBadgeLabel
} from '@pages/vaults/utils/timelockStrategyDisplay'
import { TokenLogo } from '@shared/components/TokenLogo'
import { IconChevron } from '@shared/icons/IconChevron'
import { IconCopy } from '@shared/icons/IconCopy'
import { IconLinkOut } from '@shared/icons/IconLinkOut'
import type { TAddress } from '@shared/types'
import { cl, truncateHex } from '@shared/utils'
import { copyToClipboard } from '@shared/utils/helpers'
import { getNetwork } from '@shared/utils/wagmi/utils'
import Link from 'next/link'
import type { ReactElement } from 'react'
import { useState } from 'react'
import { env } from '@/env'
import { STRATEGY_PANEL_ROW_DESKTOP_LAYOUT } from './strategiesLayout'

const isValidHexValue = (value: string | undefined): value is `0x${string}` =>
  Boolean(value && /^0x[a-fA-F0-9]+$/.test(value) && !/^0x0+$/.test(value))

const truncateHash = (hash: `0x${string}`, size: number): string => {
  if (hash.length <= size * 2 + 4) {
    return hash
  }

  return `0x${hash.slice(2, size + 2)}...${hash.slice(-size)}`
}

function TimelockHashLink({
  blockExplorer,
  hash,
  kind,
  label
}: {
  blockExplorer: string | undefined
  hash: `0x${string}` | undefined
  kind: 'tx'
  label?: string
}): ReactElement {
  if (!isValidHexValue(hash) || !blockExplorer) {
    return <span className={'text-text-secondary'}>{'Unavailable'}</span>
  }

  return (
    <Link
      href={`${blockExplorer}/${kind}/${hash}`}
      className={'flex items-center gap-1 text-text-secondary hover:text-text-primary'}
      target={'_blank'}
      rel={'noopener noreferrer'}
    >
      {label ?? truncateHash(hash, 6)}
      <IconLinkOut className={'inline-block size-4'} />
    </Link>
  )
}

function TimelockHashValue({ hash }: { hash: `0x${string}` | undefined }): ReactElement {
  if (!isValidHexValue(hash)) {
    return <span className={'text-text-secondary'}>{'Unavailable'}</span>
  }

  return (
    <div className={'flex items-center gap-2'}>
      <span title={hash}>{truncateHash(hash, 6)}</span>
      <button
        type={'button'}
        onClick={(event): void => {
          event.stopPropagation()
          copyToClipboard(hash)
        }}
        className={'text-text-secondary transition-colors hover:text-text-primary'}
        aria-label={'Copy operation id'}
      >
        <IconCopy className={'size-4'} />
      </button>
    </div>
  )
}

function PendingTimelockStrategyRow({
  blockExplorer,
  chainId,
  defaultExpanded,
  item,
  tokenAddress,
  tokenDecimals,
  tokenSymbol
}: {
  blockExplorer: string | undefined
  chainId: number
  defaultExpanded: boolean
  item: TPendingTimelockStrategy
  tokenAddress: TAddress
  tokenDecimals: number
  tokenSymbol: string
}): ReactElement {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const strategyName = item.strategyName ?? `Strategy ${truncateHex(item.strategyAddress, 6)}`
  const maxDebt = formatTimelockMaxDebt(item.maxDebtRaw, tokenDecimals, tokenSymbol)

  return (
    <div className={'w-full rounded-lg text-text-primary'}>
      <button
        type={'button'}
        className={
          'grid w-full cursor-pointer grid-cols-1 items-start gap-3 rounded-lg px-4 py-3 text-left transition-colors duration-200 hover:bg-surface-secondary/50 md:grid-cols-24 md:items-center md:px-8'
        }
        onClick={(): void => setIsExpanded((current) => !current)}
      >
        <div className={'flex min-w-0 items-center gap-2 md:col-span-11'}>
          <div className={'flex size-6 shrink-0 items-center justify-center'}>
            <div className={'size-2 rounded-full bg-amber-500'} />
          </div>
          <TokenLogo
            src={`${env.NEXT_PUBLIC_BASE_YEARN_ASSETS_URI}/tokens/${chainId}/${tokenAddress.toLowerCase()}/logo-32.png`}
            tokenSymbol={item.strategySymbol ?? tokenSymbol}
            tokenName={strategyName}
            width={28}
            height={28}
            className={'rounded-full'}
          />
          <div className={'min-w-0 flex-1'}>
            <strong
              className={cl(
                'block min-w-0 truncate font-bold',
                STRATEGY_PANEL_ROW_DESKTOP_LAYOUT.nameLabelDesktopWrapClass
              )}
              title={strategyName}
            >
              {strategyName}
            </strong>
          </div>
        </div>
        <div className={'flex flex-col items-start md:col-span-6 md:items-end'}>
          <p className={'mb-1 text-xs text-text-primary/60 md:hidden'}>{'Status'}</p>
          <span
            className={
              'inline-flex w-fit items-center rounded-sm border border-amber-600 bg-amber-600 px-1.5 py-0.5 text-xs font-semibold text-white dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300'
            }
          >
            {getTimelockBadgeLabel(item.status)}
          </span>
          <span className={'mt-1 text-xs text-text-secondary'}>{formatTimelockEta(item.eta)}</span>
        </div>
        <div className={'flex flex-col items-start md:col-span-6 md:items-end'}>
          <p className={'mb-1 text-xs text-text-primary/60 md:hidden'}>{'Max debt'}</p>
          <p className={'font-semibold'}>{maxDebt}</p>
        </div>
        <div className={'hidden items-center justify-end md:col-span-1 md:flex'}>
          <IconChevron
            className={cl('size-4 text-text-secondary transition-transform duration-200')}
            direction={isExpanded ? 'up' : 'down'}
          />
        </div>
      </button>

      {isExpanded ? (
        <div className={'px-4 pb-4 md:px-12 md:pb-6'}>
          <div className={'flex flex-col gap-1 border-l-2 border-amber-500/50 pl-3 pt-2 text-sm'}>
            <p className={'mb-2 text-text-primary'}>
              {
                'This strategy is scheduled to be added to the vault but is still in the timelock. It is not currently allocated to by this vault.'
              }
            </p>
            <div className={'flex flex-col items-start gap-1 md:flex-row md:items-center md:gap-3'}>
              <span className={'w-full text-text-secondary md:w-36'}>{'Timelock:'}</span>
              <Link
                href={`${blockExplorer}/address/${item.timelockAddress}`}
                className={'flex items-center gap-1 text-text-secondary hover:text-text-primary'}
                target={'_blank'}
                rel={'noopener noreferrer'}
              >
                {'Yearn strategy timelock'}
                <IconLinkOut className={'inline-block size-4'} />
              </Link>
            </div>
            <div className={'flex flex-col items-start gap-1 md:flex-row md:items-center md:gap-3'}>
              <span className={'w-full text-text-secondary md:w-36'}>{'Strategy address:'}</span>
              <div className={'flex items-center gap-2'}>
                <span title={item.strategyAddress}>{truncateHex(item.strategyAddress, 6)}</span>
                <button
                  type={'button'}
                  onClick={(event): void => {
                    event.stopPropagation()
                    copyToClipboard(item.strategyAddress)
                  }}
                  className={'text-text-secondary transition-colors hover:text-text-primary'}
                  aria-label={'Copy strategy address'}
                >
                  <IconCopy className={'size-4'} />
                </button>
              </div>
            </div>
            <div className={'flex flex-col items-start gap-1 md:flex-row md:items-center md:gap-3'}>
              <span className={'w-full text-text-secondary md:w-36'}>{'Status:'}</span>
              <span>{item.status === 'ready' ? 'Ready' : 'Queued'}</span>
            </div>
            <div className={'flex flex-col items-start gap-1 md:flex-row md:items-center md:gap-3'}>
              <span className={'w-full text-text-secondary md:w-36'}>{'Ready after:'}</span>
              <span>{formatTimelockEta(item.eta)}</span>
            </div>
            <div className={'flex flex-col items-start gap-1 md:flex-row md:items-center md:gap-3'}>
              <span className={'w-full text-text-secondary md:w-36'}>{'Queued:'}</span>
              <span>{formatTimelockEta(item.queuedAt)}</span>
            </div>
            <div className={'flex flex-col items-start gap-1 md:flex-row md:items-center md:gap-3'}>
              <span className={'w-full text-text-secondary md:w-36'}>{'Schedule tx:'}</span>
              <TimelockHashLink blockExplorer={blockExplorer} hash={item.scheduleTxHash} kind={'tx'} />
            </div>
            <div className={'flex flex-col items-start gap-1 md:flex-row md:items-center md:gap-3'}>
              <span className={'w-full text-text-secondary md:w-36'}>{'Operation id:'}</span>
              <TimelockHashValue hash={item.operationId} />
            </div>
            <div className={'flex flex-col items-start gap-1 md:flex-row md:items-center md:gap-3'}>
              <span className={'w-full text-text-secondary md:w-36'}>{'Executor:'}</span>
              <span>{item.executorLabel}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function PendingTimelockStrategiesTable({
  chainId,
  items,
  tokenAddress,
  tokenDecimals,
  tokenSymbol,
  defaultExpandedOperationId
}: {
  chainId: number
  items: TPendingTimelockStrategy[]
  tokenAddress: TAddress
  tokenDecimals: number
  tokenSymbol: string
  defaultExpandedOperationId?: `0x${string}`
}): ReactElement | null {
  const blockExplorer = getNetwork(chainId)?.defaultBlockExplorer

  if (items.length === 0) {
    return null
  }

  return (
    <div className={'mt-6 pt-4'}>
      <div className={'mb-1 px-4 md:px-8'}>
        <h3 className={'text-sm font-semibold text-text-primary'}>{'Pending Strategies'}</h3>
      </div>
      <div className={'space-y-px'}>
        <div
          className={
            'mt-4 hidden w-full grid-cols-1 border-t border-border px-4 py-2 md:mt-0 md:grid md:grid-cols-24 md:border-none md:px-8'
          }
        >
          <div className={'col-span-11 mb-2 flex flex-row items-center justify-start! py-4 md:mb-0 md:py-0'}>
            <div className={'yearn--table-head-label-wrapper group w-full justify-start!'}>
              <p className={'yearn--table-head-label text-left text-text-primary/60 transition-colors'}>{'Strategy'}</p>
            </div>
          </div>
          <div className={'z-10 col-span-12 mt-4 grid grid-cols-1 md:mt-0 md:grid-cols-12 md:gap-2'}>
            <div className={'md:col-span-6'}>
              <div className={'yearn--table-head-label-wrapper group w-full justify-end'}>
                <p className={'yearn--table-head-label text-right text-text-primary/60 transition-colors'}>
                  {'Status'}
                </p>
              </div>
            </div>
            <div className={'md:col-span-6'}>
              <div className={'yearn--table-head-label-wrapper group w-full justify-end'}>
                <p className={'yearn--table-head-label text-right text-text-primary/60 transition-colors'}>
                  {'Max debt'}
                </p>
              </div>
            </div>
          </div>
          <div className={'col-span-1'} />
        </div>
        {items.map((item) => (
          <PendingTimelockStrategyRow
            key={`${item.operationId}:${item.strategyAddress}`}
            blockExplorer={blockExplorer}
            chainId={chainId}
            defaultExpanded={item.operationId === defaultExpandedOperationId}
            item={item}
            tokenAddress={tokenAddress}
            tokenDecimals={tokenDecimals}
            tokenSymbol={tokenSymbol}
          />
        ))}
      </div>
    </div>
  )
}
