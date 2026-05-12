import { describe, expect, it } from 'vitest'
import { BENCHMARK_WALLETS, buildCodexPortfolioUrl, classifyBenchmarkResult } from './portfolioBenchmarkConfig'

describe('portfolio benchmark config', () => {
  it('defines stable light, medium, and heavy wallet profiles', () => {
    expect(BENCHMARK_WALLETS.map((wallet) => wallet.id)).toEqual(['heavy', 'medium', 'light'])
    expect(BENCHMARK_WALLETS.every((wallet) => wallet.address.startsWith('0x'))).toBe(true)
  })

  it('builds a direct codex wallet portfolio URL with an explicit wallet address', () => {
    expect(buildCodexPortfolioUrl('https://preview.yearn.fi', BENCHMARK_WALLETS[0])).toBe(
      'https://preview.yearn.fi/portfolio?codexWallet=1&codexWalletAddress=0x93A62dA5a14C80f265DAbC077fCEE437B1a0Efde'
    )
  })

  it('classifies benchmark results against profile budgets', () => {
    expect(classifyBenchmarkResult({ durationMs: 1_500, budgetMs: 2_000 })).toBe('pass')
    expect(classifyBenchmarkResult({ durationMs: 2_500, budgetMs: 2_000 })).toBe('warn')
    expect(classifyBenchmarkResult({ durationMs: 4_500, budgetMs: 2_000 })).toBe('fail')
  })
})
