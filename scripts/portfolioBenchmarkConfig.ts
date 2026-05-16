export type TPortfolioBenchmarkWalletId = 'heavy' | 'medium' | 'light'

export type TPortfolioBenchmarkWallet = {
  id: TPortfolioBenchmarkWalletId
  label: string
  address: `0x${string}`
  description: string
  budgetMs: number
}

export type TPortfolioBenchmarkClassification = 'pass' | 'warn' | 'fail'

const MEDIUM_BENCHMARK_WALLET_ADDRESS = (process.env.HOLDINGS_TEST_WALLET_ADDRESS ??
  '0x1111111111111111111111111111111111111111') as `0x${string}`

export const BENCHMARK_WALLETS: TPortfolioBenchmarkWallet[] = [
  {
    id: 'heavy',
    label: 'Yearn Treasury',
    address: '0x93A62dA5a14C80f265DAbC077fCEE437B1a0Efde',
    description: 'Large historical Yearn portfolio; catches slow balance/history/protocol-return paths.',
    budgetMs: 15_000
  },
  {
    id: 'medium',
    label: 'SA Treasury',
    address: MEDIUM_BENCHMARK_WALLET_ADDRESS,
    description: 'Medium portfolio; catches common multi-vault loading regressions.',
    budgetMs: 8_000
  },
  {
    id: 'light',
    label: 'galloway.eth',
    address: '0x5b0D3243c78fB9d4AC035fB2384FFdf7A9eF6396',
    description: 'Small portfolio; catches shell and direct-load regressions that should be fast.',
    budgetMs: 4_000
  }
]

export function buildCodexPortfolioUrl(baseUrl: string, wallet: TPortfolioBenchmarkWallet): string {
  const url = new URL('/portfolio', baseUrl)
  url.searchParams.set('codexWallet', '1')
  url.searchParams.set('codexWalletAddress', wallet.address)
  return url.toString()
}

export function classifyBenchmarkResult({
  durationMs,
  budgetMs
}: {
  durationMs: number
  budgetMs: number
}): TPortfolioBenchmarkClassification {
  if (durationMs <= budgetMs) {
    return 'pass'
  }

  if (durationMs <= budgetMs * 2) {
    return 'warn'
  }

  return 'fail'
}
