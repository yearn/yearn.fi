/// <reference types="node" />

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

type TParsedCliArgs = {
  flags: Record<string, string>
  positionals: string[]
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
}

const DEFAULT_ACCOUNT_SLUG = 'me'
const DEFAULT_NETWORK_ID = 1
const DEFAULT_CHAIN_ID = 73571
const TENDERLY_API_URL = 'https://api.tenderly.co/api/v1/account'

const HELP_TEXT = `Tenderly Virtual TestNet bootstrap

Usage:
  bun run scripts/tenderly-vnet.ts --project <projectSlug> [options]

Options:
  --account <slug>        Tenderly account slug (defaults to TENDERLY_ACCOUNT_SLUG, then me)
  --project <slug>        Tenderly project slug (required)
  --slug <slug>           VNet slug (default: vnet-<timestamp>)
  --display-name <name>    VNet display name (default: Webops VNet)
  --network-id <id>       Parent network id (default: 1)
  --block-number <num>    Fork block number or latest (default: latest)
  --chain-id <id>         Execution chain id (default: 73571)
  --enable-sync           Enable state sync (default: false)
  --enable-explorer       Enable public explorer (default: false)
  --json                  Print raw API JSON response
  --help                  Show this help text

The script reads WEBOPS_TENDERLY_API_KEY and optional TENDERLY_ACCOUNT_SLUG from .env if not already in process.env.
`

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

function readEnvFile(path = '.env'): Record<string, string> {
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
  let parsed = {} as TTenderlyVnetResponse

  try {
    parsed = JSON.parse(responseBody) as TTenderlyVnetResponse
  } catch {
    parsed = {}
  }

  if (!response.ok) {
    const record = parsed as Record<string, unknown>
    const apiMessage = record.message ? `: ${String(record.message)}` : ''
    const responseText = `\nResponse: ${responseBody.trim() || 'empty'}`
    const accountHint =
      response.status === 404
        ? '\nHint: check --account and --project slugs. Use your team/org slug in --account for 404 cases, not a project id.'
        : ''
    throw new Error(`Tenderly API request failed (${response.status})${apiMessage}${responseText}${accountHint}`)
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

  const apiKey = env.WEBOPS_TENDERLY_API_KEY?.trim() || env.TENDERLY_ACCESS_KEY?.trim() || env.TENDERLY_API_KEY?.trim()

  if (!apiKey) {
    throw new Error(
      'Missing WEBOPS_TENDERLY_API_KEY in environment. Set it in .env or export it before running this script.'
    )
  }

  const accountSlug = getArg(flags, 'account') || env.TENDERLY_ACCOUNT_SLUG?.trim() || DEFAULT_ACCOUNT_SLUG
  const projectSlug = requireString(getArg(flags, 'project'), '--project')
  const timestamp = Date.now().toString()
  const requestedSlug = getArg(flags, 'slug') || `vnet-${timestamp}`
  const displayName = getArg(flags, 'display-name') || `Webops VNet ${timestamp}`
  const networkId = parseOptionalInteger(getArg(flags, 'network-id'), 'network-id') || DEFAULT_NETWORK_ID
  const chainId = parseOptionalInteger(getArg(flags, 'chain-id'), 'chain-id') || DEFAULT_CHAIN_ID
  const blockNumber = getArg(flags, 'block-number') || 'latest'
  const enableSync = parseBooleanFlag(flags, 'enable-sync', false)
  const enableExplorer = parseBooleanFlag(flags, 'enable-explorer', false)

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
    }
  }

  const response = await createVirtualTestNet(apiKey, accountSlug, projectSlug, payload)

  if ('json' in flags) {
    console.log(JSON.stringify(response, null, 2))
    return
  }

  const adminRpc = response.rpcs?.find((rpc) => rpc.name === 'Admin RPC')?.url
  const publicRpc = response.rpcs?.find((rpc) => rpc.name === 'Public RPC')?.url

  console.log(`Created Tenderly Virtual TestNet`)
  console.log(`slug: ${response.slug || requestedSlug}`)
  console.log(`display name: ${response.display_name || displayName}`)
  if (adminRpc) console.log(`admin rpc: ${adminRpc}`)
  if (publicRpc) console.log(`public rpc: ${publicRpc}`)
  console.log(`chain-id: ${chainId}`)
  console.log(`network-id: ${networkId}`)
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    process.exitCode = 1
  })
}
