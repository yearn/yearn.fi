/// <reference types="node" />

import { resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseTenderlyServerChains, type TTenderlyServerChainConfig } from '../api/tenderly.helpers'
import { buildPredictablePublicRpcUrl, readEnvFile, sanitizeConsoleText } from './tenderly-vnet'

type TParsedCliArgs = {
  flags: Record<string, string>
  positionals: string[]
}

type TTenderlyProfile = 'webops' | 'personal'

type TTenderlyStatusIdentity = {
  profile: TTenderlyProfile
  accountSlug: string
  projectSlug: string
  apiKey?: string
  rpcName?: string
}

type TTenderlyVnetRpc = {
  name?: string
  url?: string
}

type TTenderlyVnetRecord = {
  id?: string
  slug?: string
  display_name?: string
  status?: string
  fork_config?: {
    network_id?: number | string
    block_number?: number | string
  }
  virtual_network_config?: {
    chain_config?: {
      chain_id?: number | string
    }
  }
  explorer_page_config?: {
    enabled?: boolean
  }
  rpcs?: TTenderlyVnetRpc[]
}

type TTenderlyStatusMatchReason = 'admin-rpc' | 'public-rpc' | 'execution-chain-id' | 'single-vnet-fallback'

type TTenderlyMatchedVnet = {
  record: TTenderlyVnetRecord
  reason: TTenderlyStatusMatchReason
}

type TTenderlyChainLiveState = {
  liveExecutionChainId: number
  currentBlockNumber: number
  latestBlockTimestampSeconds: number
}

type TTenderlyVnetTransactionRecord = {
  id?: string
  vnet_id?: string
  origin?: string
  category?: string
  kind?: string
  status?: string
  rpc_method?: string
  created_at?: string
  block_number?: number | string
  block_hash?: string
  tx_hash?: string
  tx_index?: number | string
  from?: string
  to?: string
  function_name?: string
  dashboard_url?: string
}

type TTenderlyRecentTransaction = {
  id?: string
  status: string
  category?: string
  kind?: string
  rpcMethod?: string
  functionName?: string
  createdAt?: string
  createdAtAgeLabel?: string
  blockNumber?: number
  txHash?: string
  from?: string
  to?: string
}

type TTenderlyStatusChainReport = {
  canonicalChainId: number
  canonicalChainName: string
  configuredExecutionChainId: number
  liveExecutionChainId: number
  currentBlockNumber: number
  latestBlockTimestampSeconds: number
  latestBlockTimestampLabel: string
  latestBlockAgeLabel: string
  publicRpcUri: string
  publicRpcMode: 'stable named endpoint' | 'dynamic endpoint'
  publicRpcName?: string
  hasAdminRpc: boolean
  explorerEnabled: boolean
  explorerUri?: string
  totalTransactionsAvailable: boolean
  totalTransactionsCount?: number
  totalTransactionsNote?: string
  recentTransactionsAvailable: boolean
  recentTransactionsNote?: string
  recentTransactions: TTenderlyRecentTransaction[]
  matchedVnet?: {
    id?: string
    slug?: string
    displayName?: string
    status?: string
    forkNetworkId?: number
    forkBlockNumber?: number
  }
  matchReason?: TTenderlyStatusMatchReason
}

type TTenderlyStatusReport = {
  profile: TTenderlyProfile
  accountSlug: string
  projectSlug: string
  restMetadataAvailable: boolean
  restMetadataNote?: string
  recentTransactionCount: number
  chainReports: TTenderlyStatusChainReport[]
}

const DEFAULT_ACCOUNT_SLUG = 'me'
const DEFAULT_RECENT_TRANSACTION_COUNT = 5
const TENDERLY_TRANSACTION_PAGE_SIZE = 100
const TENDERLY_TRANSACTION_MAX_PAGES = 100
const TENDERLY_API_URL = 'https://api.tenderly.co/api/v1/account'
const PROFILE_DEFAULTS = {
  personal: {
    apiKeyEnv: 'PERSONAL_TENDERLY_API_KEY',
    accountEnvKeys: ['PERSONAL_ACCOUNT_SLUG', 'ACCOUNT_SLUG'],
    projectEnvKeys: ['PERSONAL_PROJECT_SLUG', 'PROJECT_SLUG'],
    rpcNameEnv: 'PERSONAL_TENDERLY_RPC_NAME'
  },
  webops: {
    apiKeyEnv: 'WEBOPS_TENDERLY_API_KEY',
    accountEnvKeys: ['WEBOPS_ACCOUNT_SLUG', 'TENDERLY_ACCOUNT_SLUG'],
    projectEnvKeys: ['WEBOPS_PROJECT_SLUG', 'TENDERLY_PROJECT_SLUG'],
    rpcNameEnv: 'WEBOPS_TENDERLY_RPC_NAME'
  }
} as const

