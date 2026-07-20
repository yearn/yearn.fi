import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

const PROJECT_ROOT = process.cwd()
const BUILD_DIR = path.join(PROJECT_ROOT, '.next')
const STATIC_CHUNKS_DIR = path.join(BUILD_DIR, 'static', 'chunks')
const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
const REPEAT_COUNT = Number(process.env.REPEAT ?? '3')
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS ?? '15000')
const SKIP_LIVE = process.env.SKIP_LIVE === '1'

type TRouteBaseline = {
  label: string
  path: string
  artifact?: string
  expectedText: string[]
}

type TStaticArtifactResult = {
  route: TRouteBaseline
  exists: boolean
  bytes: number
  gzipBytes: number
  scriptTags: number
  expectedTextFound: boolean
}

type TLiveAttempt = {
  status: number
  headersMs: number
  bodyMs: number
  bytes: number
  cacheControl: string
  nextCache: string
  expectedTextFound: boolean
}

type TLiveRouteResult = {
  route: TRouteBaseline
  attempts: TLiveAttempt[]
  error?: string
}

type TChunkMetric = {
  file: string
  bytes: number
  gzipBytes: number
}

const routes: TRouteBaseline[] = [
  {
    label: 'landing',
    path: '/',
    artifact: '.next/server/app/index.html',
    expectedText: ['Earn on your Crypto', 'Explore Vaults']
  },
  {
    label: 'vaults',
    path: '/vaults',
    artifact: '.next/server/app/vaults.html',
    expectedText: ['Vaults', 'yvUSD']
  },
  {
    label: 'vault detail',
    path: '/vaults/1/0x696d02Db93291651ED510704c9b286841d506987',
    expectedText: ['yvUSD']
  }
]

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

function formatMs(ms: number): string {
  return `${ms.toFixed(1)} ms`
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((total, value) => total + value, 0) / values.length
}

function max(values: number[]): number {
  if (values.length === 0) return 0
  return Math.max(...values)
}

function countMatches(content: string, pattern: RegExp): number {
  return content.match(pattern)?.length ?? 0
}

function includesExpectedText(content: string, expectedText: string[]): boolean {
  return expectedText.every((text) => content.includes(text))
}

function formatTable(rows: string[][]): string {
  const columnWidths =
    rows[0]?.map((_, columnIndex) => Math.max(...rows.map((row) => row[columnIndex]?.length ?? 0))) ?? []

  return rows
    .map((row) => row.map((cell, columnIndex) => cell.padEnd(columnWidths[columnIndex] ?? 0)).join('  '))
    .join('\n')
}

function collectFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return []

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) return collectFiles(entryPath)
    if (entry.isFile()) return [entryPath]
    return []
  })
}

function measureStaticArtifact(route: TRouteBaseline): TStaticArtifactResult {
  const artifactPath = route.artifact ? path.join(PROJECT_ROOT, route.artifact) : undefined
  const content = artifactPath && fs.existsSync(artifactPath) ? fs.readFileSync(artifactPath, 'utf8') : ''
  const bytes = Buffer.byteLength(content)

  return {
    route,
    exists: Boolean(artifactPath && fs.existsSync(artifactPath)),
    bytes,
    gzipBytes: content ? gzipSync(content).byteLength : 0,
    scriptTags: countMatches(content, /<script\b/gi),
    expectedTextFound: content ? includesExpectedText(content, route.expectedText) : false
  }
}

function getChunkMetrics(): TChunkMetric[] {
  return collectFiles(STATIC_CHUNKS_DIR)
    .filter((filePath) => filePath.endsWith('.js'))
    .map((filePath) => {
      const buffer = fs.readFileSync(filePath)

      return {
        file: path.relative(PROJECT_ROOT, filePath).split(path.sep).join('/'),
        bytes: buffer.byteLength,
        gzipBytes: gzipSync(buffer).byteLength
      }
    })
    .sort((left, right) => right.bytes - left.bytes)
}

async function runSequential<T>(tasks: Array<() => Promise<T>>): Promise<T[]> {
  return tasks.reduce<Promise<T[]>>(async (previousPromise, task) => {
    const previous = await previousPromise
    const next = await task()
    return [...previous, next]
  }, Promise.resolve([]))
}

