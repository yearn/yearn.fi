import Link from '@components/Link'
import { ReportMarkdown } from '@pages/curation/components/ReportMarkdown'
import { ScoreBadge } from '@pages/curation/components/ScoreBadge'
import { ScoreTable } from '@pages/curation/components/ScoreTable'
import type { TReportData } from '@pages/curation/lib/parseReport'
import { getGitHubReportUrl, getReportBySlug } from '@pages/curation/lib/reports'
import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import '@pages/curation/curation.css'

function ReportDetailPage(): ReactElement {
  const { slug } = useParams()
  const [report, setReport] = useState<TReportData | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!slug) {
      setError('Missing report slug.')
      setIsLoading(false)
      return
    }

    const lifecycle = { isCancelled: false }

    void getReportBySlug(slug)
      .then((loadedReport) => {
        if (lifecycle.isCancelled) {
          return
        }

        if (!loadedReport) {
          setError('Report not found.')
          setReport(undefined)
          return
        }

        setReport(loadedReport)
        setError(undefined)
      })
      .catch((caughtError: unknown) => {
        if (lifecycle.isCancelled) {
          return
        }
        const message = caughtError instanceof Error ? caughtError.message : 'Failed to load report.'
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
  }, [slug])

  return (
    <div className={'curation-page'}>
      <main className={'curation-container'}>
        <Link href={'/curation'} className={'curation-back-link'}>
          {'<- All Reports'}
        </Link>

        {isLoading && <p className={'text-text-secondary'}>{'Loading report...'}</p>}
        {!isLoading && error && <p className={'text-red'}>{error}</p>}

        {!isLoading && !error && report && (
          <>
            <div className={'curation-report-header'}>
              <div className={'curation-report-header-top'}>
                <div className={'curation-report-title'}>
                  {report.iconUrl && (
                    <img
                      src={report.iconUrl}
                      alt={''}
                      width={32}
                      height={32}
                      className={'curation-report-protocol-icon'}
                      loading={'lazy'}
                    />
                  )}
                  <h1>{report.name}</h1>
                </div>
                <ScoreBadge score={report.finalScore} size={'large'} />
              </div>

              <div className={'curation-meta'}>
                <span>{report.token}</span>
                <span className={'curation-meta-sep'}>{'/'}</span>
                <span>{report.chain}</span>
                <span className={'curation-meta-sep'}>{'/'}</span>
                <span>{report.date}</span>
              </div>

              <a
                href={getGitHubReportUrl(report.slug)}
                className={'curation-github-link'}
                target={'_blank'}
                rel={'noopener noreferrer'}
              >
                {'View full report on GitHub ->'}
              </a>
            </div>

            <section className={'curation-section'}>
              <h2>{'Score Breakdown'}</h2>
              <ScoreTable scores={report.scoreTable} finalScore={report.finalScore} />
            </section>

            <section className={'curation-section'}>
              <h2>{'Overview'}</h2>
              {report.overviewMarkdown ? (
                <ReportMarkdown content={report.overviewMarkdown} />
              ) : (
                <p className={'text-text-secondary'}>{'No overview is available for this report.'}</p>
              )}
            </section>

            <section className={'curation-section'}>
              <h2>{'Risk Summary'}</h2>
              {report.riskSummaryMarkdown ? (
                <ReportMarkdown content={report.riskSummaryMarkdown} />
              ) : (
                <p className={'text-text-secondary'}>{'No risk summary is available for this report.'}</p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}

export default ReportDetailPage
