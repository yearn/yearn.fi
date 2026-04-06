/// <reference types="node" />

import { accessSync, chmodSync, constants, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

type TParsedCliArgs = {
  flags: Record<string, string>
  positionals: string[]
}

type TTenderlyProfile = 'webops' | 'personal'

type TResolvedTenderlyCredentials = {
  apiKey: string
  accountSlug: string
  projectSlug: string
  profile: TTenderlyProfile
}

type TTenderlyVnetResponse = {
  slug?: string
  display_name?: string
  chain_id?: number
  network_id?: number
  id?: string
  rpcs?: Array<{
    name: string
    url: string
  }>
  [key: string]: unknown
}

type TTenderlyVnetConnectionDetails = {
  adminRpc?: string
  publicRpc?: string
  predictablePublicRpc?: string
  explorerUri?: string
}

type TCreateVnetPayload = {
  slug: string
  display_name: string
  fork_config: {
    network_id: number
    block_number: string
  }
  virtual_network_config: {
    chain_config: {
      chain_id: number
    }
  }
  sync_state_config: {
    enabled: boolean
    commitment_level: 'latest'
  }
  explorer_page_config: {
    enabled: boolean
    verification_visibility: 'bytecode'
  }
  rpc_config?: {
    rpc_name: string
  }
}

const DEFAULT_ACCOUNT_SLUG = 'me'
const DEFAULT_NETWORK_ID = 1
const DEFAULT_CHAIN_ID_PREFIX = '69420'
const TENDERLY_API_URL = 'https://api.tenderly.co/api/v1/account'
const REDACTED_URL = '[redacted-url]'

const HELP_TEXT = `Tenderly Virtual TestNet bootstrap

Usage:
  bun run scripts/tenderly-vnet.ts [options]

Options:
  --profile <name>       Credential profile: webops or personal (default: webops)
  --account <slug>        Tenderly account slug (defaults to TENDERLY_ACCOUNT_SLUG, then me)
  --project <slug>        Tenderly project slug (defaults from selected profile env vars)
  --api-key <key>         Tenderly API key override
  --api-key-env <name>    Env var name to read the API key from
  --account-env <name>    Env var name to read the account slug from
  --project-env <name>    Env var name to read the project slug from
  --slug <slug>           VNet slug (default: vnet-<timestamp>)
  --display-name <name>    VNet display name (default: Webops VNet)
  --network-id <id>       Parent network id (default: 1)
  --block-number <num>    Fork block number or latest (default: latest)
  --chain-id <id>         Execution chain id (default: 69420<network-id>)
  --rpc-name <name>       Stable public RPC name for predictable endpoint reuse
  --enable-sync           Enable state sync (default: false)
  --enable-explorer       Enable public explorer (default: false)
  --json                  Print a sanitized JSON summary
  --write-env <path>      Write the generated Tenderly env fragment to a local file
  --write-response <path> Write the raw Tenderly API response JSON to a local file
  --help                  Show this help text

Profiles:
  webops   -> WEBOPS_TENDERLY_API_KEY, TENDERLY_ACCOUNT_SLUG, TENDERLY_PROJECT_SLUG, WEBOPS_TENDERLY_RPC_NAME
  personal -> PERSONAL_TENDERLY_API_KEY, PERSONAL_ACCOUNT_SLUG, PERSONAL_PROJECT_SLUG, PERSONAL_TENDERLY_RPC_NAME

Sensitive RPC values are never printed to stdout. Use --write-env or --write-response when you need them locally.
Explicit flags always win over profile defaults.
`

function parseProfile(value: string | undefined): TTenderlyProfile {
  if (!value || value.trim().length === 0) {
    return 'webops'
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === 'webops' || normalized === 'personal') {
    return normalized
  }

  throw new Error(`Unsupported profile: ${value}. Expected "webops" or "personal".`)
}

function parseCliArgs(argv: readonly string[]): TParsedCliArgs {
  const recurse = (index: number, acc: TParsedCliArgs): TParsedCliArgs => {
    if (index >= argv.length) return acc

    const token = argv[index]
    if (!token.startsWith('--')) {
      return recurse(index + 1, { ...acc, positionals: [...acc.positionals, token] })
    }

    const key = token.slice(2)
    const nextValue = argv[index + 1]
    const maybeValue = nextValue && !nextValue.startsWith('--') ? nextValue : 'true'
    const nextIndex = maybeValue === 'true' ? index + 1 : index + 2

    return recurse(nextIndex, {
      ...acc,
      flags: {
        ...acc.flags,
        [key]: maybeValue
      }
    })
  }

  return recurse(0, { flags: {}, positionals: [] })
}

export function readEnvFile(path = '.env'): Record<string, string> {
  if (!existsSync(path)) return {}

  const envLines = readFileSync(path, 'utf8').split('\n')

  return envLines
    .map((rawLine) => rawLine.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => {
      const separatorIndex = line.indexOf('=')
      if (separatorIndex < 0) return null

      const key = line.slice(0, separatorIndex).trim()
      if (!key) return null

      const rawValue = line.slice(separatorIndex + 1).trim()
      if (!rawValue) return [key, '']

      const value = rawValue.replace(/^['"]|['"]$/g, '')
      return [key, value]
    })
    .filter((entry): entry is [string, string] => Boolean(entry))
    .reduce(
      (acc, [key, value]) => {
        acc[key] = value
        return acc
      },
      {} as Record<string, string>
    )
}

function requireString(value: string | undefined, label: string): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required value: ${label}`)
  }
  return value
}

function parseOptionalInteger(value: string | undefined, label: string): number | undefined {
  if (!value) return undefined

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
  return parsed
}

function parseBooleanFlag(flags: Record<string, string>, key: string, defaultValue = false): boolean {
  if (!(key in flags)) return defaultValue
  return String(flags[key]).toLowerCase() !== 'false'
}

function getArg(flags: Record<string, string>, ...keys: string[]): string | undefined {
  return keys.map((key) => flags[key]?.trim()).find((value) => Boolean(value))
}

function resolveDefaultChainId(networkId: number): number {
  const derivedChainId = Number(`${DEFAULT_CHAIN_ID_PREFIX}${networkId}`)
  if (!Number.isSafeInteger(derivedChainId) || derivedChainId <= 0) {
    throw new Error(`Unable to derive default chain id for network ${networkId}`)
  }
  return derivedChainId
}

function getEnvValue(env: Record<string, string | undefined>, key?: string): string | undefined {
  if (!key) return undefined
  return env[key]?.trim()
}

export function sanitizeConsoleText(value: string): string {
  return value.replace(/https?:\/\/\S+/gi, REDACTED_URL)
}

function resolveTenderlyCredentials(
  flags: Record<string, string>,
  env: Record<string, string | undefined>
): TResolvedTenderlyCredentials {
  const profile = parseProfile(getArg(flags, 'profile'))
  const profileDefaults =
    profile === 'personal'
      ? {
          apiKeyEnv: 'PERSONAL_TENDERLY_API_KEY',
          accountEnv: 'PERSONAL_ACCOUNT_SLUG',
          projectEnv: 'PERSONAL_PROJECT_SLUG'
        }
      : {
          apiKeyEnv: 'WEBOPS_TENDERLY_API_KEY',
          accountEnv: 'TENDERLY_ACCOUNT_SLUG',
          projectEnv: 'TENDERLY_PROJECT_SLUG'
        }

  const apiKeyEnv = getArg(flags, 'api-key-env') || profileDefaults.apiKeyEnv
  const accountEnv = getArg(flags, 'account-env') || profileDefaults.accountEnv
  const projectEnv = getArg(flags, 'project-env') || profileDefaults.projectEnv

  const apiKey =
    getArg(flags, 'api-key') ||
    getEnvValue(env, apiKeyEnv) ||
    env.TENDERLY_ACCESS_KEY?.trim() ||
    env.TENDERLY_API_KEY?.trim()

  if (!apiKey) {
    throw new Error('Missing Tenderly API key. Provide --api-key or configure a supported Tenderly API key env var.')
  }

  const accountSlug =
    getArg(flags, 'account') ||
    getEnvValue(env, accountEnv) ||
    (profile === 'personal' ? env.ACCOUNT_SLUG?.trim() : undefined) ||
    DEFAULT_ACCOUNT_SLUG
  const projectSlug = requireString(
    getArg(flags, 'project') ||
      getEnvValue(env, projectEnv) ||
      (profile === 'personal' ? env.PROJECT_SLUG?.trim() : undefined),
    '--project or a configured Tenderly project env var'
  )

  return {
    apiKey,
    accountSlug,
    projectSlug,
    profile
  }
}

function resolveRpcName(
  flags: Record<string, string>,
  env: Record<string, string | undefined>,
  profile: TTenderlyProfile
): string | undefined {
  const profileDefaultEnvKey = profile === 'personal' ? 'PERSONAL_TENDERLY_RPC_NAME' : 'WEBOPS_TENDERLY_RPC_NAME'
  return getArg(flags, 'rpc-name') || getEnvValue(env, profileDefaultEnvKey) || env.TENDERLY_RPC_NAME?.trim()
}

export function buildPredictablePublicRpcUrl(accountSlug: string, projectSlug: string, rpcName: string): string {
  return `https://virtual.rpc.tenderly.co/${encodeURIComponent(accountSlug)}/${encodeURIComponent(projectSlug)}/public/${encodeURIComponent(rpcName)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

export function resolveExplorerUriFromResponse(response: TTenderlyVnetResponse): string | undefined {
  const queue: Array<{ value: unknown; path: string[] }> = [{ value: response, path: [] }]
  const visited = new Set<unknown>()

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || !isRecord(current.value) || visited.has(current.value)) {
      continue
    }
    visited.add(current.value)

    for (const [key, value] of Object.entries(current.value)) {
      const normalizedKey = key.toLowerCase()
      const normalizedPath = [...current.path, normalizedKey]
      const isExplorerPath = normalizedPath.some((part) => part.includes('explorer'))

      if (isExplorerPath && isHttpUrl(value)) {
        return value
      }

      if (Array.isArray(value)) {
        queue.push(...value.map((entry) => ({ value: entry, path: normalizedPath })))
        continue
      }

      if (isRecord(value)) {
        queue.push({ value, path: normalizedPath })
      }
    }
  }

  return undefined
}

function getConnectionDetails(
  response: TTenderlyVnetResponse,
  accountSlug: string,
  projectSlug: string,
  rpcName: string | undefined
): TTenderlyVnetConnectionDetails {
  return {
    adminRpc: response.rpcs?.find((rpc) => rpc.name === 'Admin RPC')?.url,
    publicRpc: response.rpcs?.find((rpc) => rpc.name === 'Public RPC')?.url,
    predictablePublicRpc: rpcName ? buildPredictablePublicRpcUrl(accountSlug, projectSlug, rpcName) : undefined,
    explorerUri: resolveExplorerUriFromResponse(response)
  }
}

function selectPublicRpc(details: TTenderlyVnetConnectionDetails): string | undefined {
  return details.predictablePublicRpc || details.publicRpc
}

function resolveOutputPath(value: string | undefined, flagName: string): string {
  const trimmedValue = value?.trim()
  if (!trimmedValue || trimmedValue === 'true') {
    throw new Error(`--${flagName} requires a file path`)
  }

  return resolve(process.cwd(), trimmedValue)
}

export function validateWritableOutputPath(path: string): string {
  const outputDir = dirname(path)

  try {
    mkdirSync(outputDir, { recursive: true, mode: 0o700 })

    if (existsSync(path)) {
      if (statSync(path).isDirectory()) {
        throw new Error(`Output path is a directory: ${path}`)
      }
      accessSync(path, constants.W_OK)
      return path
    }

    accessSync(outputDir, constants.W_OK)
    return path
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Cannot write output file ${path}: ${message}`)
  }
}

export function writeOutputFile(path: string, contents: string): string {
  writeFileSync(path, contents, { encoding: 'utf8', mode: 0o600 })
  chmodSync(path, 0o600)
  return path
}

function resolveRequestedOutputPaths(flags: Record<string, string>): {
  envFilePath?: string
  responseFilePath?: string
} {
  const envFilePath =
    'write-env' in flags
      ? validateWritableOutputPath(resolveOutputPath(getArg(flags, 'write-env'), 'write-env'))
      : undefined
  const responseFilePath =
    'write-response' in flags
      ? validateWritableOutputPath(resolveOutputPath(getArg(flags, 'write-response'), 'write-response'))
      : undefined

  return {
    envFilePath,
    responseFilePath
  }
}

export function buildTenderlyEnvFragment(params: {
  canonicalChainId: number
  executionChainId: number
  details: TTenderlyVnetConnectionDetails
}): string {
  const publicRpc = selectPublicRpc(params.details) || ''

  return [
    '# Generated by scripts/tenderly-vnet.ts',
    'VITE_TENDERLY_MODE=true',
    `VITE_TENDERLY_CHAIN_ID_FOR_${params.canonicalChainId}=${params.executionChainId}`,
    `VITE_TENDERLY_RPC_URI_FOR_${params.canonicalChainId}=${publicRpc}`,
    `TENDERLY_ADMIN_RPC_URI_FOR_${params.canonicalChainId}=${params.details.adminRpc || ''}`,
    `VITE_TENDERLY_EXPLORER_URI_FOR_${params.canonicalChainId}=${params.details.explorerUri || ''}`
  ].join('\n')
}

export function buildSanitizedVnetJson(params: {
  profile: TTenderlyProfile
  requestedSlug: string
  displayName: string
  chainId: number
  networkId: number
  response: TTenderlyVnetResponse
  details: TTenderlyVnetConnectionDetails
  envFilePath?: string
  responseFilePath?: string
}): Record<string, unknown> {
  const sanitizedResponse = Object.fromEntries(
    Object.entries(params.response).filter(([key]) => key !== 'rpcs')
  ) as Record<string, unknown>
  const hasSensitiveValues = Boolean(
    params.details.adminRpc || params.details.publicRpc || params.details.predictablePublicRpc
  )

  return {
    ...sanitizedResponse,
    profile: params.profile,
    slug: params.response.slug || params.requestedSlug,
    display_name: params.response.display_name || params.displayName,
    chain_id: params.chainId,
    network_id: params.networkId,
    has_admin_rpc: Boolean(params.details.adminRpc),
    has_public_rpc: Boolean(selectPublicRpc(params.details)),
    env_file_path: params.envFilePath || null,
    response_file_path: params.responseFilePath || null,
    note:
      hasSensitiveValues && !params.envFilePath && !params.responseFilePath
        ? 'Sensitive RPC values were returned but were not printed. Use --write-env or --write-response to persist them locally.'
        : undefined
  }
}

export function buildVnetConsoleSummary(params: {
  profile: TTenderlyProfile
  requestedSlug: string
  displayName: string
  chainId: number
  networkId: number
  response: TTenderlyVnetResponse
  details: TTenderlyVnetConnectionDetails
  envFilePath?: string
  responseFilePath?: string
}): string[] {
  const hasSensitiveValues = Boolean(
    params.details.adminRpc || params.details.publicRpc || params.details.predictablePublicRpc
  )

  return [
    'Created Tenderly Virtual TestNet',
    `profile: ${params.profile}`,
    `slug: ${params.response.slug || params.requestedSlug}`,
    `display name: ${params.response.display_name || params.displayName}`,
    params.envFilePath ? `wrote env fragment: ${params.envFilePath}` : undefined,
    params.responseFilePath ? `wrote raw response json: ${params.responseFilePath}` : undefined,
    hasSensitiveValues && !params.envFilePath && !params.responseFilePath
      ? 'Sensitive RPC values were returned but not printed. Use --write-env <path> or --write-response <path> to persist them locally.'
      : undefined,
    `chain-id: ${params.chainId}`,
    `network-id: ${params.networkId}`
  ].filter((line): line is string => Boolean(line))
}

function parseResponseBody(responseBody: string): TTenderlyVnetResponse {
  try {
    return JSON.parse(responseBody) as TTenderlyVnetResponse
  } catch {
    return {}
  }
}

export function buildTenderlyApiErrorMessage(params: { status: number; parsedBody: TTenderlyVnetResponse }): string {
  const record = params.parsedBody as Record<string, unknown>
  const rawApiMessage = typeof record.message === 'string' ? record.message : undefined
  const apiMessage = rawApiMessage ? `: ${sanitizeConsoleText(rawApiMessage)}` : ''
  const accountHint =
    params.status === 404
      ? '\nHint: check --account and --project slugs. Use your team/org slug in --account for 404 cases, not a project id.'
      : ''

  return `Tenderly API request failed (${params.status})${apiMessage}${accountHint}`
}

async function createVirtualTestNet(
  apiKey: string,
  accountSlug: string,
  projectSlug: string,
  payload: TCreateVnetPayload
): Promise<TTenderlyVnetResponse> {
  const response = await fetch(
    `${TENDERLY_API_URL}/${encodeURIComponent(accountSlug)}/project/${encodeURIComponent(projectSlug)}/vnets`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'content-type': 'application/json',
        'X-Access-Key': apiKey
      },
      body: JSON.stringify(payload)
    }
  )

  const responseBody = (await response.text()) || '{}'
  const parsed = parseResponseBody(responseBody)

  if (!response.ok) {
    throw new Error(buildTenderlyApiErrorMessage({ status: response.status, parsedBody: parsed }))
  }

  return parsed
}

async function main(): Promise<void> {
  const parsedArgs = parseCliArgs(process.argv.slice(2))
  const { flags } = parsedArgs

  if ('help' in flags || 'h' in flags) {
    console.log(HELP_TEXT)
    return
  }

  const scriptDir = resolve(fileURLToPath(import.meta.url), '..')
  const envFromFile = readEnvFile(resolve(scriptDir, '../.env'))
  const env = { ...envFromFile, ...process.env }
  const { apiKey, accountSlug, projectSlug, profile } = resolveTenderlyCredentials(flags, env)
  const rpcName = resolveRpcName(flags, env, profile)
  const timestamp = Date.now().toString()
  const requestedSlug = getArg(flags, 'slug') || `vnet-${timestamp}`
  const defaultDisplayNamePrefix = profile === 'personal' ? 'Personal VNet' : 'Webops VNet'
  const displayName = getArg(flags, 'display-name') || `${defaultDisplayNamePrefix} ${timestamp}`
  const networkId = parseOptionalInteger(getArg(flags, 'network-id'), 'network-id') || DEFAULT_NETWORK_ID
  const chainId = parseOptionalInteger(getArg(flags, 'chain-id'), 'chain-id') || resolveDefaultChainId(networkId)
  const blockNumber = getArg(flags, 'block-number') || 'latest'
  const enableSync = parseBooleanFlag(flags, 'enable-sync', false)
  const enableExplorer = parseBooleanFlag(flags, 'enable-explorer', false)
  const { envFilePath, responseFilePath } = resolveRequestedOutputPaths(flags)

  const payload: TCreateVnetPayload = {
    slug: requestedSlug,
    display_name: displayName,
    fork_config: {
      network_id: networkId,
      block_number: blockNumber
    },
    virtual_network_config: {
      chain_config: {
        chain_id: chainId
      }
    },
    sync_state_config: {
      enabled: enableSync,
      commitment_level: 'latest'
    },
    explorer_page_config: {
      enabled: enableExplorer,
      verification_visibility: 'bytecode'
    },
    ...(rpcName ? { rpc_config: { rpc_name: rpcName } } : {})
  }

  const response = await createVirtualTestNet(apiKey, accountSlug, projectSlug, payload)
  const details = getConnectionDetails(response, accountSlug, projectSlug, rpcName)
  if (envFilePath) {
    writeOutputFile(
      envFilePath,
      `${buildTenderlyEnvFragment({
        canonicalChainId: networkId,
        executionChainId: chainId,
        details
      })}\n`
    )
  }
  if (responseFilePath) {
    writeOutputFile(responseFilePath, `${JSON.stringify(response, null, 2)}\n`)
  }

  if ('json' in flags) {
    console.log(
      JSON.stringify(
        buildSanitizedVnetJson({
          profile,
          requestedSlug,
          displayName,
          chainId,
          networkId,
          response,
          details,
          envFilePath,
          responseFilePath
        }),
        null,
        2
      )
    )
    return
  }

  buildVnetConsoleSummary({
    profile,
    requestedSlug,
    displayName,
    chainId,
    networkId,
    response,
    details,
    envFilePath,
    responseFilePath
  }).forEach((line) => {
    console.log(line)
  })
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? sanitizeConsoleText(error.message) : 'Tenderly VNet bootstrap failed'
    console.error(message)
    process.exitCode = 1
  })
}
