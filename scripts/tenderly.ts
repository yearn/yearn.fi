/// <reference types="node" />

import { fileURLToPath } from 'node:url'
import { getAddress } from 'viem'

type TParsedCliArgs = {
  command?: string
  flags: Record<string, string>
  positionals: string[]
}

type TTenderlyJsonRpcSuccess = {
  id: string | number | null
  jsonrpc: '2.0'
  result: unknown
}

type TTenderlyJsonRpcError = {
  id: string | number | null
  jsonrpc: '2.0'
  error: {
    code: number
    message: string
    data?: unknown
  }
}

const DEFAULT_CANONICAL_CHAIN_ID = 1

const HELP_TEXT = `Tenderly Admin RPC helper

Usage:
  bun run tenderly <command> [options]

Commands:
  help
  chain-id [--chain 1]
  fund-native --wallet <address> --amount <amount> [--unit eth|wei] [--mode add|set] [--chain 1]
  fund-erc20 --wallet <address> --token <address> --amount <amount> [--decimals 18] [--unit token|raw] [--chain 1]
  snapshot [--chain 1]
  revert --id <snapshotId> [--chain 1]
  increase-time --seconds <seconds> [--mine-block] [--chain 1]
  set-next-timestamp --timestamp <unixSeconds> [--chain 1]
  increase-blocks --count <count> [--chain 1]
  raw --method <rpcMethod> [--params '<json-array>'] [--chain 1]

Examples:
  bun run tenderly chain-id
  bun run tenderly fund-native --wallet 0xabc... --amount 25 --mode add
  bun run tenderly fund-erc20 --wallet 0xabc... --token 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --amount 50000 --decimals 6
  bun run tenderly snapshot
  bun run tenderly revert --id 0x1
  bun run tenderly increase-time --seconds 86400 --mine-block
  bun run tenderly raw --method tenderly_setBalance --params '[["0xabc..."], "0x3635C9ADC5DEA00000"]'
`

export function parseCliArgs(argv: readonly string[]): TParsedCliArgs {
  const [command, ...rest] = argv
  const flags: Record<string, string> = {}
  const positionals: string[] = []

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index]
    if (!token.startsWith('--')) {
      positionals.push(token)
      continue
    }

    const key = token.slice(2)
    const nextToken = rest[index + 1]

    if (!nextToken || nextToken.startsWith('--')) {
      flags[key] = 'true'
      continue
    }

    flags[key] = nextToken
    index += 1
  }

  return { command, flags, positionals }
}

export function parseDecimalAmount(value: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new Error(`Invalid decimals value: ${decimals}`)
  }

  const normalizedValue = value.trim()
  if (normalizedValue.length === 0) {
    throw new Error('Amount is required')
  }

  if (normalizedValue.startsWith('-')) {
    throw new Error('Negative amounts are not supported')
  }

  if (!/^\d+(\.\d+)?$/.test(normalizedValue)) {
    throw new Error(`Invalid decimal amount: ${value}`)
  }

  const [wholePartRaw, fractionalPartRaw = ''] = normalizedValue.split('.')
  if (fractionalPartRaw.length > decimals) {
    throw new Error(`Amount ${value} exceeds ${decimals} decimals`)
  }

  const wholePart = BigInt(wholePartRaw)
  const fractionalPart = fractionalPartRaw.length ? BigInt(fractionalPartRaw.padEnd(decimals, '0')) : 0n

  return wholePart * 10n ** BigInt(decimals) + fractionalPart
}

export function toHexQuantity(value: bigint): `0x${string}` {
  if (value < 0n) {
    throw new Error('Negative quantities are not supported')
  }

  return `0x${value.toString(16)}` as const
}

