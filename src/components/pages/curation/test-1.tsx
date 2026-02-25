import Link from '@components/Link'
import { ScoreBadge } from '@pages/curation/components/ScoreBadge'
import { scoreTier } from '@pages/curation/lib/colors'
import type { TReportData } from '@pages/curation/lib/parseReport'
import { getAllReports } from '@pages/curation/lib/reports'
import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'
import '@pages/curation/curation.css'

function CurationTestLayoutOne(): ReactElement {
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
          <Link href={'/curation'} className={'curation-layout-toggle'}>
            {'Back to table layout'}
          </Link>
        </div>

        {isLoading && <p className={'text-text-secondary'}>{'Loading reports...'}</p>}
        {!isLoading && error && <p className={'text-red'}>{error}</p>}

        {!isLoading && !error && (
          <div className={'curation-card-grid'}>
            {reports.map((report) => {
              const reportPath = `/curation/report/${report.slug}`

              return (
                <Link key={report.slug} href={reportPath} className={'curation-report-card'}>
                  <article className={'curation-report-card-content'}>
                    <div className={'curation-report-card-header'}>
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
                      <h2 className={'curation-report-card-title'}>{report.name}</h2>
                    </div>

                    <div className={'curation-report-card-row'}>
                      <span className={'curation-report-card-label'}>{'Token'}</span>
                      <span className={'curation-mono'}>{report.token}</span>
                    </div>

                    <div className={'curation-report-card-footer'}>
                      <div className={'curation-report-card-risk'}>
                        <span className={'curation-report-card-label'}>{'Risk Tier'}</span>
                        <span>{scoreTier(report.finalScore)}</span>
                      </div>
                      <div className={'curation-report-card-score'}>
                        <span className={'curation-report-card-label'}>{'Final Score'}</span>
                        <ScoreBadge score={report.finalScore} />
                      </div>
                    </div>
                  </article>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

export default CurationTestLayoutOne
