import Link from '@components/Link'
import { ScoreBadge } from '@pages/curation/components/ScoreBadge'
import { scoreTier } from '@pages/curation/lib/colors'
import type { TReportData } from '@pages/curation/lib/parseReport'
import { getAllReports } from '@pages/curation/lib/reports'
import type { KeyboardEvent, ReactElement } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import '@pages/curation/curation.css'

function onRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, activate: () => void): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    activate()
  }
}

function Index(): ReactElement {
  const navigate = useNavigate()
  const [reports, setReports] = useState<TReportData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | undefined>(undefined)

  useEffect(() => {
    const lifecycle = { isCancelled: false }

    void getAllReports()
      .then((loadedReports) => {
        if (lifecycle.isCancelled) {
          return
        }
        setReports(loadedReports)
        setError(undefined)
      })
      .catch((caughtError: unknown) => {
        if (lifecycle.isCancelled) {
          return
        }
        const message = caughtError instanceof Error ? caughtError.message : 'Failed to load curation reports.'
        setError(message)
      })
      .finally(() => {
        if (lifecycle.isCancelled) {
          return
        }
        setIsLoading(false)
      })

    return () => {
      lifecycle.isCancelled = true
    }
  }, [])

  return (
    <div className={'curation-page'}>
      <main className={'curation-container'}>
        <div className={'curation-heading-row'}>
          <h1 className={'curation-heading'}>{'Risk Assessment Reports'}</h1>
          <Link href={'/curation-test-1'} className={'curation-layout-toggle'}>
            {'Try card layout'}
          </Link>
        </div>

        {isLoading && <p className={'text-text-secondary'}>{'Loading reports...'}</p>}
        {!isLoading && error && <p className={'text-red'}>{error}</p>}

        {!isLoading && !error && (
          <div className={'curation-table-wrap'}>
            <table className={'curation-table'}>
              <thead>
                <tr>
                  <th className={'curation-col-icon'} />
                  <th>{'Protocol'}</th>
                  <th>{'Token'}</th>
                  <th>{'Score'}</th>
                  <th>{'Risk Tier'}</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => {
                  const reportPath = `/curation/report/${report.slug}`

                  return (
                    <tr
                      key={report.slug}
                      className={'curation-clickable-row'}
                      tabIndex={0}
                      onClick={() => navigate(reportPath)}
                      onKeyDown={(event) => onRowKeyDown(event, () => navigate(reportPath))}
                    >
                      <td className={'curation-col-icon'}>
                        <div className={'curation-icon-stack'}>
                          {report.iconUrl ? (
                            <img
                              src={report.iconUrl}
                              alt={''}
                              width={24}
                              height={24}
                              className={'curation-protocol-icon'}
                              loading={'lazy'}
                            />
                          ) : (
                            <div className={'curation-icon-placeholder'} />
                          )}

                          {report.chainIconUrl && (
                            <img
                              src={report.chainIconUrl}
                              alt={''}
                              width={14}
                              height={14}
                              className={'curation-chain-icon'}
                              loading={'lazy'}
                            />
                          )}
                        </div>
                      </td>

                      <td>{report.name}</td>
                      <td className={'curation-mono'}>{report.token}</td>
                      <td>
                        <ScoreBadge score={report.finalScore} />
                      </td>
                      <td>{scoreTier(report.finalScore)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

export default Index
