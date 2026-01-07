import type { ReactElement } from 'react'

const skeletonRows = Array.from({ length: 6 }, (_, index) => index)

export function VaultsPageShell(): ReactElement {
  return (
    <div className={'min-h-[calc(100vh-var(--header-height))] w-full bg-app'}>
      <div className={'mx-auto w-full max-w-[1232px] px-4 pb-6'}>
        <div className={'mt-6 flex flex-col gap-4'}>
          <div className={'h-6 w-40 rounded-full bg-surface-secondary/80 animate-pulse'} />
          <div className={'flex flex-wrap gap-3'}>
            <div className={'h-10 w-full rounded-xl bg-surface-secondary/80 animate-pulse md:w-[360px]'} />
            <div className={'h-10 w-28 rounded-xl bg-surface-secondary/80 animate-pulse'} />
            <div className={'h-10 w-28 rounded-xl bg-surface-secondary/80 animate-pulse'} />
            <div className={'h-10 w-28 rounded-xl bg-surface-secondary/80 animate-pulse'} />
          </div>
        </div>
        <div className={'mt-6 overflow-hidden rounded-xl border border-border'}>
          <div className={'border-b border-border bg-surface-secondary/40 px-4 py-3'}>
            <div className={'h-4 w-52 rounded-full bg-surface-secondary/80 animate-pulse'} />
          </div>
          <div className={'flex flex-col gap-3 bg-surface px-4 py-4'}>
            {skeletonRows.map((row) => (
              <div
                key={`vaults-row-skeleton-${row}`}
                className={'h-20 w-full rounded-xl bg-surface-secondary/60 animate-pulse'}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
