import { cl } from '@shared/utils'
import type { ReactElement } from 'react'

type TVaultsListRowSkeletonProps = {
  className?: string
}

export function VaultsListRowSkeleton({ className }: TVaultsListRowSkeletonProps): ReactElement {
  const blockClassName = 'rounded bg-surface-tertiary/70 animate-pulse'
  const subtleBlockClassName = 'rounded bg-surface-tertiary/50 animate-pulse'

  return (
    <div className={cl('w-full bg-surface h-[81px] flex items-center', className)} aria-hidden={true}>
      <div className={'flex w-full items-center gap-4 px-4'}>
        <div className={'size-8 rounded-full bg-surface-tertiary/70 animate-pulse'} />
        <div className={'min-w-0 flex-1 space-y-2'}>
          <div className={cl('h-4 w-full max-w-[184px]', blockClassName)} />
          <div className={cl('h-3 w-full max-w-[136px]', subtleBlockClassName)} />
        </div>
        <div className={'hidden flex-1 grid-cols-12 items-center gap-4 md:grid'}>
          <div className={cl('col-span-6 h-4 w-16 justify-self-end', blockClassName)} />
          <div className={cl('col-span-5 h-4 w-16 justify-self-end', blockClassName)} />
          <div
            className={
              'col-span-1 flex size-9 justify-self-end rounded-full border border-border/80 bg-app/80 animate-pulse'
            }
          />
        </div>
      </div>
    </div>
  )
}
