import { Breadcrumbs } from '@shared/components/Breadcrumbs'
import { cl } from '@shared/utils'
import type { ReactElement } from 'react'

const chartGridRows = ['chart-grid-1', 'chart-grid-2', 'chart-grid-3', 'chart-grid-4']
const chartSeries = ['chart-series-1', 'chart-series-2', 'chart-series-3']
const sectionRows = ['section-row-1', 'section-row-2', 'section-row-3']
const mobileMetricRows = ['mobile-metric-1', 'mobile-metric-2', 'mobile-metric-3']

function SkeletonBlock({ className }: { className: string }): ReactElement {
  return <div aria-hidden={true} className={cl('animate-pulse rounded-md bg-surface-secondary', className)} />
}

function SkeletonPill({ className }: { className: string }): ReactElement {
  return <SkeletonBlock className={cl('rounded-lg', className)} />
}

function DesktopIdentitySkeleton(): ReactElement {
  return (
    <div className={'flex flex-col gap-1 px-1 pt-4 md:col-span-20 md:row-start-2'}>
      <div className={'flex items-center gap-4'}>
        <div className={'relative flex size-10 shrink-0 items-center justify-center rounded-full bg-surface/70'}>
          <SkeletonBlock className={'size-10 rounded-full'} />
          <SkeletonBlock className={'absolute -bottom-1 -left-1 size-4 rounded-full border border-border'} />
        </div>
        <div className={'min-w-0'}>
          <div className={'flex items-center gap-3'}>
            <SkeletonBlock className={'h-9 w-[280px] max-w-[38vw]'} />
            <SkeletonBlock className={'size-4 rounded-sm'} />
          </div>
          <div className={'mt-2 flex flex-wrap items-center gap-1'}>
            <SkeletonPill className={'h-6 w-20'} />
            <SkeletonPill className={'h-6 w-24'} />
            <SkeletonPill className={'h-6 w-28'} />
            <SkeletonPill className={'h-6 w-16'} />
          </div>
        </div>
      </div>
    </div>
  )
}

function OverviewMetricSkeleton({ wide = false }: { wide?: boolean }): ReactElement {
  return (
    <div className={'border-border bg-surface px-5 py-4'}>
      <SkeletonBlock className={cl('h-3', wide ? 'w-28' : 'w-20')} />
      <SkeletonBlock className={cl('mt-3 h-7', wide ? 'w-36' : 'w-24')} />
      <SkeletonBlock className={'mt-2 h-3 w-16'} />
    </div>
  )
}

function DesktopOverviewSkeleton(): ReactElement {
  return (
    <div className={'md:col-span-13 md:row-start-3 pt-4'}>
      <div className={'overflow-hidden rounded-lg border border-border bg-surface'}>
        <div className={'grid grid-cols-4 gap-px bg-border'}>
          <OverviewMetricSkeleton wide />
          <OverviewMetricSkeleton />
          <OverviewMetricSkeleton />
          <OverviewMetricSkeleton />
        </div>
      </div>
      <SectionTabsSkeleton className={'rounded-t-none border-t-0'} />
    </div>
  )
}

function DesktopHoldingsSkeleton(): ReactElement {
  return (
    <div className={'flex flex-col pt-4 md:col-span-7 md:col-start-14 md:row-start-3'}>
      <div className={'overflow-hidden rounded-t-lg border border-border bg-surface'}>
        <div className={'grid grid-cols-2 gap-px bg-border'}>
          <OverviewMetricSkeleton wide />
          <OverviewMetricSkeleton />
        </div>
      </div>
      <div className={'-mt-px grid grid-cols-3 overflow-hidden rounded-b-lg border border-border bg-surface'}>
        <SkeletonBlock className={'m-1 h-9 rounded-sm'} />
        <SkeletonBlock className={'m-1 h-9 rounded-sm'} />
        <SkeletonBlock className={'m-1 h-9 rounded-sm'} />
      </div>
    </div>
  )
}

function SectionTabsSkeleton({ className }: { className?: string }): ReactElement {
  return (
    <div className={cl('grid grid-cols-5 overflow-hidden rounded-lg border border-border bg-surface', className)}>
      {['charts', 'about', 'strategies', 'risk', 'info'].map((tabKey, index) => (
        <div key={tabKey} className={cl('px-4 py-3', index > 0 ? 'border-l border-border' : '')}>
          <SkeletonBlock className={'mx-auto h-4 w-16'} />
        </div>
      ))}
    </div>
  )
}

