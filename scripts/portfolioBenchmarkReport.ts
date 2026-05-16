#!/usr/bin/env bun
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { BENCHMARK_WALLETS, buildCodexPortfolioUrl } from './portfolioBenchmarkConfig'

type TApiBenchmarkFile = {
  apiBaseUrl?: string
  results?: Array<{
    walletId: string
    walletLabel: string
    endpointId: string
    ok: boolean
    status: number
    durationMs: number
    budgetMs: number
    classification: 'pass' | 'warn' | 'fail'
    bytes: number
  }>
}

const OUTPUT_DIR = process.env.PORTFOLIO_BENCHMARK_OUTPUT_DIR ?? 'docs/performance/portfolio-benchmarks'
const APP_BASE_URL = process.env.PORTFOLIO_BENCHMARK_APP_BASE_URL ?? 'http://127.0.0.1:5173'

function renderStatusIcon(classification: string): string {
  if (classification === 'pass') {
    return '✅'
  }
  if (classification === 'warn') {
    return '⚠️'
  }
  return '❌'
}

function renderWalletUrls(): string {
  return BENCHMARK_WALLETS.map(
    (wallet) =>
      `- **${wallet.id} / ${wallet.label}**: [direct Codex portfolio URL](${buildCodexPortfolioUrl(APP_BASE_URL, wallet)}) — budget ${wallet.budgetMs}ms`
  ).join('\n')
}

function renderApiResults(data: TApiBenchmarkFile, sourcePath: string): string {
  if (!data.results?.length) {
    return '_No API benchmark rows found._'
  }

  const rows = data.results.map(
    (result) =>
      `- ${renderStatusIcon(result.classification)} **${result.walletId}/${result.endpointId}**: ${result.durationMs}ms / ${result.budgetMs}ms budget, status ${result.status}, ${result.bytes} bytes`
  )

  return [`Source: \`${sourcePath}\``, `API base: \`${data.apiBaseUrl ?? 'unknown'}\``, '', ...rows].join('\n')
}

async function main(): Promise<void> {
  const sourcePath = process.argv[2]
  const data: TApiBenchmarkFile = sourcePath ? JSON.parse(await readFile(sourcePath, 'utf8')) : {}
  const sourceLabel = sourcePath ? basename(sourcePath) : 'manual-run'
  const output = `# Portfolio benchmark report\n\nGenerated: ${new Date().toISOString()}\n\n## Direct browser benchmark URLs\n\n${renderWalletUrls()}\n\n## API timing results\n\n${renderApiResults(data, sourceLabel)}\n\n## Browser timing checklist\n\nFor each direct Codex URL, capture:\n\n- Time to stable shell\n- Time to first holdings rows or confirmed empty state\n- Time to history chart usable state\n- Console errors and failed network requests\n- Screenshot at 0s, 2.5s, 7.5s, and final loaded state\n\nThe Codex wallet is enabled in production-like previews only when \`VITE_CODEX_WALLET=true\`, and direct runs must pass \`codexWallet=1&codexWalletAddress=<address>\`.\n`

  await mkdir(OUTPUT_DIR, { recursive: true })
  const outputPath = join(OUTPUT_DIR, `report-${sourceLabel.replace(/\.json$/, '')}.md`)
  await writeFile(outputPath, output)
  console.log(`Wrote ${outputPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
