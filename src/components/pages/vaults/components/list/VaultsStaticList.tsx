import { cl, formatApyDisplay, formatTvlDisplay } from '@shared/utils'
import Link from 'next/link'
import type { ReactElement } from 'react'
import type { TPublicVaultListItem } from '@/server/ssr/publicVaultListViewModel'

type TVaultsStaticListProps = {
  vaults: TPublicVaultListItem[]
  className?: string
}

function VaultsStaticRow({ vault, isLast }: { vault: TPublicVaultListItem; isLast: boolean }): ReactElement {
  return (
    <Link
      href={vault.href}
      className={cl(
        'grid w-full grid-cols-1 bg-surface p-4 pb-4 transition-colors hover:bg-surface-secondary md:grid-cols-24 md:p-6 md:pt-4 md:pb-4',
        !isLast ? 'md:border-b md:border-border' : undefined
      )}
    >
      <div className={'col-span-12 z-10 flex flex-col items-start md:flex-row md:items-center md:justify-between'}>
        <div className={'flex w-full gap-6 border-b border-border pb-2 md:border-none md:pb-0'}>
          <div
            className={
              'flex size-10 min-h-10 min-w-10 items-center justify-center self-center rounded-full border border-border bg-surface-secondary text-sm font-semibold text-text-primary'
            }
            aria-hidden={true}
          >
            {vault.tokenSymbol.slice(0, 3)}
          </div>
          <div className={'min-w-0 flex-1'}>
            <strong
              title={vault.name}
              className={'block truncate-safe whitespace-nowrap text-lg font-black leading-tight text-text-primary'}
            >
              {vault.name}
            </strong>
            <div className={'mt-1 flex items-center gap-2 whitespace-nowrap text-xs text-text-primary/70'}>
              <span className={'hidden rounded-lg border border-border px-2 py-1 md:inline-flex'}>
                {vault.chainName}
              </span>
              {vault.category ? (
                <span className={'rounded-lg border border-border px-2 py-1'}>{vault.category}</span>
              ) : null}
              <span className={'rounded-lg border border-border px-2 py-1'}>{vault.productLabel}</span>
            </div>
          </div>
        </div>
        <div className={'mt-2 grid w-full grid-cols-2 gap-2 text-sm text-text-secondary md:hidden'}>
          <div className={'flex items-center justify-center gap-2 whitespace-nowrap'}>
            <span className={'text-text-primary/60'}>{'Est. APY:'}</span>
            <b className={'text-lg font-semibold text-text-primary'}>{formatApyDisplay(vault.estimatedApy)}</b>
          </div>
          <div className={'flex items-center justify-center gap-2 whitespace-nowrap'}>
            <span className={'text-text-primary/60'}>{'TVL:'}</span>
            <b className={'text-lg font-semibold text-text-primary'}>{formatTvlDisplay(vault.tvl)}</b>
          </div>
        </div>
      </div>
      <div className={'z-10 mt-4 hidden gap-4 md:mt-0 md:grid md:items-center md:grid-cols-12 col-span-12'}>
        <div className={'yearn--table-data-section-item col-span-6'} datatype={'number'}>
          <p className={'yearn--table-data-section-item-value'}>{formatApyDisplay(vault.estimatedApy)}</p>
        </div>
        <div className={'yearn--table-data-section-item col-span-5'} datatype={'number'}>
          <p className={'yearn--table-data-section-item-value'}>{formatTvlDisplay(vault.tvl)}</p>
        </div>
        <div className={'col-span-1'} />
      </div>
    </Link>
  )
}

export function VaultsStaticList({ vaults, className }: TVaultsStaticListProps): ReactElement | null {
  if (vaults.length === 0) {
    return null
  }

  return (
    <div className={cl('flex flex-col gap-px bg-surface', className)}>
      {vaults.map((vault, index) => (
        <VaultsStaticRow key={vault.key} vault={vault} isLast={index === vaults.length - 1} />
      ))}
    </div>
  )
}
