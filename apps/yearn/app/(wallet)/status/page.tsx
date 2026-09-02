import { Breadcrumbs } from '@shared/components/Breadcrumbs'
import { cl } from '@shared/utils'
import {
  formatSiteStatusDate,
  getOverallSiteHealthState,
  getSiteHealthStateClassName,
  getSiteHealthStateLabel
} from '@shared/utils/siteStatus'
import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactElement } from 'react'
import { getSiteHealth } from '@/server/status'
import type { TSiteHealthState } from '@/types/siteStatus'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'System Status',
  description: 'Live reachability status for Yearn vault data and supported network RPCs.',
  alternates: {
    canonical: '/status',
    types: {
      'application/json': [{ title: 'Yearn system status JSON', url: 'https://yearn.fi/api/status' }]
    }
  },
  openGraph: {
    title: 'Yearn System Status',
    description: 'Live reachability status for Yearn vault data and supported network RPCs.',
    url: '/status',
    type: 'website'
  }
}

type TStatusLabelProps = {
  state?: TSiteHealthState
  label?: string
}

function StatusLabel({ state, label }: TStatusLabelProps): ReactElement {
  return (
    <span className={'inline-flex items-center gap-2 font-aeonik-mono text-xs uppercase tracking-[0.08em]'}>
      <span className={cl('size-2 rounded-full', getSiteHealthStateClassName(state))} aria-hidden={'true'} />
      <span>{label ?? getSiteHealthStateLabel(state)}</span>
    </span>
  )
}

function Timestamp({ label, value, fallback }: { label: string; value?: string; fallback?: string }): ReactElement {
  return (
    <div className={'flex flex-col gap-1 border-t border-border py-4 sm:grid sm:grid-cols-[12rem_1fr] sm:gap-6'}>
      <dt className={'text-sm text-text-secondary'}>{label}</dt>
      <dd className={'font-aeonik-mono text-xs text-text-primary'}>
        {value ? <time dateTime={value}>{formatSiteStatusDate(value)}</time> : fallback || 'Not available'}
      </dd>
    </div>
  )
}