async function fetchRouteAttempt(route: TRouteBaseline): Promise<TLiveAttempt> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const url = new URL(route.path, BASE_URL).toString()
  const startedAt = performance.now()

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'text/html'
      },
      signal: controller.signal
    })
    const headersAt = performance.now()
    const html = await response.text()
    const finishedAt = performance.now()

    return {
      status: response.status,
      headersMs: headersAt - startedAt,
      bodyMs: finishedAt - startedAt,
      bytes: Buffer.byteLength(html),
      cacheControl: response.headers.get('cache-control') ?? '',
      nextCache: response.headers.get('x-nextjs-cache') ?? '',
      expectedTextFound: includesExpectedText(html, route.expectedText)
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function measureLiveRoute(route: TRouteBaseline): Promise<TLiveRouteResult> {
  try {
    const attempts = await runSequential(Array.from({ length: REPEAT_COUNT }, () => () => fetchRouteAttempt(route)))

    return { route, attempts }
  } catch (error) {
    return {
      route,
      attempts: [],
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

function printStaticArtifactResults(results: TStaticArtifactResult[]): void {
  console.log('\nStatic HTML artifacts')
  console.log(
    formatTable([
      ['route', 'artifact', 'size', 'gzip', 'scripts', 'expected text'],
      ...results.map((result) => [
        result.route.label,
        result.route.artifact ?? '-',
        result.exists ? formatBytes(result.bytes) : 'missing',
        result.exists ? formatBytes(result.gzipBytes) : '-',
        result.exists ? String(result.scriptTags) : '-',
        result.exists ? (result.expectedTextFound ? 'yes' : 'no') : '-'
      ])
    ])
  )
}

function printChunkResults(metrics: TChunkMetric[]): void {
  const totalBytes = metrics.reduce((total, metric) => total + metric.bytes, 0)
  const totalGzipBytes = metrics.reduce((total, metric) => total + metric.gzipBytes, 0)

  console.log('\nClient JS chunks')
  console.log(`files: ${metrics.length}`)
  console.log(`total: ${formatBytes(totalBytes)} (${formatBytes(totalGzipBytes)} gzip)`)
  console.log(
    formatTable([
      ['largest chunks', 'size', 'gzip'],
      ...metrics.slice(0, 8).map((metric) => [metric.file, formatBytes(metric.bytes), formatBytes(metric.gzipBytes)])
    ])
  )
}

function summarizeAttempts(attempts: TLiveAttempt[]): {
  status: string
  headersMs: string
  bodyMs: string
  maxBodyMs: string
  bytes: string
  cache: string
  expectedText: string
} {
  const bodyMs = attempts.map((attempt) => attempt.bodyMs)

  return {
    status: Array.from(new Set(attempts.map((attempt) => attempt.status))).join(', '),
    headersMs: formatMs(average(attempts.map((attempt) => attempt.headersMs))),
    bodyMs: formatMs(average(bodyMs)),
    maxBodyMs: formatMs(max(bodyMs)),
    bytes: formatBytes(Math.round(average(attempts.map((attempt) => attempt.bytes)))),
    cache:
      attempts[0]?.nextCache || attempts[0]?.cacheControl
        ? `${attempts[0]?.nextCache || '-'} ${attempts[0]?.cacheControl || ''}`.trim()
        : '-',
    expectedText: attempts.every((attempt) => attempt.expectedTextFound) ? 'yes' : 'no'
  }
}

function printLiveResults(results: TLiveRouteResult[]): void {
  console.log('\nLive preview responses')
  console.log(`base URL: ${BASE_URL}`)
  console.log(`repeat count: ${REPEAT_COUNT}`)
  console.log(
    formatTable([
      ['route', 'status', 'headers avg', 'body avg', 'body max', 'size', 'cache', 'expected text'],
      ...results.map((result) => {
        if (result.error) {
          return [result.route.label, 'error', '-', '-', '-', '-', result.error, 'no']
        }

        const summary = summarizeAttempts(result.attempts)
        return [
          result.route.label,
          summary.status,
          summary.headersMs,
          summary.bodyMs,
          summary.maxBodyMs,
          summary.bytes,
          summary.cache,
          summary.expectedText
        ]
      })
    ])
  )
}

async function main(): Promise<void> {
  console.log('SSR baseline measurement')
  console.log(`build dir: ${path.relative(PROJECT_ROOT, BUILD_DIR)}`)

  printStaticArtifactResults(routes.map(measureStaticArtifact))
  printChunkResults(getChunkMetrics())

  if (SKIP_LIVE) {
    console.log('\nLive preview responses skipped because SKIP_LIVE=1.')
    return
  }

  const liveResults = await runSequential(routes.map((route) => () => measureLiveRoute(route)))
  printLiveResults(liveResults)

  if (liveResults.some((result) => result.error)) {
    process.exitCode = 1
  }
}

void main()
