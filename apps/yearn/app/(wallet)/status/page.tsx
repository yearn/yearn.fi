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
  description: 'Live availability for Yearn services and supported networks.',
  alternates: {
    canonical: '/status',
    types: {
      'application/json': [{ title: 'Yearn system status JSON', url: 'https://yearn.fi/api/status' }]
    }
  },
  openGraph: {
    title: 'Yearn System Status',
    description: 'Live availability for Yearn services and supported networks.',
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
    <span className={'inline-flex items-center gap-2 text-sm'}>
      <span className={cl('size-2 rounded-full', getSiteHealthStateClassName(state))} aria-hidden={'true'} />
      <span className={'font-medium'}>{label ?? getSiteHealthStateLabel(state)}</span>
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
      <div className={'mx-auto w-full max-w-[1232px] px-4'}>
        <Breadcrumbs
          className={'mb-3 px-1'}
          items={[
            { label: 'Home', href: '/' },
            { label: 'Vaults', href: '/vaults' },
            { label: 'Status', href: '/status', isCurrent: true }
          ]}
        />
      </div>
      <div className={'mx-auto w-full max-w-[1232px] px-4 pb-16 pt-4 md:pt-8'}>
        <header
          className={'flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between'}
        >
          <div>
            <h1 className={'text-3xl font-semibold tracking-[-0.02em]'}>{'System status'}</h1>
            <p className={'mt-2 text-sm text-text-secondary'}>
              {'Current availability for Yearn services and supported networks.'}
            </p>
          </div>
          <StatusLabel state={overallState} label={overallLabel} />
        </header>

        <section aria-labelledby={'services-heading'} className={'py-8'}>
          <div className={'flex flex-wrap items-baseline justify-between gap-2'}>
            <h2 id={'services-heading'} className={'text-xl font-semibold'}>
              {'Services'}
            </h2>
            <time className={'text-xs text-text-secondary'} dateTime={health.checkedAt}>
              {`Checked ${formatSiteStatusDate(health.checkedAt)}`}
            </time>
          </div>

          <dl className={'mt-4 divide-y divide-border'}>
            <div className={'flex items-center justify-between gap-6 py-5'}>
              <div>
                <dt className={'font-medium'}>{'Vault data'}</dt>
                <dd className={'mt-1 text-sm text-text-secondary'}>{'Kong API'}</dd>
              </div>
              <dd className={'text-right'}>
                <StatusLabel state={health.services.kong.state} />
                <p className={'mt-1 font-aeonik-mono text-xs text-text-secondary'}>
                  {`${health.services.kong.latencyMs} ms response`}
                </p>
              </dd>
            </div>
            {[
              { label: 'Prices', provider: 'Yearn Prices', service: health.services.prices },
              { label: 'Portfolio activity', provider: 'Envio indexer', service: health.services.portfolio },
              { label: 'Transactions', provider: 'Enso routing', service: health.services.transactions },
              { label: 'Yearn CMS', provider: 'cms.yearn.fi', service: health.services.cms },
              { label: 'Token assets', provider: 'token-assets.yearn.fi', service: health.services.tokenAssets }
            ].map(({ label, provider, service }) => (
              <div key={label} className={'flex items-center justify-between gap-6 py-5'}>
                <div>
                  <dt className={'font-medium'}>{label}</dt>
                  <dd className={'mt-1 text-sm text-text-secondary'}>{provider}</dd>
                </div>
                <dd className={'text-right'}>
                  <StatusLabel state={service.state} />
                  <p className={'mt-1 font-aeonik-mono text-xs text-text-secondary'}>
                    {`${service.latencyMs} ms response`}
                  </p>
                </dd>
              </div>
            ))}
            <div className={'flex items-center justify-between gap-6 py-5'}>
              <div>
                <dt className={'font-medium'}>{'Network connections'}</dt>
                <dd className={'mt-1 text-sm text-text-secondary'}>
                  {`${health.services.rpc.operational} of ${health.services.rpc.total} responding`}
                </dd>
              </div>
              <dd>
                <StatusLabel state={health.services.rpc.state} />
              </dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby={'networks-heading'} className={'border-t border-border py-8'}>
          <h2 id={'networks-heading'} className={'text-xl font-semibold'}>
            {'Networks'}
          </h2>
          <div className={'mt-4 overflow-x-auto'}>
            <table className={'w-full border-collapse text-left'}>
              <thead
                className={
                  'border-b border-border font-aeonik-mono text-[10px] uppercase tracking-[0.1em] text-text-secondary'
                }
              >
                <tr>
                  <th scope={'col'} className={'py-3 pr-4 font-normal'}>
                    {'Network'}
                  </th>
                  <th scope={'col'} className={'hidden px-4 py-3 font-normal sm:table-cell'}>
                    {'Chain ID'}
                  </th>
                  <th scope={'col'} className={'px-4 py-3 font-normal'}>
                    {'State'}
                  </th>
                  <th scope={'col'} className={'hidden py-3 pl-4 text-right font-normal sm:table-cell'}>
                    {'Response'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {health.services.rpc.chains.map((chain) => (
                  <tr key={chain.chainId} className={'border-b border-border last:border-b-0'}>
                    <th scope={'row'} className={'py-4 pr-4 font-medium'}>
                      {chain.name}
                    </th>
                    <td className={'hidden px-4 py-4 font-aeonik-mono text-xs text-text-secondary sm:table-cell'}>
                      {chain.chainId}
                    </td>
                    <td className={'px-4 py-4'}>
                      <StatusLabel state={chain.state} />
                    </td>
                    <td
                      className={
                        'hidden py-4 pl-4 text-right font-aeonik-mono text-xs text-text-secondary sm:table-cell'
                      }
                    >
                      {`${chain.latencyMs} ms`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby={'technical-details-heading'} className={'border-t border-border py-5'}>
          <h2 id={'technical-details-heading'} className={'text-sm font-medium'}>
            {'Technical details'}
          </h2>
          <div className={'mt-5 grid gap-8 md:grid-cols-2'}>
            <div>
              <h3 className={'text-sm font-medium'}>{'Times'}</h3>
              <dl className={'mt-3'}>
                <Timestamp label={'Last checked'} value={health.checkedAt} />
                <Timestamp label={'Status generated'} value={health.generatedAt} />
                <Timestamp
                  label={'Kong cache refreshed'}
                  value={health.services.kong.cacheRefreshedAt}
                  fallback={'Not reported by Kong'}
                />
                <Timestamp label={'Site build created'} value={health.builtAt} fallback={'Not available'} />
              </dl>
            </div>
            <nav aria-label={'Technical links'}>
              <h3 className={'text-sm font-medium'}>{'Links'}</h3>
              <ul className={'mt-4 space-y-3 text-sm'}>
                <li>
                  <Link href={'/api/status'} prefetch={false} className={'underline underline-offset-4'}>
                    {'Status JSON'}
                  </Link>
                </li>
                <li>
                  <a href={'https://kong.yearn.fi/api/rest/list/vaults'} className={'underline underline-offset-4'}>
                    {'Vault data JSON'}
                  </a>
                </li>
                <li>
                  <Link href={'/api/vaults/markdown'} prefetch={false} className={'underline underline-offset-4'}>
                    {'Vault catalog Markdown'}
                  </Link>
                </li>
                <li>
                  <a href={'https://cms.yearn.fi'} className={'underline underline-offset-4'}>
                    {'Yearn CMS'}
                  </a>
                </li>
                <li>
                  <a href={'https://token-assets.yearn.fi'} className={'underline underline-offset-4'}>
                    {'Token assets'}
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </section>
      </div>
    </div>
  )
}
