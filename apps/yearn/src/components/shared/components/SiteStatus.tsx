'use client'

import { cl } from '@shared/utils/cl'
import { useQuery } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import type { TSiteHealth, TSiteHealthState } from '@/types/siteStatus'

const siteUpdatedAt = process.env.NEXT_PUBLIC_SITE_UPDATED_AT || ''

type TServiceLabelProps = {
  label: string
  state?: TSiteHealthState
  status: string
  title: string
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) {
    return 'unknown'
  }

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
    timeZoneName: 'short'
  }).format(date)
}

function getStateClassName(state?: TSiteHealthState): string {
  if (state === 'operational') {
    return 'bg-success'
  }
  if (state === 'degraded') {
    return 'bg-warning'
  }
  if (state === 'unavailable') {
    return 'bg-error'
  }
  return 'bg-text-tertiary'
}

function getOverallState(health?: TSiteHealth): TSiteHealthState | undefined {
  if (!health) {
    return undefined
  }
  if (health.services.kong.state === 'operational' && health.services.rpc.state === 'operational') {
    return 'operational'
  }
  if (health.services.kong.state === 'unavailable' && health.services.rpc.state === 'unavailable') {
    return 'unavailable'
  }
  return 'degraded'
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
      <span className={cl('size-1.5 rounded-full', getStateClassName(state))} aria-hidden={'true'} />
      <span>{label}</span>
      <span className={'text-text-primary'}>{status}</span>
    </span>
  )
}

export function SiteStatus(): ReactElement {
  const statusQuery = useSiteHealth()
  const health = statusQuery.data
  const overallState = getOverallState(health)
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
    <aside
      aria-label={'Site status'}
      aria-busy={statusQuery.isPending}
      className={
        'group fixed top-[calc(var(--header-height)+0.125rem)] right-[max(1rem,calc(50vw_-_600px))] z-50 hidden cursor-default items-center gap-3 font-aeonik-mono text-[10px] uppercase tracking-[0.08em] text-text-secondary md:flex min-[1700px]:top-auto min-[1700px]:right-6 min-[1700px]:bottom-6 min-[1700px]:flex-col min-[1700px]:items-end min-[1700px]:gap-1'
      }
    >
      <time className={'whitespace-nowrap'} dateTime={siteUpdatedAt || undefined} title={siteUpdatedAt || undefined}>
        {`Updated ${formatUpdatedAt(siteUpdatedAt)}`}
      </time>
      <span className={'min-[1700px]:hidden'} aria-hidden={'true'}>
        {'·'}
      </span>
      <span className={'grid items-center'}>
        <span
          className={
            'col-start-1 row-start-1 inline-flex items-center gap-1.5 whitespace-nowrap group-hover:hidden min-[1700px]:hidden'
          }
        >
          <span className={cl('size-1.5 rounded-full', getStateClassName(overallState))} aria-hidden={'true'} />
          <span className={'text-text-primary'}>{overallStatus}</span>
        </span>
        <span
          className={
            'col-start-1 row-start-1 hidden items-center gap-3 whitespace-nowrap group-hover:flex min-[1700px]:flex min-[1700px]:flex-col min-[1700px]:items-end min-[1700px]:gap-1'
          }
        >
          <ServiceLabel
            label={'Kong'}
            state={health?.services.kong.state}
            status={statusQuery.isError ? 'unknown' : kongStatus}
            title={statusQuery.isError ? 'Kong status unavailable' : kongTitle}
          />
          <span className={'min-[1700px]:hidden'} aria-hidden={'true'}>
            {'·'}
          </span>
          <ServiceLabel
            label={'RPCs'}
            state={health?.services.rpc.state}
            status={rpcStatus}
            title={statusQuery.isError ? 'RPC status unavailable' : rpcTitle}
          />
        </span>
      </span>
    </aside>
  )
}

export function MobileSiteStatus(): ReactElement {
  const statusQuery = useSiteHealth()
  const health = statusQuery.data
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
        <time className={'whitespace-nowrap'} dateTime={siteUpdatedAt || undefined} title={siteUpdatedAt || undefined}>
          {`Updated ${formatUpdatedAt(siteUpdatedAt)}`}
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
      </div>
    </aside>
  )
}