const HELP_TEXT = `Tenderly Virtual TestNet status

Usage:
  bun scripts/tenderly-vnet-status.ts [options]

Options:
  --profile <name>      Credential profile: webops or personal (default: webops)
  --chain <id>          Canonical chain id to inspect (default: all configured Tenderly chains)
  --account <slug>      Tenderly account slug override
  --project <slug>      Tenderly project slug override
  --api-key <key>       Tenderly API key override for metadata lookup
  --api-key-env <name>  Env var name to read the API key from
  --account-env <name>  Env var name to read the account slug from
  --project-env <name>  Env var name to read the project slug from
  --rpc-name <name>     Stable public RPC name override
  --recent-tx-count <n> Number of recent transactions to include per chain (default: 5)
  --json                Print a sanitized JSON report instead of Markdown
  --help                Show this help text

Notes:
  - Reads the active Tenderly mapping from repo .env and process.env.
  - Uses Admin RPC for live chain state.
  - Uses the Tenderly REST API for VNet metadata when credentials are available.
  - Never prints API keys or admin RPC URLs.
`

function parseCliArgs(argv: readonly string[]): TParsedCliArgs {
  const recurse = (index: number, accumulator: TParsedCliArgs): TParsedCliArgs => {
    if (index >= argv.length) {
      return accumulator
    }

    const token = argv[index]
    if (!token.startsWith('--')) {
      return recurse(index + 1, {
        flags: accumulator.flags,
        positionals: [...accumulator.positionals, token]
      })
    }

    const key = token.slice(2)
    const nextToken = argv[index + 1]
    const value = nextToken && !nextToken.startsWith('--') ? nextToken : 'true'
    const nextIndex = value === 'true' ? index + 1 : index + 2

    return recurse(nextIndex, {
      positionals: accumulator.positionals,
      flags: {
        ...accumulator.flags,
        [key]: value
      }
    })
  }

  return recurse(0, { flags: {}, positionals: [] })
}

function getArg(flags: Record<string, string>, ...keys: string[]): string | undefined {
  return keys.map((key) => flags[key]?.trim()).find(Boolean)
}

function getEnvValue(env: Record<string, string | undefined>, key?: string): string | undefined {
  if (!key) {
    return undefined
  }
  return env[key]?.trim()
}

function getFirstEnvValue(env: Record<string, string | undefined>, keys: string[]): string | undefined {
  return keys.map((key) => getEnvValue(env, key)).find(Boolean)
}

function parseProfile(value: string | undefined): TTenderlyProfile {
  const normalizedValue = value?.trim().toLowerCase()

  if (!normalizedValue) {
    return 'webops'
  }

  if (normalizedValue === 'webops' || normalizedValue === 'personal') {
    return normalizedValue
  }

  throw new Error(`Unsupported profile: ${value}. Expected "webops" or "personal".`)
}

function parseOptionalInteger(value: string | undefined, label: string): number | undefined {
  if (!value) {
    return undefined
  }

  const parsedValue = Number(value)
  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`Invalid ${label}: ${value}`)
  }

  return parsedValue
}

function parseRecentTransactionCount(flags: Record<string, string>): number {
  const parsedValue =
    parseOptionalInteger(getArg(flags, 'recent-tx-count', 'recent-transactions'), 'recent transaction count') ||
    DEFAULT_RECENT_TRANSACTION_COUNT

  return Math.min(Math.max(parsedValue, 1), 20)
}

