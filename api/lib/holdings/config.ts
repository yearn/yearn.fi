export interface HoldingsConfig {
  readonly envioGraphqlUrl: string
  readonly envioPassword: string
  readonly databaseUrl: string | null
  readonly kongBaseUrl: string
  readonly yearnPricesBaseUrl: string
  readonly yearnPricesApiKey: string
  readonly defillamaBaseUrl: string
  readonly defillamaProBaseUrl: string
  readonly defillamaApiKey: string
  readonly historyDays: number
  readonly historyStartTimestamp: number
}

const HISTORY_START_TIMESTAMP = 1_704_067_200 // 2024-01-01T00:00:00Z
const YEARN_PRICES_BASE_URL = 'https://prices.yearn.dev'

export const holdingsConfig: HoldingsConfig = {
  get envioGraphqlUrl() {
    return process.env.ENVIO_GRAPHQL_URL ?? 'http://localhost:8080/v1/graphql'
  },
  get envioPassword() {
    return process.env.ENVIO_PASSWORD ?? ''
  },
  get databaseUrl() {
    return process.env.DATABASE_URL_PREVIEW ?? process.env.DATABASE_URL ?? null
  },
  kongBaseUrl: 'https://kong.yearn.fi',
  get yearnPricesBaseUrl() {
    return (process.env.YEARN_PRICES_BASE_URL ?? process.env.YEARN_PRICES_API_URL ?? YEARN_PRICES_BASE_URL)
      .trim()
      .replace(/\/$/, '')
  },
  get yearnPricesApiKey() {
    return (process.env.YEARN_PRICES_API_KEY ?? process.env.API_KEY_PORTFOLIO ?? '').trim()
  },
  defillamaBaseUrl: 'https://coins.llama.fi',
  defillamaProBaseUrl: 'https://pro-api.llama.fi',
  get defillamaApiKey() {
    return process.env.DEFILLAMA_API_KEY?.trim() ?? ''
  },
  historyDays: 365,
  historyStartTimestamp: HISTORY_START_TIMESTAMP
}

export function validateConfig(): void {
  if (!process.env.ENVIO_GRAPHQL_URL) {
    console.warn('[Holdings] ENVIO_GRAPHQL_URL not set, using default localhost:8080')
  }
  if (!process.env.DATABASE_URL_PREVIEW && !process.env.DATABASE_URL) {
    console.warn('[Holdings] DATABASE_URL_PREVIEW / DATABASE_URL not set, caching disabled')
  }
}
