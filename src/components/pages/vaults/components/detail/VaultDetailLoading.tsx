import { Breadcrumbs } from '@shared/components/Breadcrumbs'
import { cl } from '@shared/utils'
import type { ReactElement } from 'react'

function SkeletonBlock({ className }: { className: string }): ReactElement {
  return <div aria-hidden={true} className={cl('animate-pulse rounded-lg bg-surface-secondary', className)} />
}

function DetailMetricSkeleton(): ReactElement {
  return (
    <div className={'rounded-2xl border border-border bg-surface p-4'}>
      <SkeletonBlock className={'h-3 w-20'} />
      <SkeletonBlock className={'mt-3 h-7 w-28'} />
    </div>
  )
}

export function VaultDetailLoading(): ReactElement {
  return (
    <main
      className={
        'min-h-[calc(100vh-var(--header-height))] w-full bg-app pb-[calc(7rem+env(safe-area-inset-bottom,0px))] sm:pb-8'
      }
    >
      <div className={'mx-auto w-full max-w-[1232px] px-4'}>
        <Breadcrumbs
          className={'mb-3'}
          items={[
            { label: 'Home', href: '/' },
            { label: 'Vaults', href: '/vaults' },
            { label: 'Loading vault', isCurrent: true }
          ]}
        />

        <div className={'hidden rounded-3xl border border-border bg-surface p-6 md:block'}>
          <div className={'flex items-start justify-between gap-8'}>
            <div className={'flex min-w-0 items-center gap-4'}>
              <SkeletonBlock className={'size-16 shrink-0 rounded-full'} />
              <div className={'min-w-0'}>
                <SkeletonBlock className={'h-8 w-64 max-w-[45vw]'} />
                <div className={'mt-3 flex gap-2'}>
                  <SkeletonBlock className={'h-7 w-24'} />
                  <SkeletonBlock className={'h-7 w-28'} />
                </div>
              </div>
            </div>
            <div className={'flex gap-2'}>
              <SkeletonBlock className={'h-10 w-24'} />
              <SkeletonBlock className={'h-10 w-28'} />
            </div>
          </div>
          <div className={'mt-8 grid grid-cols-4 gap-3'}>
            <DetailMetricSkeleton />
            <DetailMetricSkeleton />
            <DetailMetricSkeleton />
            <DetailMetricSkeleton />
          </div>
        </div>

        <div className={'md:hidden'}>
          <div className={'flex items-center gap-3'}>
            <SkeletonBlock className={'size-10 shrink-0 rounded-full'} />
            <div className={'min-w-0 flex-1'}>
              <SkeletonBlock className={'h-6 w-48 max-w-full'} />
              <div className={'mt-2 flex gap-2'}>
                <SkeletonBlock className={'h-6 w-20'} />
                <SkeletonBlock className={'h-6 w-24'} />
              </div>
            </div>
          </div>
          <div className={'mt-4 grid grid-cols-2 gap-3'}>
            <DetailMetricSkeleton />
            <DetailMetricSkeleton />
          </div>
        </div>

        <div className={'mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]'}>
          <div className={'space-y-4'}>
            <section className={'rounded-2xl border border-border bg-surface p-4 md:p-6'}>
              <SkeletonBlock className={'h-5 w-32'} />
              <SkeletonBlock className={'mt-5 h-4 w-full'} />
              <SkeletonBlock className={'mt-3 h-4 w-11/12'} />
              <SkeletonBlock className={'mt-3 h-4 w-4/5'} />
            </section>
            <section className={'rounded-2xl border border-border bg-surface p-4 md:p-6'}>
              <SkeletonBlock className={'h-5 w-40'} />
              <div className={'mt-5 space-y-3'}>
                <SkeletonBlock className={'h-12 w-full'} />
                <SkeletonBlock className={'h-12 w-full'} />
                <SkeletonBlock className={'h-12 w-full'} />
              </div>
            </section>
          </div>
          <aside className={'rounded-2xl border border-border bg-surface p-4 md:p-6'}>
            <SkeletonBlock className={'h-6 w-28'} />
            <SkeletonBlock className={'mt-6 h-11 w-full'} />
            <SkeletonBlock className={'mt-3 h-11 w-full'} />
            <SkeletonBlock className={'mt-6 h-12 w-full'} />
          </aside>
        </div>
      </div>
    </main>
  )
}