function parsePositiveInteger(value: string, label: string): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`)
  }
  return parsed
}

function requireFlag(flags: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const value = flags[key]?.trim()
    if (value) {
      return value
    }
  }

  throw new Error(`Missing required flag: --${keys[0]}`)
}

function optionalFlag(flags: Record<string, string>, key: string): string | undefined {
  const value = flags[key]?.trim()
  return value ? value : undefined
}

function hasFlag(flags: Record<string, string>, key: string): boolean {
  const value = optionalFlag(flags, key)
  return value === 'true' || value === '1'
}

function getCanonicalChainId(flags: Record<string, string>): number {
  const chainValue = optionalFlag(flags, 'chain')
  return chainValue ? parsePositiveInteger(chainValue, 'chain') : DEFAULT_CANONICAL_CHAIN_ID
}

function getAdminRpcUri(canonicalChainId: number): string {
  const envName = `TENDERLY_ADMIN_RPC_URI_FOR_${canonicalChainId}`
  const value = process.env[envName]?.trim()

  if (!value) {
    throw new Error(`Missing ${envName} in the environment`)
  }

  return value
}

async function callAdminRpc(canonicalChainId: number, method: string, params: unknown[]): Promise<unknown> {
  const rpcUri = getAdminRpcUri(canonicalChainId)
  const response = await fetch(rpcUri, {
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
    throw new Error(`Tenderly RPC request failed with status ${response.status}`)
  }

  const payload = (await response.json()) as TTenderlyJsonRpcSuccess | TTenderlyJsonRpcError

  if ('error' in payload) {
    throw new Error(`${payload.error.message} (code ${payload.error.code})`)
  }

  return payload.result
}

function parseWalletAddress(flags: Record<string, string>): `0x${string}` {
  return getAddress(requireFlag(flags, 'wallet', 'address'))
}

function parseTokenAddress(flags: Record<string, string>): `0x${string}` {
  return getAddress(requireFlag(flags, 'token'))
}

function parseNativeAmount(flags: Record<string, string>): bigint {
  const amount = requireFlag(flags, 'amount')
  const unit = optionalFlag(flags, 'unit') || 'eth'

  if (unit === 'wei' || unit === 'raw') {
    return amount.startsWith('0x') ? BigInt(amount) : BigInt(amount)
  }

  if (unit !== 'eth') {
    throw new Error(`Unsupported native unit: ${unit}`)
  }

  return parseDecimalAmount(amount, 18)
}

function parseTokenAmount(flags: Record<string, string>): bigint {
  const amount = requireFlag(flags, 'amount')
  const unit = optionalFlag(flags, 'unit') || 'token'

  if (unit === 'raw' || unit === 'wei') {
    return amount.startsWith('0x') ? BigInt(amount) : BigInt(amount)
  }

  const decimals = parsePositiveInteger(optionalFlag(flags, 'decimals') || '18', 'decimals')
  return parseDecimalAmount(amount, decimals)
}

function formatResult(result: unknown): string {
  if (typeof result === 'string') {
    return result
  }

  return JSON.stringify(result, null, 2)
}

async function runCommand(parsedArgs: TParsedCliArgs): Promise<void> {
  const { command, flags } = parsedArgs
  const canonicalChainId = getCanonicalChainId(flags)

  switch (command) {
    case undefined:
    case 'help': {
      console.log(HELP_TEXT)
      return
    }
    case 'chain-id': {
      const result = await callAdminRpc(canonicalChainId, 'eth_chainId', [])
      const chainIdHex = String(result)
      const chainIdDecimal = Number(BigInt(chainIdHex))
      console.log(`canonical chain: ${canonicalChainId}`)
      console.log(`execution chain: ${chainIdDecimal} (${chainIdHex})`)
      return
    }
    case 'fund-native': {
      const wallet = parseWalletAddress(flags)
      const amount = parseNativeAmount(flags)
      const mode = optionalFlag(flags, 'mode') || 'add'
      const method = mode === 'set' ? 'tenderly_setBalance' : mode === 'add' ? 'tenderly_addBalance' : undefined

      if (!method) {
        throw new Error(`Unsupported fund-native mode: ${mode}`)
      }

      const result = await callAdminRpc(canonicalChainId, method, [[wallet], toHexQuantity(amount)])
      console.log(
        `${mode === 'set' ? 'Set' : 'Added'} native balance for ${wallet} on canonical chain ${canonicalChainId}`
      )
      console.log(formatResult(result))
      return
    }
    case 'fund-erc20': {
      const wallet = parseWalletAddress(flags)
      const token = parseTokenAddress(flags)
      const amount = parseTokenAmount(flags)
      const result = await callAdminRpc(canonicalChainId, 'tenderly_setErc20Balance', [
        token,
        wallet,
        toHexQuantity(amount)
      ])
      console.log(`Set ERC-20 balance for ${wallet} on token ${token} (canonical chain ${canonicalChainId})`)
      console.log(formatResult(result))
      return
    }
    case 'snapshot': {
      const result = await callAdminRpc(canonicalChainId, 'evm_snapshot', [])
      console.log(`Snapshot created on canonical chain ${canonicalChainId}: ${formatResult(result)}`)
      return
    }
    case 'revert': {
      const snapshotId = requireFlag(flags, 'id')
      const result = await callAdminRpc(canonicalChainId, 'evm_revert', [snapshotId])
      console.log(`Revert result on canonical chain ${canonicalChainId}: ${formatResult(result)}`)
      return
    }
    case 'increase-time': {
      const seconds = parsePositiveInteger(requireFlag(flags, 'seconds'), 'seconds')
      const shouldMineBlock = hasFlag(flags, 'mine-block')
      const result = await callAdminRpc(canonicalChainId, 'evm_increaseTime', [toHexQuantity(BigInt(seconds))])
      console.log(`Advanced time by ${seconds} seconds on canonical chain ${canonicalChainId}`)
      console.log(formatResult(result))
      if (shouldMineBlock) {
        const minedBlockResult = await callAdminRpc(canonicalChainId, 'evm_mine', [])
        console.log(`Mined 1 block on canonical chain ${canonicalChainId}`)
        console.log(formatResult(minedBlockResult))
      }
      return
    }
    case 'set-next-timestamp': {
      const timestamp = parsePositiveInteger(requireFlag(flags, 'timestamp'), 'timestamp')
      const result = await callAdminRpc(canonicalChainId, 'evm_setNextBlockTimestamp', [
        toHexQuantity(BigInt(timestamp))
      ])
      console.log(`Set next block timestamp to ${timestamp} on canonical chain ${canonicalChainId}`)
      console.log(formatResult(result))
      return
    }
    case 'increase-blocks': {
      const count = parsePositiveInteger(requireFlag(flags, 'count'), 'count')
      const result = await callAdminRpc(canonicalChainId, 'evm_increaseBlocks', [toHexQuantity(BigInt(count))])
      console.log(`Advanced ${count} blocks on canonical chain ${canonicalChainId}`)
      console.log(formatResult(result))
      return
    }
    case 'raw': {
      const method = requireFlag(flags, 'method')
      const rawParams = optionalFlag(flags, 'params') || '[]'
      const params = JSON.parse(rawParams) as unknown
      if (!Array.isArray(params)) {
        throw new Error('--params must be a JSON array')
      }

      const result = await callAdminRpc(canonicalChainId, method, params)
      console.log(formatResult(result))
      return
    }
    default: {
      throw new Error(`Unknown Tenderly command: ${command}`)
    }
  }
}

async function main(): Promise<void> {
  const parsedArgs = parseCliArgs(process.argv.slice(2))
  await runCommand(parsedArgs)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    process.exitCode = 1
  })
}
