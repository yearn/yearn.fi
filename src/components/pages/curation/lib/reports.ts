import { parseReport, type TReportData } from '@pages/curation/lib/parseReport'

type TMarkdownLoader = () => Promise<string>

const REPORT_MODULES = import.meta.glob('/src/components/pages/curation/reports/*.md', {
  query: '?raw',
  import: 'default'
}) as Record<string, TMarkdownLoader>

const REPORT_LOADERS_BY_SLUG = Object.entries(REPORT_MODULES).reduce<Record<string, TMarkdownLoader>>(
  (accumulator, [path, loader]) => {
    const slug = path.split('/').pop()?.replace(/\.md$/, '') ?? ''
    if (!slug) {
      return accumulator
    }

    accumulator[slug] = loader
    return accumulator
  },
  {}
)

const REPORT_CACHE: {
  allReportsPromise?: Promise<TReportData[]>
  bySlugPromise: Record<string, Promise<TReportData | undefined>>
} = {
  bySlugPromise: {}
}

const GITHUB_REPORT_BASE_URL = 'https://github.com/yearn/risk-score/blob/master/reports/report'

export async function getAllReports(): Promise<TReportData[]> {
  if (!REPORT_CACHE.allReportsPromise) {
    REPORT_CACHE.allReportsPromise = Promise.all(
      Object.entries(REPORT_LOADERS_BY_SLUG).map(async ([slug, loader]) => {
        const content = await loader()
        return parseReport(slug, content)
      })
    ).then((reports) => reports.sort((a, b) => a.finalScore - b.finalScore))
  }

  return REPORT_CACHE.allReportsPromise
}

export async function getReportBySlug(slug: string): Promise<TReportData | undefined> {
  const normalizedSlug = slug.trim().toLowerCase()
  const existing = REPORT_CACHE.bySlugPromise[normalizedSlug]
  if (existing) {
    return existing
  }

  const loader = REPORT_LOADERS_BY_SLUG[normalizedSlug]
  if (!loader) {
    return undefined
  }

  const promise = loader().then((content) => parseReport(normalizedSlug, content))
  REPORT_CACHE.bySlugPromise[normalizedSlug] = promise
  return promise
}

export function getAllSlugs(): string[] {
  return Object.keys(REPORT_LOADERS_BY_SLUG).sort()
}

export function getGitHubReportUrl(slug: string): string {
  return `${GITHUB_REPORT_BASE_URL}/${slug}.md`
}
