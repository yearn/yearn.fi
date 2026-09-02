'use client'

import { cl } from '@shared/utils/cl'
import {
  formatSiteStatusDate,
  formatSiteStatusTime,
  getOverallSiteHealthState,
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
  status: string
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
      <span className={'text-text-primary'}>{status}</span>
    </span>
  )
}

export function HeaderSiteStatus(): ReactElement {
  const statusQuery = useSiteHealth()
  const detailsID = useId()
  const health = statusQuery.isError ? undefined : statusQuery.data
  const overallState = getOverallSiteHealthState(health)
  const overallStatus = statusQuery.isError ? 'unknown' : overallState || 'checking'
  const kongStatus =
    health?.services.kong.state === 'operational' ? 'online' : health?.services.kong.state || 'checking'
  const rpcStatus = health
    ? `${health.services.rpc.operational}/${health.services.rpc.total} online`
    : statusQuery.isError
      ? 'unknown'
      : 'checking'
  const kongTitle = health
    ? `Kong ${health.services.kong.state}, ${health.services.kong.latencyMs}ms response`
    : 'Checking Kong status'
  const rpcTitle = health
    ? health.services.rpc.chains.map((chain) => `${chain.name}: ${chain.state}`).join(', ')
    : 'Checking supported chain RPCs'

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
            'flex h-8 translate-x-full items-center justify-end gap-2 whitespace-nowrap bg-app/95 pr-5 pl-3 font-aeonik-mono text-[9px] uppercase tracking-[0.08em] text-text-secondary opacity-0 backdrop-blur-md transition-[translate,opacity] duration-300 ease-out group-hover/site-status:translate-x-0 group-hover/site-status:opacity-100 group-focus-within/site-status:translate-x-0 group-focus-within/site-status:opacity-100 motion-reduce:transition-none lg:gap-3 lg:text-[10px]'
          }
        >
          <time className={'whitespace-nowrap'} dateTime={health?.checkedAt} title={health?.checkedAt}>
            {health ? `Checked ${formatSiteStatusTime(health.checkedAt)}` : 'Checking status'}
          </time>
          <span aria-hidden={'true'}>{'·'}</span>
          <ServiceLabel
            label={'Kong'}
            state={health?.services.kong.state}
            status={statusQuery.isError ? 'unknown' : kongStatus}
            title={statusQuery.isError ? 'Kong status unavailable' : kongTitle}
          />
          <span aria-hidden={'true'}>{'·'}</span>
          <ServiceLabel
            label={'RPCs'}
            state={health?.services.rpc.state}
            status={rpcStatus}
            title={statusQuery.isError ? 'RPC status unavailable' : rpcTitle}
          />
        </div>
      </aside>
    </div>
  )
}

export function MobileSiteStatus(): ReactElement {
  const statusQuery = useSiteHealth()
  const health = statusQuery.isError ? undefined : statusQuery.data
  const kongStatus =
    health?.services.kong.state === 'operational' ? 'online' : health?.services.kong.state || 'checking'
  const rpcStatus = health
    ? `${health.services.rpc.operational}/${health.services.rpc.total}`
    : statusQuery.isError
      ? 'unknown'
      : 'checking'

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
        <span className={'flex items-center justify-center gap-3'}>
          <ServiceLabel
            label={'Kong'}
            state={health?.services.kong.state}
            status={statusQuery.isError ? 'unknown' : kongStatus}
            title={'Kong status'}
          />
          <span aria-hidden={'true'}>{'·'}</span>
          <ServiceLabel
            label={'RPCs'}
            state={health?.services.rpc.state}
            status={rpcStatus}
            title={'Supported chain RPC status'}
          />
        </span>
        <Link href={'/status'} prefetch={false} className={'text-text-primary underline underline-offset-2'}>
          {'Full system status'}
        </Link>
      </div>
    </aside>
  )
}
