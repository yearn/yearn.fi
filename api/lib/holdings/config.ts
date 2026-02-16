export interface HoldingsConfig {
  readonly envioGraphqlUrl: string
  readonly envioPassword: string
  readonly databaseUrl: string | null
  readonly kongBaseUrl: string
  readonly defillamaBaseUrl: string
  readonly ydaemonBaseUrl: string
  readonly historyDays: number
}

export const config: HoldingsConfig = {
  get envioGraphqlUrl() {
    return process.env.ENVIO_GRAPHQL_URL ?? 'http://localhost:8080/v1/graphql'
  },
  get envioPassword() {
    return process.env.ENVIO_PASSWORD ?? 'testing'
  },
  get databaseUrl() {
    return process.env.DATABASE_URL ?? null
  },
  kongBaseUrl: 'https://kong.yearn.fi',
  defillamaBaseUrl: 'https://coins.llama.fi',
  ydaemonBaseUrl: 'https://ydaemon.yearn.fi',
  historyDays: 90
}

export function validateConfig(): void {
  if (!process.env.ENVIO_GRAPHQL_URL) {
    console.warn('[Holdings] ENVIO_GRAPHQL_URL not set, using default localhost:8080')
  }
  if (!process.env.DATABASE_URL) {
    console.warn('[Holdings] DATABASE_URL not set, caching disabled')
  }
}
