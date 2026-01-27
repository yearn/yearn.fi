import { cl } from '@shared/utils'
import type { ReactElement } from 'react'

type TVaultsListRowSkeletonProps = {
  className?: string
}

export function VaultsListRowSkeleton({ className }: TVaultsListRowSkeletonProps): ReactElement {
  return (
    <div className={cl('w-full bg-surface h-[81px] flex items-center', className)} aria-hidden={true}>
      <div className={'flex w-full items-center gap-4 px-4'}>
        <div className={'size-8 rounded-full bg-border/70 animate-pulse'} />
        <div className={'flex-1 space-y-2'}>
          <div className={'h-4 w-1/3 rounded bg-border/70 animate-pulse'} />
          <div className={'h-3 w-1/4 rounded bg-border/50 animate-pulse'} />
        </div>
        <div className={'hidden md:flex flex-1 justify-end gap-6'}>
          <div className={'h-4 w-16 rounded bg-border/70 animate-pulse'} />
          <div className={'h-4 w-16 rounded bg-border/70 animate-pulse'} />
          <div className={'h-4 w-16 rounded bg-border/70 animate-pulse'} />
        </div>
      </div>
    </div>
  )
}
