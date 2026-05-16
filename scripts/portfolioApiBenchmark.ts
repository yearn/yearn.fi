#!/usr/bin/env bun
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BENCHMARK_WALLETS, classifyBenchmarkResult } from './portfolioBenchmarkConfig'

type TEndpointConfig = {
  id: string
  path: string
  budgetWeight: number
}

type TApiBenchmarkResult = {
  walletId: string
  walletLabel: string
  walletAddress: string
  endpointId: string
  url: string
  ok: boolean
  status: number
  durationMs: number
  budgetMs: number
  classification: ReturnType<typeof classifyBenchmarkResult>
  bytes: number
}

const API_BASE_URL = process.env.PORTFOLIO_BENCHMARK_API_BASE_URL ?? 'http://127.0.0.1:3001'
const OUTPUT_DIR = process.env.PORTFOLIO_BENCHMARK_OUTPUT_DIR ?? 'docs/performance/portfolio-benchmarks'

const ENDPOINTS: TEndpointConfig[] = [
  { id: 'history', path: '/api/holdings/history', budgetWeight: 0.35 },
  { id: 'activity', path: '/api/holdings/activity', budgetWeight: 0.15 },
  { id: 'breakdown', path: '/api/holdings/breakdown', budgetWeight: 0.2 },
  { id: 'protocol-return-history', path: '/api/holdings/protocol-return/history', budgetWeight: 0.3 }
]

function buildEndpointUrl(endpoint: TEndpointConfig, address: string): string {
  const url = new URL(endpoint.path, API_BASE_URL)
  url.searchParams.set('address', address)
  return url.toString()
}

async function benchmarkEndpoint(
  wallet: (typeof BENCHMARK_WALLETS)[number],
  endpoint: TEndpointConfig
): Promise<TApiBenchmarkResult> {
  const url = buildEndpointUrl(endpoint, wallet.address)
  const startedAt = performance.now()
  const response = await fetch(url, { cache: 'no-store' })
  const body = await response.text()
  const durationMs = Math.round(performance.now() - startedAt)
  const budgetMs = Math.round(wallet.budgetMs * endpoint.budgetWeight)

  return {
    walletId: wallet.id,
    walletLabel: wallet.label,
    walletAddress: wallet.address,
    endpointId: endpoint.id,
    url,
    ok: response.ok,
    status: response.status,
    durationMs,
    budgetMs,
    classification: response.ok ? classifyBenchmarkResult({ durationMs, budgetMs }) : 'fail',
    bytes: body.length
  }
}

async function main(): Promise<void> {
  const results: TApiBenchmarkResult[] = []

  for (const wallet of BENCHMARK_WALLETS) {
    for (const endpoint of ENDPOINTS) {
      const result = await benchmarkEndpoint(wallet, endpoint)
      results.push(result)
      console.log(
        `${result.classification.toUpperCase()} ${wallet.id}/${endpoint.id}: ${result.durationMs}ms status=${result.status} bytes=${result.bytes}`
      )
    }
  }

  await mkdir(OUTPUT_DIR, { recursive: true })
  const outputPath = join(OUTPUT_DIR, `api-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  await writeFile(outputPath, `${JSON.stringify({ apiBaseUrl: API_BASE_URL, results }, null, 2)}\n`)
  console.log(`Wrote ${outputPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
