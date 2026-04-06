import { getAddress } from 'viem'
import type {
  TTenderlyFundRequest,
  TTenderlyPanelStatus,
  TTenderlyRevertResponse,
  TTenderlySnapshotRecord
} from '../src/components/shared/types/tenderly'
import { canonicalChains } from '../src/config/chainDefinitions'

type TTenderlyServerEnv = Record<string, string | undefined>

export type TTenderlyServerChainConfig = {
  canonicalChainId: number
  canonicalChainName: string
  executionChainId: number
  rpcUri: string
  adminRpcUri?: string
}

function readEnvString(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isTruthyEnvValue(value: string | undefined): boolean {
  return ['1', 'on', 'true', 'yes'].includes(readEnvString(value).toLowerCase())
}

export function parseTenderlyServerChains(env: TTenderlyServerEnv): TTenderlyServerChainConfig[] {
  if (!isTruthyEnvValue(env.VITE_TENDERLY_MODE)) {
    return []
  }

  return canonicalChains.reduce<TTenderlyServerChainConfig[]>((accumulator, chain) => {
    const rawExecutionChainId = readEnvString(env[`VITE_TENDERLY_CHAIN_ID_FOR_${chain.id}`])
    const rawRpcUri = readEnvString(env[`VITE_TENDERLY_RPC_URI_FOR_${chain.id}`])
    const rawAdminRpcUri = readEnvString(env[`TENDERLY_ADMIN_RPC_URI_FOR_${chain.id}`])
    const hasAnyConfig = Boolean(rawExecutionChainId || rawRpcUri || rawAdminRpcUri)

    if (!hasAnyConfig) {
      return accumulator
    }

    if (!rawExecutionChainId || !rawRpcUri) {
      throw new Error(
        `Tenderly chain ${chain.id} requires both VITE_TENDERLY_CHAIN_ID_FOR_${chain.id} and VITE_TENDERLY_RPC_URI_FOR_${chain.id}`
      )
    }

    const executionChainId = Number(rawExecutionChainId)
    if (!Number.isInteger(executionChainId) || executionChainId <= 0) {
      throw new Error(`Invalid Tenderly execution chain ID for canonical chain ${chain.id}: ${rawExecutionChainId}`)
    }

    accumulator.push({
      canonicalChainId: chain.id,
      canonicalChainName: chain.name,
      executionChainId,
      rpcUri: rawRpcUri,
      adminRpcUri: rawAdminRpcUri || undefined
    })

    return accumulator
  }, [])
}

export function buildTenderlyPanelStatus(env: TTenderlyServerEnv): TTenderlyPanelStatus {
  return {
    isTenderlyModeEnabled: isTruthyEnvValue(env.VITE_TENDERLY_MODE),
    configuredChains: parseTenderlyServerChains(env).map((chain) => ({
      canonicalChainId: chain.canonicalChainId,
      canonicalChainName: chain.canonicalChainName,
      executionChainId: chain.executionChainId,
      hasAdminRpc: Boolean(chain.adminRpcUri)
    }))
  }
}

export function requireTenderlyServerChain(
  env: TTenderlyServerEnv,
  canonicalChainId: number
): TTenderlyServerChainConfig {
  const configuredChain = parseTenderlyServerChains(env).find((chain) => chain.canonicalChainId === canonicalChainId)

  if (!configuredChain) {
    throw new Error(`Tenderly chain ${canonicalChainId} is not configured`)
  }

  if (!configuredChain.adminRpcUri) {
    throw new Error(`Missing TENDERLY_ADMIN_RPC_URI_FOR_${canonicalChainId}`)
  }

  return configuredChain
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

  return BigInt(wholePartRaw) * 10n ** BigInt(decimals) + BigInt(fractionalPartRaw.padEnd(decimals, '0') || '0')
}

export function toHexQuantity(value: bigint): `0x${string}` {
  if (value < 0n) {
    throw new Error('Negative quantities are not supported')
  }

  return `0x${value.toString(16)}` as const
}

export function buildDefaultSnapshotLabel(kind: TTenderlySnapshotRecord['kind']): string {
  const prefix = kind === 'baseline' ? 'Baseline' : 'Snapshot'
  return `${prefix} ${new Date()
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, ' UTC')}`
}

export function buildTenderlySnapshotRecord(params: {
  canonicalChainId: number
  executionChainId: number
  snapshotId: string
  label?: string
  isBaseline?: boolean
}): TTenderlySnapshotRecord {
  const kind = params.isBaseline ? 'baseline' : 'snapshot'

  return {
    snapshotId: params.snapshotId,
    canonicalChainId: params.canonicalChainId,
    executionChainId: params.executionChainId,
    label: params.label?.trim() || buildDefaultSnapshotLabel(kind),
    createdAt: new Date().toISOString(),
    kind,
    lastKnownStatus: 'valid'
  }
}

export function buildTenderlyRevertResponse(result: unknown, snapshotId: string): TTenderlyRevertResponse {
  if (result !== true) {
    throw new Error(`Tenderly rejected revert for snapshot ${snapshotId}`)
  }

  return {
    success: true,
    revertedSnapshotId: snapshotId
  }
}

export function resolveTenderlyFundRpcRequest(body: TTenderlyFundRequest): {
  method: string
  params: unknown[]
} {
  const walletAddress = getAddress(body.walletAddress)
  const amount = parseDecimalAmount(body.amount, body.decimals)

  if (body.assetKind === 'native') {
    const mode = body.mode === 'set' ? 'set' : 'add'
    return {
      method: mode === 'set' ? 'tenderly_setBalance' : 'tenderly_addBalance',
      params: [[walletAddress], toHexQuantity(amount)]
    }
  }

  if (!body.tokenAddress) {
    throw new Error('tokenAddress is required for ERC-20 funding')
  }

  return {
    method: 'tenderly_setErc20Balance',
    params: [getAddress(body.tokenAddress), walletAddress, toHexQuantity(amount)]
  }
}