export function resolveTenderlyStatusIdentity(
  flags: Record<string, string>,
  env: Record<string, string | undefined>
): TTenderlyStatusIdentity {
  const profile = parseProfile(getArg(flags, 'profile'))
  const defaults = PROFILE_DEFAULTS[profile]
  const accountEnv = getArg(flags, 'account-env')
  const projectEnv = getArg(flags, 'project-env')
  const apiKeyEnv = getArg(flags, 'api-key-env')

  return {
    profile,
    accountSlug:
      getArg(flags, 'account') ||
      getEnvValue(env, accountEnv) ||
      getFirstEnvValue(env, [...defaults.accountEnvKeys]) ||
      DEFAULT_ACCOUNT_SLUG,
    projectSlug:
      getArg(flags, 'project') ||
      getEnvValue(env, projectEnv) ||
      getFirstEnvValue(env, [...defaults.projectEnvKeys]) ||
      '',
    apiKey:
      getArg(flags, 'api-key') ||
      getEnvValue(env, apiKeyEnv) ||
      getEnvValue(env, defaults.apiKeyEnv) ||
      env.TENDERLY_ACCESS_KEY?.trim() ||
      env.TENDERLY_API_KEY?.trim(),
    rpcName: getArg(flags, 'rpc-name') || getEnvValue(env, defaults.rpcNameEnv) || env.TENDERLY_RPC_NAME?.trim()
  }
}

export function normalizeTenderlyVnetListResponse(payload: unknown): TTenderlyVnetRecord[] {
  if (Array.isArray(payload)) {
    return payload as TTenderlyVnetRecord[]
  }

  if (!payload || typeof payload !== 'object') {
    return []
  }

  const record = payload as Record<string, unknown>
  return (
    [record.virtual_networks, record.vnets]
      .find(Array.isArray)
      ?.filter(Boolean)
      .map((item) => item as TTenderlyVnetRecord) || []
  )
}

export function normalizeTenderlyTransactionListResponse(payload: unknown): TTenderlyVnetTransactionRecord[] {
  if (Array.isArray(payload)) {
    return payload as TTenderlyVnetTransactionRecord[]
  }

  if (!payload || typeof payload !== 'object') {
    return []
  }

  const record = payload as Record<string, unknown>
  return (
    [record.transactions, record.results, record.data]
      .find(Array.isArray)
      ?.filter(Boolean)
      .map((item) => item as TTenderlyVnetTransactionRecord) || []
  )
}

function resolveVnetRpcUrl(vnet: TTenderlyVnetRecord, rpcName: string): string | undefined {
  return vnet.rpcs?.find((rpc) => rpc.name === rpcName)?.url
}

function parseNumericString(value: number | string | undefined): number | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }

  const normalizedValue = value.trim()
  if (!normalizedValue) {
    return undefined
  }

  return normalizedValue.startsWith('0x') ? Number(BigInt(normalizedValue)) : Number(normalizedValue)
}

export function selectMatchingTenderlyVnet(params: {
  vnets: TTenderlyVnetRecord[]
  adminRpcUri?: string
  publicRpcUri?: string
  executionChainId: number
}): TTenderlyMatchedVnet | undefined {
  const adminRpcMatch = params.adminRpcUri
    ? params.vnets.find((vnet) => resolveVnetRpcUrl(vnet, 'Admin RPC') === params.adminRpcUri)
    : undefined

  if (adminRpcMatch) {
    return { record: adminRpcMatch, reason: 'admin-rpc' }
  }

  const publicRpcMatch = params.publicRpcUri
    ? params.vnets.find((vnet) => resolveVnetRpcUrl(vnet, 'Public RPC') === params.publicRpcUri)
    : undefined

  if (publicRpcMatch) {
    return { record: publicRpcMatch, reason: 'public-rpc' }
  }

  const executionChainMatch = params.vnets.find(
    (vnet) => parseNumericString(vnet.virtual_network_config?.chain_config?.chain_id) === params.executionChainId
  )

  if (executionChainMatch) {
    return { record: executionChainMatch, reason: 'execution-chain-id' }
  }

  return params.vnets.length === 1 ? { record: params.vnets[0], reason: 'single-vnet-fallback' } : undefined
}

