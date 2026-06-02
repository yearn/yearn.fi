import { VaultsListRowSkeleton } from '@pages/vaults/components/list/VaultsListRowSkeleton'
import type { ReactElement } from 'react'

const SKELETON_ROWS = Array.from({ length: 8 }, (_, index) => index)

export default function Loading(): ReactElement {
  return (
    <main className={'min-h-[calc(100vh-var(--header-height))] w-full bg-app'}>
      <div className={'mx-auto flex w-full max-w-[1232px] flex-col gap-4 px-4 py-4 md:gap-6 md:py-6'}>
        <div className={'flex items-center gap-2 text-sm text-text-secondary'}>
          <div className={'h-4 w-12 animate-pulse rounded bg-border/60'} />
          <span>{'>'}</span>
          <div className={'h-4 w-16 animate-pulse rounded bg-border/70'} />
        </div>

        <div className={'flex flex-col gap-4 md:flex-row md:items-end md:justify-between'}>
          <div className={'space-y-3'}>
            <div className={'h-8 w-44 animate-pulse rounded bg-border/70'} />
            <div className={'h-4 w-72 max-w-full animate-pulse rounded bg-border/50'} />
          </div>
          <div className={'flex gap-2'}>
            <div className={'h-10 w-28 animate-pulse rounded bg-border/60'} />
            <div className={'h-10 w-28 animate-pulse rounded bg-border/60'} />
          </div>
        </div>

        <div className={'h-12 w-full animate-pulse rounded-lg border border-border bg-surface'} />

        <div className={'overflow-hidden rounded-lg border border-border'}>
          {SKELETON_ROWS.map((rowIndex) => (
            <VaultsListRowSkeleton
              key={`vaults-loading-row-${rowIndex}`}
              className={rowIndex === SKELETON_ROWS.length - 1 ? undefined : 'border-b border-border'}
            />
          ))}
        </div>
      </div>
    </main>
  )
}
