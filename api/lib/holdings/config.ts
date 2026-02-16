export interface HoldingsConfig {
  envioGraphqlUrl: string
  envioPassword: string
  databaseUrl: string | null
  kongBaseUrl: string
  defillamaBaseUrl: string
  ydaemonBaseUrl: string
  historyDays: number
}

function getEnv(key: string, defaultValue: string): string {
  const value = process.env[key]
  return value ? value : defaultValue
}

function getEnvOrNull(key: string): string | null {
  const value = process.env[key]
  return value ? value : null
}

export const config: HoldingsConfig = {
  envioGraphqlUrl: getEnv('ENVIO_GRAPHQL_URL', 'http://localhost:8080/v1/graphql'),
  envioPassword: getEnv('ENVIO_PASSWORD', 'testing'),
  databaseUrl: getEnvOrNull('DATABASE_URL'),
  kongBaseUrl: 'https://kong.yearn.fi',
  defillamaBaseUrl: 'https://coins.llama.fi',
  ydaemonBaseUrl: 'https://ydaemon.yearn.fi',
  historyDays: 90
}

export function validateConfig(): void {
  if (!config.envioGraphqlUrl) {
    console.warn('[Holdings] ENVIO_GRAPHQL_URL not set, using default localhost:8080')
  }
  if (!config.databaseUrl) {
    console.warn('[Holdings] DATABASE_URL not set, caching disabled')
  }
}