function MobileSectionTabsSkeleton(): ReactElement {
  return (
    <div className={'grid grid-cols-4 gap-2'}>
      {['info', 'strategies', 'risk', 'more'].map((tabKey, index) => (
        <SkeletonBlock key={tabKey} className={cl('h-9 rounded-lg', index === 1 ? 'w-full' : '')} />
      ))}
    </div>
  )
}

function ChartPanelSkeleton(): ReactElement {
  return (
    <div className={'overflow-hidden rounded-lg border border-border bg-surface'}>
      <div className={'flex flex-col gap-2 px-3 pt-4 md:flex-row md:items-start md:justify-between md:px-4'}>
        <div className={'flex min-w-0 flex-1 rounded-lg border border-border bg-surface-secondary p-1'}>
          <SkeletonBlock className={'h-8 flex-1 rounded-sm'} />
          <SkeletonBlock className={'ml-1 h-8 flex-1 rounded-sm'} />
          <SkeletonBlock className={'ml-1 h-8 flex-1 rounded-sm'} />
        </div>
        <SkeletonBlock className={'hidden h-8 w-[92px] md:block'} />
      </div>
      <div className={'px-4 py-5'}>
        <div className={'relative h-[180px] md:h-[230px]'}>
          <div className={'absolute inset-0 flex flex-col justify-between'}>
            {chartGridRows.map((rowKey) => (
              <SkeletonBlock key={rowKey} className={'h-px w-full rounded-none'} />
            ))}
          </div>
          <div className={'absolute inset-x-0 bottom-2 space-y-5'}>
            {chartSeries.map((seriesKey, index) => (
              <SkeletonBlock
                key={seriesKey}
                className={cl(
                  'h-2 rounded-full',
                  index === 0 ? 'w-[88%]' : index === 1 ? 'ml-[8%] w-[78%]' : 'ml-[16%] w-[68%]'
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function CollapsibleSectionSkeleton({
  titleWidth,
  rows = 3,
  isOpen = true
}: {
  titleWidth: string
  rows?: number
  isOpen?: boolean
}): ReactElement {
  return (
    <div className={'overflow-hidden rounded-lg border border-border bg-surface'}>
      <div className={'flex items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4'}>
        <SkeletonBlock className={cl('h-5', titleWidth)} />
        <SkeletonBlock className={'size-4 rounded-sm'} />
      </div>
      {isOpen ? (
        <div className={'border-t border-border px-4 py-4 md:px-6'}>
          <div className={'space-y-3'}>
            {sectionRows.slice(0, rows).map((rowKey, index) => (
              <SkeletonBlock
                key={rowKey}
                className={cl('h-4', index === 0 ? 'w-full' : index === 1 ? 'w-11/12' : 'w-4/5')}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function DesktopWidgetSkeleton(): ReactElement {
  return (
    <aside
      className={'flex flex-col overflow-hidden rounded-lg border border-border bg-surface md:sticky'}
      style={{ top: 'var(--vault-header-height, var(--header-height))' }}
    >
      <div className={'flex items-center justify-between border-b border-border px-6 py-4'}>
        <SkeletonBlock className={'h-6 w-24'} />
        <SkeletonBlock className={'size-5 rounded-sm'} />
      </div>
      <div className={'space-y-4 p-6'}>
        <div className={'rounded-lg border border-border bg-surface-secondary p-4'}>
          <SkeletonBlock className={'h-3 w-20'} />
          <SkeletonBlock className={'mt-3 h-8 w-32'} />
          <SkeletonBlock className={'mt-4 h-3 w-28'} />
        </div>
        <div className={'rounded-lg border border-border p-4'}>
          <div className={'flex items-center justify-between'}>
            <SkeletonBlock className={'h-4 w-20'} />
            <SkeletonPill className={'h-7 w-16'} />
          </div>
          <SkeletonBlock className={'mt-4 h-11 w-full'} />
        </div>
        <div className={'space-y-2'}>
          <SkeletonBlock className={'h-4 w-full'} />
          <SkeletonBlock className={'h-4 w-10/12'} />
          <SkeletonBlock className={'h-4 w-8/12'} />
        </div>
      </div>
      <div className={'mt-auto border-t border-border p-4'}>
        <SkeletonBlock className={'h-12 w-full'} />
      </div>
    </aside>
  )
}

function MobileHeaderSkeleton(): ReactElement {
  return (
    <div className={'md:hidden md:mt-4 mb-4'}>
      <Breadcrumbs
        className={'mb-3'}
        items={[
          { label: 'Home', href: '/' },
          { label: 'Vaults', href: '/vaults' },
          { label: 'Loading vault', isCurrent: true }
        ]}
      />
      <div className={'flex items-center gap-3'}>
        <div className={'relative flex size-10 shrink-0 items-center justify-center rounded-full bg-surface/70'}>
          <SkeletonBlock className={'size-10 rounded-full'} />
          <SkeletonBlock className={'absolute -bottom-1 -left-1 size-4 rounded-full border border-border'} />
        </div>
        <div className={'min-w-0 flex-1'}>
          <SkeletonBlock className={'h-6 w-48 max-w-full'} />
          <div className={'mt-2 flex items-center gap-1'}>
            <SkeletonPill className={'h-6 w-20'} />
            <SkeletonPill className={'h-6 w-24'} />
          </div>
        </div>
      </div>
    </div>
  )
}

function MobileMetricsSkeleton(): ReactElement {
  return (
    <div className={'grid grid-cols-3 gap-2'}>
      {mobileMetricRows.map((rowKey, index) => (
        <div key={rowKey} className={'rounded-lg border border-border bg-surface px-3 py-3'}>
          <SkeletonBlock className={cl('h-3', index === 1 ? 'w-10' : 'w-16')} />
          <SkeletonBlock className={'mt-2 h-5 w-16'} />
        </div>
      ))}
    </div>
  )
}

function MobileFloatingActionsSkeleton(): ReactElement {
  return (
    <div
      className={
        'fixed right-0 bottom-0 left-0 z-50 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] backdrop-blur-md md:hidden'
      }
    >
      <div className={'mx-auto flex max-w-[1232px] gap-3'}>
        <SkeletonBlock className={'h-12 flex-1 rounded-lg'} />
        <SkeletonBlock className={'h-12 flex-1 rounded-lg'} />
      </div>
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
        <header className={'relative hidden flex-col items-center justify-center rounded-3xl md:flex'}>
          <div
            className={
              'grid w-full grid-cols-1 gap-y-0 gap-x-6 rounded-lg bg-app text-left md:auto-rows-min md:grid-cols-20'
            }
          >
            <Breadcrumbs
              className={'hidden px-1 md:col-span-20 md:flex'}
              items={[
                { label: 'Home', href: '/' },
                { label: 'Vaults', href: '/vaults' },
                { label: 'Loading vault', isCurrent: true }
              ]}
            />
            <DesktopIdentitySkeleton />
            <DesktopOverviewSkeleton />
            <DesktopHoldingsSkeleton />
          </div>
        </header>

        <MobileHeaderSkeleton />

        <div className={'space-y-4 md:hidden'}>
          <MobileMetricsSkeleton />
          <MobileSectionTabsSkeleton />
          <ChartPanelSkeleton />
          <section aria-label={'Vault details loading'} className={'space-y-4 pb-8'}>
            <CollapsibleSectionSkeleton titleWidth={'w-16'} rows={3} />
            <CollapsibleSectionSkeleton titleWidth={'w-24'} rows={2} />
            <CollapsibleSectionSkeleton titleWidth={'w-12'} rows={2} isOpen={false} />
            <CollapsibleSectionSkeleton titleWidth={'w-20'} rows={2} />
          </section>
        </div>

        <section className={'hidden grid-cols-1 gap-4 bg-app md:grid md:grid-cols-20 md:items-start md:gap-6'}>
          <div className={'order-2 hidden space-y-4 py-4 md:order-1 md:col-span-13 md:block'}>
            <ChartPanelSkeleton />
            <CollapsibleSectionSkeleton titleWidth={'w-16'} rows={3} />
            <CollapsibleSectionSkeleton titleWidth={'w-24'} rows={2} />
            <CollapsibleSectionSkeleton titleWidth={'w-12'} rows={2} />
            <CollapsibleSectionSkeleton titleWidth={'w-20'} rows={2} />
            <div aria-hidden={true} className={'h-[35vh]'} />
          </div>
          <div className={'order-1 hidden pt-4 md:order-2 md:col-span-7 md:col-start-14 md:block'}>
            <DesktopWidgetSkeleton />
          </div>
        </section>
      </div>

      <MobileFloatingActionsSkeleton />
    </main>
  )
}