export function classifyPublicRpcMode(params: {
  accountSlug: string
  projectSlug: string
  rpcName?: string
  publicRpcUri: string
}): 'stable named endpoint' | 'dynamic endpoint' {
  if (resolveStableNamedPublicRpcName(params)) {
    return 'stable named endpoint'
  }

  if (!params.rpcName) {
    return 'dynamic endpoint'
  }

  const predictablePublicRpc = buildPredictablePublicRpcUrl(params.accountSlug, params.projectSlug, params.rpcName)
  return predictablePublicRpc === params.publicRpcUri ? 'stable named endpoint' : 'dynamic endpoint'
}

export function resolveStableNamedPublicRpcName(params: {
  accountSlug: string
  projectSlug: string
  rpcName?: string
  publicRpcUri: string
}): string | undefined {
  try {
    const parsedUrl = new URL(params.publicRpcUri)
    if (parsedUrl.hostname !== 'virtual.rpc.tenderly.co') {
      return undefined
    }

    const pathSegments = parsedUrl.pathname.split('/').filter(Boolean)
    if (pathSegments.length !== 4) {
      return undefined
    }

    const [accountSlug, projectSlug, visibility, rpcName] = pathSegments
    if (
      accountSlug !== params.accountSlug ||
      projectSlug !== params.projectSlug ||
      visibility !== 'public' ||
      !rpcName
    ) {
      return undefined
    }

    return rpcName
  } catch {
    return undefined
  }
}

function formatTimestampUtc(timestampSeconds: number): string {
  return new Date(timestampSeconds * 1000)
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, ' UTC')
}

function formatRelativeAgeLabel(timestampSeconds: number): string {
  const elapsedSeconds = Math.max(0, Math.round(Date.now() / 1000 - timestampSeconds))

  if (elapsedSeconds < 60) {
    return `${elapsedSeconds}s`
  }

  if (elapsedSeconds < 3_600) {
    return `${Math.round(elapsedSeconds / 60)}m`
  }

  if (elapsedSeconds < 86_400) {
    return `${Math.round(elapsedSeconds / 3_600)}h`
  }

  return `${Math.round(elapsedSeconds / 86_400)}d`
}

function formatIsoAgeLabel(isoTimestamp: string | undefined): string | undefined {
  if (!isoTimestamp) {
    return undefined
  }

  const timestampMs = Date.parse(isoTimestamp)
  if (!Number.isFinite(timestampMs)) {
    return undefined
  }

  return formatRelativeAgeLabel(Math.round(timestampMs / 1000))
}

function shortenHex(value: string | undefined, prefixLength: number, suffixLength: number): string {
  if (!value) {
    return 'n/a'
  }

  const normalizedValue = value.trim()
  if (normalizedValue.length <= prefixLength + suffixLength + 1) {
    return normalizedValue
  }

  return `${normalizedValue.slice(0, prefixLength)}…${normalizedValue.slice(-suffixLength)}`
}

function formatTransactionLabel(transaction: TTenderlyRecentTransaction): string {
  return transaction.functionName || transaction.rpcMethod || transaction.kind || transaction.category || 'unknown'
}

function formatRecentTransactionRow(transaction: TTenderlyRecentTransaction): string {
  return `| ${transaction.createdAtAgeLabel || 'n/a'} | ${transaction.status} | ${
    transaction.blockNumber?.toLocaleString('en-US') || 'n/a'
  } | ${formatTransactionLabel(transaction)} | ${shortenHex(transaction.from, 8, 4)} | ${shortenHex(
    transaction.to,
    8,
    4
  )} | ${shortenHex(transaction.txHash, 10, 6)} |`
}

async function fetchJsonRpcResult<T>(adminRpcUri: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(adminRpcUri, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      method,
      params
    })
  })

  if (!response.ok) {
    throw new Error(`Tenderly Admin RPC request failed (${response.status})`)
  }

  const payload = (await response.json()) as { result?: T; error?: { code: number; message: string } } | undefined

  if (payload?.error) {
    throw new Error(sanitizeConsoleText(`${payload.error.message} (code ${payload.error.code})`))
  }

  return payload?.result as T
}

