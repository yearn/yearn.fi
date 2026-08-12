import { SUPPORTED_CHAINS } from '@/server/lib/holdings/types'

export type HoldingsLedgerMode = 'off' | 'shadow' | 'read-write'

export interface HoldingsConfig {
  readonly envioGraphqlUrl: string
  readonly envioPassword: string
  readonly redisUrl: string | null
  readonly redisToken: string | null
  readonly kongBaseUrl: string
  readonly yearnPricesBaseUrl: string
  readonly yearnPricesApiKey: string
  readonly defillamaBaseUrl: string
  readonly defillamaProBaseUrl: string
  readonly defillamaApiKey: string
  readonly historyDays: number
  readonly historyStartTimestamp: number
  readonly ledgerMode: HoldingsLedgerMode
  readonly ledgerChainIds: readonly number[]
  readonly ledgerOverlapBlocks: number
  readonly ledgerReconcileIntervalMs: number
  readonly ledgerSourceRevision: string
  readonly ledgerValuationRevision: string
}

const HISTORY_START_TIMESTAMP = 1_704_067_200 // 2024-01-01T00:00:00Z
const YEARN_PRICES_BASE_URL = 'https://prices.yearn.dev'
const DEFAULT_LEDGER_OVERLAP_BLOCKS = 50_000
const DEFAULT_LEDGER_RECONCILE_INTERVAL_SECONDS = 7 * 24 * 60 * 60
const DEFAULT_LEDGER_CHAIN_IDS = SUPPORTED_CHAINS.map(({ id }) => id).toSorted((left, right) => left - right)
const DEFAULT_LEDGER_OPERATOR_REVISION = 'default'
const LEDGER_OPERATOR_REVISION_PATTERN = /^[A-Za-z0-9._-]{1,96}$/

function parseBoundedPositiveInteger(value: string | undefined, fallback: number, maximum: number): number {
  const parsed = value && /^\d+$/.test(value.trim()) ? Number(value.trim()) : Number.NaN
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : fallback
}

export function parseHoldingsLedgerMode(value: string | undefined): HoldingsLedgerMode {
  const normalized = value?.trim().toLowerCase()
  return normalized === 'shadow' || normalized === 'read-write' ? normalized : 'off'
}

function parseHoldingsLedgerOperatorRevision(value: string | undefined): string {
  const normalized = value?.trim()
  return normalized && LEDGER_OPERATOR_REVISION_PATTERN.test(normalized) ? normalized : DEFAULT_LEDGER_OPERATOR_REVISION
}

export function parseHoldingsLedgerSourceRevision(value: string | undefined): string {
  return parseHoldingsLedgerOperatorRevision(value)
}

export function parseHoldingsLedgerValuationRevision(value: string | undefined): string {
  return parseHoldingsLedgerOperatorRevision(value)
}

function parseHoldingsLedgerChainIds(value: string | undefined): readonly number[] {
  if (!value?.trim()) {
    return DEFAULT_LEDGER_CHAIN_IDS
  }
  const parsed = value.split(',').map((entry) => (/^\d+$/.test(entry.trim()) ? Number(entry.trim()) : Number.NaN))
  return parsed.length > 0 && parsed.every((chainId) => Number.isSafeInteger(chainId) && chainId > 0)
    ? Array.from(new Set(parsed)).toSorted((left, right) => left - right)
    : DEFAULT_LEDGER_CHAIN_IDS
}

export const holdingsConfig: HoldingsConfig = {
  get envioGraphqlUrl() {
    return process.env.ENVIO_GRAPHQL_URL ?? 'http://localhost:8080/v1/graphql'
  },
  get envioPassword() {
    return process.env.ENVIO_PASSWORD ?? ''
  },
  get redisUrl() {
    return process.env.UPSTASH_REDIS_REST_URL_PORTFOLIO?.trim() || null
  },
  get redisToken() {
    return process.env.UPSTASH_REDIS_REST_TOKEN_PORTFOLIO?.trim() || null
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
  historyStartTimestamp: HISTORY_START_TIMESTAMP,
  get ledgerMode() {
    return parseHoldingsLedgerMode(process.env.HOLDINGS_LEDGER_MODE)
  },
  get ledgerChainIds() {
    return parseHoldingsLedgerChainIds(process.env.HOLDINGS_LEDGER_CHAIN_IDS)
  },
  get ledgerOverlapBlocks() {
    return parseBoundedPositiveInteger(
      process.env.HOLDINGS_LEDGER_OVERLAP_BLOCKS,
      DEFAULT_LEDGER_OVERLAP_BLOCKS,
      10_000_000
    )
  },
  get ledgerReconcileIntervalMs() {
    return (
      parseBoundedPositiveInteger(
        process.env.HOLDINGS_LEDGER_RECONCILE_INTERVAL_SECONDS,
        DEFAULT_LEDGER_RECONCILE_INTERVAL_SECONDS,
        365 * 24 * 60 * 60
      ) * 1000
    )
  },
  get ledgerSourceRevision() {
    return parseHoldingsLedgerSourceRevision(process.env.HOLDINGS_LEDGER_SOURCE_REVISION)
  },
  get ledgerValuationRevision() {
    return parseHoldingsLedgerValuationRevision(process.env.HOLDINGS_LEDGER_VALUATION_REVISION)
  }
}

export function validateConfig(): void {
  if (!process.env.ENVIO_GRAPHQL_URL) {
    console.warn('[Holdings] ENVIO_GRAPHQL_URL not set, using default localhost:8080')
  }
  if (!process.env.UPSTASH_REDIS_REST_URL_PORTFOLIO || !process.env.UPSTASH_REDIS_REST_TOKEN_PORTFOLIO) {
    console.warn(
      '[Holdings] UPSTASH_REDIS_REST_URL_PORTFOLIO / UPSTASH_REDIS_REST_TOKEN_PORTFOLIO not set, storage disabled'
    )
  }
}
