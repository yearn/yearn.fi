'use client'

import { cl } from '@shared/utils/cl'
import {
  formatSiteStatusDate,
  getOverallSiteHealthState,
  getOverallSiteHealthSummary,
  getSiteHealthStateClassName
} from '@shared/utils/siteStatus'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import type { ReactElement } from 'react'
import { useId } from 'react'
import type { TSiteHealth, TSiteHealthState } from '@/types/siteStatus'

type TServiceLabelProps = {
  label: string
  state?: TSiteHealthState
  status?: string
  title: string
}

async function fetchSiteHealth(): Promise<TSiteHealth> {
  const response = await fetch('/api/status', { headers: { Accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`Site status request failed (${response.status})`)
  }
  return (await response.json()) as TSiteHealth
}

function useSiteHealth() {
  return useQuery({
    queryKey: ['site-status'],
    queryFn: fetchSiteHealth,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1
  })
}

function ServiceLabel({ label, state, status, title }: TServiceLabelProps): ReactElement {
  return (
    <span className={'inline-flex items-center gap-1.5 whitespace-nowrap'} title={title}>
      <span className={cl('size-1.5 rounded-full', getSiteHealthStateClassName(state))} aria-hidden={'true'} />
      <span>{label}</span>
      {status ? <span className={'text-text-primary'}>{status}</span> : null}
    </span>
  )
}

export function HeaderSiteStatus(): ReactElement {
  const statusQuery = useSiteHealth()
  const detailsID = useId()
  const health = statusQuery.isError ? undefined : statusQuery.data
  const overallState = getOverallSiteHealthState(health)
  const overallStatus = statusQuery.isError ? 'unknown' : overallState || 'checking'
  const summary = statusQuery.isError ? 'Status unavailable' : getOverallSiteHealthSummary(overallState)

  return (
    <div
      data-header-site-status
      className={'group/site-status relative flex size-6 shrink-0 items-center justify-center'}
    >
      <Link
        href={'/status'}
        prefetch={false}
        aria-label={`Site status: ${overallStatus}`}
        aria-describedby={detailsID}
        title={'View full system status'}
        className={
          'relative z-10 flex size-6 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'
        }
      >
        <span
          className={cl(
            'size-2 rounded-full transition-transform duration-200 group-hover/site-status:scale-125 group-focus-within/site-status:scale-125 motion-reduce:transition-none',
            getSiteHealthStateClassName(overallState)
          )}
          aria-hidden={'true'}
        />
      </Link>
      <aside
        id={detailsID}
        data-header-site-status-panel
        aria-label={'Site status details'}
        aria-busy={statusQuery.isPending}
        className={
          'pointer-events-none absolute top-1/2 right-1/2 z-0 w-[calc(100vw-22rem)] -translate-y-1/2 overflow-hidden lg:w-[32rem]'
        }
      >
        <div
          className={
            'flex h-8 translate-x-full items-center justify-end gap-2 whitespace-nowrap bg-app/95 pr-5 pl-3 text-sm text-text-secondary opacity-0 backdrop-blur-md transition-[translate,opacity] duration-300 ease-out group-hover/site-status:translate-x-0 group-hover/site-status:opacity-100 group-focus-within/site-status:translate-x-0 group-focus-within/site-status:opacity-100 motion-reduce:transition-none'
          }
        >
          <span className={'font-medium text-text-primary'}>{summary}</span>
        </div>
      </aside>
    </div>
  )
}

export function MobileSiteStatus(): ReactElement {
  const statusQuery = useSiteHealth()
  const health = statusQuery.isError ? undefined : statusQuery.data
  const overallState = getOverallSiteHealthState(health)
  const summary = statusQuery.isError ? 'Status unavailable' : getOverallSiteHealthSummary(overallState)

  return (
    <aside
      aria-label={'Site status'}
      aria-busy={statusQuery.isPending}
      className={'font-aeonik-mono text-[10px] uppercase tracking-[0.08em] text-text-secondary'}
    >
      <div className={'flex flex-col items-center gap-1 whitespace-nowrap text-center'}>
        <time className={'whitespace-nowrap'} dateTime={health?.checkedAt} title={health?.checkedAt}>
          {health ? `Checked ${formatSiteStatusDate(health.checkedAt)}` : 'Checking status'}
        </time>
        <ServiceLabel label={summary} state={overallState} title={summary} />
        <Link href={'/status'} prefetch={false} className={'text-text-primary underline underline-offset-2'}>
          {'Full system status'}
        </Link>
      </div>
    </aside>
  )
}