export default async function Page(): Promise<ReactElement> {
  const health = await getSiteHealth()
  const overallState = getOverallSiteHealthState(health)
  const overallLabel = getSiteHealthStateLabel(overallState)

  return (
    <div className={'min-h-[calc(100vh-var(--header-height))] bg-app text-text-primary'}>
      <div className={'mx-auto w-full max-w-[1232px] px-4 pb-20 pt-4 md:pt-8'}>
        <Breadcrumbs
          className={'mb-10'}
          items={[
            { label: 'Home', href: '/' },
            { label: 'System status', href: '/status', isCurrent: true }
          ]}
        />

        <header className={'grid gap-8 pb-12 md:grid-cols-[minmax(0,1fr)_auto] md:items-end'}>
          <div className={'max-w-2xl'}>
            <p className={'mb-3 font-aeonik-mono text-xs uppercase tracking-[0.12em] text-text-secondary'}>
              {'Yearn infrastructure'}
            </p>
            <h1 className={'text-4xl font-bold tracking-[-0.03em] md:text-6xl'}>{'System status'}</h1>
            <p className={'mt-4 max-w-xl text-base leading-7 text-text-secondary md:text-lg'}>
              {'Live reachability checks for the Kong vault-data service and every network RPC supported by yearn.fi.'}
            </p>
          </div>
          <div className={'flex items-center gap-4 md:pb-1'}>
            <span
              className={cl(
                'size-4 rounded-full shadow-[0_0_0_8px_var(--color-surface)]',
                getSiteHealthStateClassName(overallState)
              )}
              aria-hidden={'true'}
            />
            <div>
              <p className={'text-2xl font-medium'}>{overallLabel}</p>
              <p className={'font-aeonik-mono text-xs uppercase tracking-[0.08em] text-text-secondary'}>
                {'Overall state'}
              </p>
            </div>
          </div>
        </header>

        <section aria-labelledby={'services-heading'} className={'border-t border-border py-10'}>
          <div className={'mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between'}>
            <div>
              <h2 id={'services-heading'} className={'text-2xl font-semibold tracking-[-0.02em]'}>
                {'Services'}
              </h2>
              <p className={'mt-1 text-sm text-text-secondary'}>
                {'Most recent direct checks, cached for 30 seconds.'}
              </p>
            </div>
            <Link
              href={'/api/status'}
              prefetch={false}
              className={
                'text-sm text-text-secondary underline decoration-border underline-offset-4 hover:text-text-primary'
              }
            >
              {'View status JSON'}
            </Link>
          </div>

          <div className={'grid border-y border-border md:grid-cols-2 md:divide-x md:divide-border'}>
            <div className={'py-7 md:pr-10'}>
              <div className={'flex items-center justify-between gap-4'}>
                <h3 className={'text-lg font-medium'}>{'Kong vault data'}</h3>
                <StatusLabel state={health.services.kong.state} />
              </div>
              <p className={'mt-3 max-w-md text-sm leading-6 text-text-secondary'}>
                {'Canonical vault metadata, APY, TVL, strategy composition, and availability.'}
              </p>
              <p className={'mt-5 font-aeonik-mono text-xs text-text-secondary'}>
                {`${health.services.kong.latencyMs} ms response`}
              </p>
            </div>
            <div className={'border-t border-border py-7 md:border-t-0 md:pl-10'}>
              <div className={'flex items-center justify-between gap-4'}>
                <h3 className={'text-lg font-medium'}>{'Network RPCs'}</h3>
                <StatusLabel
                  state={health.services.rpc.state}
                  label={`${health.services.rpc.operational}/${health.services.rpc.total} operational`}
                />
              </div>
              <p className={'mt-3 max-w-md text-sm leading-6 text-text-secondary'}>
                {'Read-only chain access used to retrieve balances, positions, and contract state.'}
              </p>
              <p className={'mt-5 font-aeonik-mono text-xs text-text-secondary'}>
                {getSiteHealthStateLabel(health.services.rpc.state)}
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby={'networks-heading'} className={'border-t border-border py-10'}>
          <h2 id={'networks-heading'} className={'text-2xl font-semibold tracking-[-0.02em]'}>
            {'Supported networks'}
          </h2>
          <div className={'mt-7 overflow-x-auto'}>
            <table className={'w-full min-w-[34rem] border-collapse text-left'}>
              <thead
                className={
                  'border-y border-border font-aeonik-mono text-[10px] uppercase tracking-[0.1em] text-text-secondary'
                }
              >
                <tr>
                  <th scope={'col'} className={'py-3 pr-4 font-normal'}>
                    {'Network'}
                  </th>
                  <th scope={'col'} className={'px-4 py-3 font-normal'}>
                    {'Chain ID'}
                  </th>
                  <th scope={'col'} className={'px-4 py-3 font-normal'}>
                    {'State'}
                  </th>
                  <th scope={'col'} className={'py-3 pl-4 text-right font-normal'}>
                    {'Response'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {health.services.rpc.chains.map((chain) => (
                  <tr key={chain.chainId} className={'border-b border-border'}>
                    <th scope={'row'} className={'py-4 pr-4 font-medium'}>
                      {chain.name}
                    </th>
                    <td className={'px-4 py-4 font-aeonik-mono text-xs text-text-secondary'}>{chain.chainId}</td>
                    <td className={'px-4 py-4'}>
                      <StatusLabel state={chain.state} />
                    </td>
                    <td className={'py-4 pl-4 text-right font-aeonik-mono text-xs text-text-secondary'}>
                      {`${chain.latencyMs} ms`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby={'freshness-heading'} className={'border-t border-border py-10'}>
          <div className={'grid gap-10 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]'}>
            <div>
              <h2 id={'freshness-heading'} className={'text-2xl font-semibold tracking-[-0.02em]'}>
                {'Freshness'}
              </h2>
              <p className={'mt-3 max-w-sm text-sm leading-6 text-text-secondary'}>
                {
                  'These timestamps describe different events. A health check does not imply that financial data changed.'
                }
              </p>
            </div>
            <dl>
              <Timestamp label={'Health checked'} value={health.checkedAt} />
              <Timestamp label={'Status snapshot generated'} value={health.generatedAt} />
              <Timestamp
                label={'Kong representation modified'}
                value={health.services.kong.representationUpdatedAt}
                fallback={'No Last-Modified timestamp reported by Kong'}
              />
              <Timestamp
                label={'Site build created'}
                value={health.builtAt}
                fallback={'Build timestamp not available in this environment'}
              />
            </dl>
          </div>
        </section>

        <nav aria-label={'Machine-readable resources'} className={'border-y border-border py-8'}>
          <p className={'mb-4 font-aeonik-mono text-[10px] uppercase tracking-[0.1em] text-text-secondary'}>
            {'Machine-readable resources'}
          </p>
          <div className={'flex flex-wrap gap-x-8 gap-y-3 text-sm'}>
            <Link href={'/api/status'} prefetch={false} className={'underline decoration-border underline-offset-4'}>
              {'Status JSON'}
            </Link>
            <a
              href={'https://kong.yearn.fi/api/rest/list/vaults'}
              className={'underline decoration-border underline-offset-4'}
            >
              {'Canonical vault JSON'}
            </a>
            <Link
              href={'/api/vaults/markdown'}
              prefetch={false}
              className={'underline decoration-border underline-offset-4'}
            >
              {'Vault catalog Markdown'}
            </Link>
          </div>
        </nav>
      </div>
    </div>
  )
}