async function fetchTenderlyVnets(identity: TTenderlyStatusIdentity): Promise<TTenderlyVnetRecord[]> {
  if (!identity.apiKey || !identity.projectSlug) {
    return []
  }

  const response = await fetch(
    `${TENDERLY_API_URL}/${encodeURIComponent(identity.accountSlug)}/project/${encodeURIComponent(identity.projectSlug)}/vnets`,
    {
      headers: {
        Accept: 'application/json',
        'X-Access-Key': identity.apiKey
      }
    }
  )

  if (!response.ok) {
    throw new Error(`Tenderly REST API request failed (${response.status})`)
  }

  return normalizeTenderlyVnetListResponse(await response.json())
}

async function fetchTenderlyRecentTransactions(params: {
  identity: TTenderlyStatusIdentity
  vnetId?: string
  recentCount: number
}): Promise<{
  recentTransactions: TTenderlyRecentTransaction[]
  totalTransactionsCount: number
  totalTransactionsNote?: string
}> {
  if (!params.identity.apiKey || !params.identity.projectSlug || !params.vnetId) {
    return {
      recentTransactions: [],
      totalTransactionsCount: 0
    }
  }

  const recentTransactions: TTenderlyRecentTransaction[] = []
  let totalTransactionsCount = 0

  for (let page = 1; page <= TENDERLY_TRANSACTION_MAX_PAGES; page += 1) {
    const response = await fetch(
      `${TENDERLY_API_URL}/${encodeURIComponent(params.identity.accountSlug)}/project/${encodeURIComponent(
        params.identity.projectSlug
      )}/vnets/${encodeURIComponent(params.vnetId)}/transactions?page=${page}&per_page=${TENDERLY_TRANSACTION_PAGE_SIZE}`,
      {
        headers: {
          Accept: 'application/json',
          'X-Access-Key': params.identity.apiKey
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Tenderly recent transactions request failed (${response.status})`)
    }

    const pageTransactions = normalizeTenderlyTransactionListResponse(await response.json()).map((transaction) => ({
      id: transaction.id,
      status: transaction.status || 'unknown',
      category: transaction.category,
      kind: transaction.kind,
      rpcMethod: transaction.rpc_method,
      functionName: transaction.function_name,
      createdAt: transaction.created_at,
      createdAtAgeLabel: formatIsoAgeLabel(transaction.created_at),
      blockNumber: parseNumericString(transaction.block_number),
      txHash: transaction.tx_hash,
      from: transaction.from,
      to: transaction.to
    }))

    totalTransactionsCount += pageTransactions.length

    if (page === 1) {
      recentTransactions.push(...pageTransactions.slice(0, params.recentCount))
    }

    if (pageTransactions.length < TENDERLY_TRANSACTION_PAGE_SIZE) {
      return {
        recentTransactions,
        totalTransactionsCount
      }
    }
  }

  const totalTransactionsNote = `count truncated after ${(
    TENDERLY_TRANSACTION_MAX_PAGES * TENDERLY_TRANSACTION_PAGE_SIZE
  ).toLocaleString('en-US')} transactions`

  return {
    recentTransactions,
    totalTransactionsCount,
    totalTransactionsNote
  }
}

async function fetchTenderlyChainLiveState(chain: TTenderlyServerChainConfig): Promise<TTenderlyChainLiveState> {
  const [chainIdHex, blockNumberHex, latestBlock] = await Promise.all([
    fetchJsonRpcResult<string>(chain.adminRpcUri || '', 'eth_chainId', []),
    fetchJsonRpcResult<string>(chain.adminRpcUri || '', 'eth_blockNumber', []),
    fetchJsonRpcResult<{ timestamp?: string }>(chain.adminRpcUri || '', 'eth_getBlockByNumber', ['latest', false])
  ])

  const liveExecutionChainId = Number(BigInt(chainIdHex))
  const currentBlockNumber = Number(BigInt(blockNumberHex))
  const latestBlockTimestampSeconds = Number(BigInt(latestBlock.timestamp || '0x0'))

  return {
    liveExecutionChainId,
    currentBlockNumber,
    latestBlockTimestampSeconds
  }
}

function buildChainReport(params: {
  identity: TTenderlyStatusIdentity
  chain: TTenderlyServerChainConfig
  liveState: TTenderlyChainLiveState
  matchedVnet?: TTenderlyMatchedVnet
  recentTransactionsResult:
    | {
        recentTransactionsAvailable: true
        totalTransactionsCount: number
        totalTransactionsNote?: string
        recentTransactions: TTenderlyRecentTransaction[]
        recentTransactionsNote?: string
      }
    | {
        recentTransactionsAvailable: false
        totalTransactionsCount?: number
        totalTransactionsNote?: string
        recentTransactions: TTenderlyRecentTransaction[]
        recentTransactionsNote?: string
      }
  env: Record<string, string | undefined>
}): TTenderlyStatusChainReport {
  const explorerUri = params.env[`VITE_TENDERLY_EXPLORER_URI_FOR_${params.chain.canonicalChainId}`]?.trim() || undefined
  const forkNetworkId = parseNumericString(params.matchedVnet?.record.fork_config?.network_id)
  const forkBlockNumber = parseNumericString(params.matchedVnet?.record.fork_config?.block_number)

  return {
    canonicalChainId: params.chain.canonicalChainId,
    canonicalChainName: params.chain.canonicalChainName,
    configuredExecutionChainId: params.chain.executionChainId,
    liveExecutionChainId: params.liveState.liveExecutionChainId,
    currentBlockNumber: params.liveState.currentBlockNumber,
    latestBlockTimestampSeconds: params.liveState.latestBlockTimestampSeconds,
    latestBlockTimestampLabel: formatTimestampUtc(params.liveState.latestBlockTimestampSeconds),
    latestBlockAgeLabel: formatRelativeAgeLabel(params.liveState.latestBlockTimestampSeconds),
    publicRpcUri: params.chain.rpcUri,
    publicRpcName: resolveStableNamedPublicRpcName({
      accountSlug: params.identity.accountSlug,
      projectSlug: params.identity.projectSlug,
      rpcName: params.identity.rpcName,
      publicRpcUri: params.chain.rpcUri
    }),
    publicRpcMode: classifyPublicRpcMode({
      accountSlug: params.identity.accountSlug,
      projectSlug: params.identity.projectSlug,
      rpcName: params.identity.rpcName,
      publicRpcUri: params.chain.rpcUri
    }),
    hasAdminRpc: Boolean(params.chain.adminRpcUri),
    explorerEnabled: Boolean(params.matchedVnet?.record.explorer_page_config?.enabled || explorerUri),
    explorerUri,
    totalTransactionsAvailable: params.recentTransactionsResult.recentTransactionsAvailable,
    totalTransactionsCount: params.recentTransactionsResult.totalTransactionsCount,
    totalTransactionsNote: params.recentTransactionsResult.totalTransactionsNote,
    recentTransactionsAvailable: params.recentTransactionsResult.recentTransactionsAvailable,
    recentTransactionsNote: params.recentTransactionsResult.recentTransactionsNote,
    recentTransactions: params.recentTransactionsResult.recentTransactions,
    matchedVnet: params.matchedVnet
      ? {
          id: params.matchedVnet.record.id,
          slug: params.matchedVnet.record.slug,
          displayName: params.matchedVnet.record.display_name,
          status: params.matchedVnet.record.status,
          forkNetworkId,
          forkBlockNumber
        }
      : undefined,
    matchReason: params.matchedVnet?.reason
  }
}

export function buildTenderlyStatusMarkdown(report: TTenderlyStatusReport): string {
  const headerLines = [
    '# Tenderly VNet Status',
    '',
    `Profile: ${report.profile}`,
    `Account / Project: ${report.accountSlug} / ${report.projectSlug || '[unset]'}`,
    `Metadata: ${report.restMetadataAvailable ? 'available' : report.restMetadataNote || 'unavailable'}`
  ]

  const chainSections = report.chainReports.flatMap((chainReport) => {
    const transactionSection =
      chainReport.recentTransactions.length > 0
        ? [
            '',
            `Most Recent Transactions (${Math.min(chainReport.recentTransactions.length, report.recentTransactionCount)} shown):`,
            '',
            '| Age | Status | Block | Method | From | To | Tx Hash |',
            '| --- | --- | ---: | --- | --- | --- | --- |',
            ...chainReport.recentTransactions.map(formatRecentTransactionRow)
          ]
        : [
            '',
            `Most Recent Transactions: ${
              chainReport.recentTransactionsAvailable
                ? chainReport.recentTransactionsNote || 'none'
                : chainReport.recentTransactionsNote || 'unavailable'
            }`
          ]

    return [
      '',
      `## ${chainReport.canonicalChainName} (${chainReport.canonicalChainId})`,
      `ID: ${chainReport.matchedVnet?.slug || 'metadata unavailable'}`,
      `UUID: ${chainReport.matchedVnet?.id || 'metadata unavailable'}`,
      `Display Name: ${chainReport.matchedVnet?.displayName || 'metadata unavailable'}`,
      `Chain ID: ${chainReport.liveExecutionChainId}`,
      `Configured Chain ID: ${chainReport.configuredExecutionChainId}`,
      `Public RPC: ${chainReport.publicRpcUri}`,
      `Public RPC Mode: ${
        chainReport.publicRpcName
          ? `${chainReport.publicRpcMode} (${chainReport.publicRpcName})`
          : chainReport.publicRpcMode
      }`,
      `Current Block: ${chainReport.currentBlockNumber.toLocaleString('en-US')}`,
      `Total Transactions: ${
        chainReport.totalTransactionsAvailable
          ? `${chainReport.totalTransactionsCount?.toLocaleString('en-US') || 0}${
              chainReport.totalTransactionsNote ? ` (${chainReport.totalTransactionsNote})` : ''
            }`
          : chainReport.totalTransactionsNote || 'unavailable'
      }`,
      `Latest Block Time: ${chainReport.latestBlockTimestampLabel}`,
      `Block Age: ~${chainReport.latestBlockAgeLabel}`,
      `Fork: ${
        chainReport.matchedVnet?.forkNetworkId && chainReport.matchedVnet?.forkBlockNumber
          ? `${chainReport.matchedVnet.forkNetworkId} @ ${chainReport.matchedVnet.forkBlockNumber.toLocaleString('en-US')}`
          : 'metadata unavailable'
      }`,
      `Admin RPC: ${chainReport.hasAdminRpc ? 'configured' : 'missing'}`,
      `Explorer: ${chainReport.explorerEnabled ? chainReport.explorerUri || 'enabled' : 'disabled'}`,
      `Repo Mapping: ${chainReport.matchReason ? `matched via ${chainReport.matchReason}` : 'configured'}`,
      ...transactionSection
    ]
  })

  return [...headerLines, ...chainSections].join('\n')
}

export function buildTenderlyStatusJson(report: TTenderlyStatusReport): Record<string, unknown> {
  return {
    profile: report.profile,
    accountSlug: report.accountSlug,
    projectSlug: report.projectSlug,
    restMetadataAvailable: report.restMetadataAvailable,
    restMetadataNote: report.restMetadataNote || null,
    recentTransactionCount: report.recentTransactionCount,
    chains: report.chainReports.map((chainReport) => ({
      canonicalChainId: chainReport.canonicalChainId,
      canonicalChainName: chainReport.canonicalChainName,
      configuredExecutionChainId: chainReport.configuredExecutionChainId,
      liveExecutionChainId: chainReport.liveExecutionChainId,
      currentBlockNumber: chainReport.currentBlockNumber,
      latestBlockTimestampSeconds: chainReport.latestBlockTimestampSeconds,
      latestBlockTimestampLabel: chainReport.latestBlockTimestampLabel,
      latestBlockAgeLabel: chainReport.latestBlockAgeLabel,
      publicRpcUri: chainReport.publicRpcUri,
      publicRpcMode: chainReport.publicRpcMode,
      publicRpcName: chainReport.publicRpcName || null,
      hasAdminRpc: chainReport.hasAdminRpc,
      explorerEnabled: chainReport.explorerEnabled,
      explorerUri: chainReport.explorerUri || null,
      totalTransactionsAvailable: chainReport.totalTransactionsAvailable,
      totalTransactionsCount: chainReport.totalTransactionsCount ?? null,
      totalTransactionsNote: chainReport.totalTransactionsNote || null,
      recentTransactionsAvailable: chainReport.recentTransactionsAvailable,
      recentTransactionsNote: chainReport.recentTransactionsNote || null,
      recentTransactions: chainReport.recentTransactions,
      matchedVnet: chainReport.matchedVnet || null,
      matchReason: chainReport.matchReason || null
    }))
  }
}

async function buildTenderlyStatusReport(
  flags: Record<string, string>,
  env: Record<string, string | undefined>
): Promise<TTenderlyStatusReport> {
  const identity = resolveTenderlyStatusIdentity(flags, env)
  const recentTransactionCount = parseRecentTransactionCount(flags)
  if (!identity.projectSlug) {
    throw new Error(`Missing required value: ${identity.profile} project slug`)
  }

  const requestedChainId = parseOptionalInteger(getArg(flags, 'chain'), 'chain')
  const configuredChains = parseTenderlyServerChains(env).filter(
    (chain) => requestedChainId === undefined || chain.canonicalChainId === requestedChainId
  )

  if (configuredChains.length === 0) {
    throw new Error(
      requestedChainId === undefined
        ? 'No Tenderly chains are configured in the current environment'
        : `Tenderly chain ${requestedChainId} is not configured`
    )
  }

  const vnetResult = await fetchTenderlyVnets(identity)
    .then((vnets) => ({
      vnets,
      restMetadataAvailable: vnets.length > 0,
      restMetadataNote: vnets.length > 0 ? undefined : 'available but empty'
    }))
    .catch((error) => ({
      vnets: [] as TTenderlyVnetRecord[],
      restMetadataAvailable: false,
      restMetadataNote: sanitizeConsoleText(error instanceof Error ? error.message : String(error))
    }))

  const chainReports = await Promise.all(
    configuredChains.map(async (chain) => {
      const matchedVnet = selectMatchingTenderlyVnet({
        vnets: vnetResult.vnets,
        adminRpcUri: chain.adminRpcUri,
        publicRpcUri: chain.rpcUri,
        executionChainId: chain.executionChainId
      })
      const [liveState, recentTransactionsResult] = await Promise.all([
        fetchTenderlyChainLiveState(chain),
        fetchTenderlyRecentTransactions({
          identity,
          vnetId: matchedVnet?.record.id,
          recentCount: recentTransactionCount
        })
          .then(({ recentTransactions, totalTransactionsCount, totalTransactionsNote }) => ({
            recentTransactionsAvailable: true as const,
            totalTransactionsCount,
            totalTransactionsNote,
            recentTransactions,
            recentTransactionsNote: recentTransactions.length > 0 ? undefined : 'none'
          }))
          .catch((error) => ({
            recentTransactionsAvailable: false as const,
            totalTransactionsCount: undefined,
            totalTransactionsNote: sanitizeConsoleText(error instanceof Error ? error.message : String(error)),
            recentTransactions: [] as TTenderlyRecentTransaction[],
            recentTransactionsNote: sanitizeConsoleText(error instanceof Error ? error.message : String(error))
          }))
      ])

      return buildChainReport({
        identity,
        chain,
        liveState,
        matchedVnet,
        recentTransactionsResult,
        env
      })
    })
  )

  return {
    profile: identity.profile,
    accountSlug: identity.accountSlug,
    projectSlug: identity.projectSlug,
    restMetadataAvailable: vnetResult.restMetadataAvailable,
    restMetadataNote: vnetResult.restMetadataNote,
    recentTransactionCount,
    chainReports
  }
}

async function main(): Promise<void> {
  const parsedArgs = parseCliArgs(process.argv.slice(2))
  const { flags } = parsedArgs

  if ('help' in flags || 'h' in flags) {
    console.log(HELP_TEXT)
    return
  }

  const scriptDir = resolvePath(fileURLToPath(import.meta.url), '..')
  const envFromFile = readEnvFile(resolvePath(scriptDir, '../.env'))
  const env = { ...envFromFile, ...process.env }
  const report = await buildTenderlyStatusReport(flags, env)

  if ('json' in flags) {
    console.log(JSON.stringify(buildTenderlyStatusJson(report), null, 2))
    return
  }

  console.log(buildTenderlyStatusMarkdown(report))
}

main().catch((error) => {
  console.error(error instanceof Error ? sanitizeConsoleText(error.message) : sanitizeConsoleText(String(error)))
  process.exitCode = 1
})
