export interface RpcConfig {
  primary: string
  fallbacks: string[]
}

const RPC_CONFIG: Record<number, RpcConfig> = {
  1: {
    primary: 'https://ethereum-rpc.publicnode.com',
    fallbacks: [
      'https://1rpc.io/eth',
      'https://rpc.ankr.com/eth',
      'https://eth-mainnet.nodereal.io/v1/1659dfb40aa24bbb8153a677b98064d7'
    ]
  },
  10: {
    primary: 'https://optimism.public.blockpi.network/v1/rpc/public',
    fallbacks: [
      'https://1rpc.io/op',
      'https://optimism-public.nodies.app',
      'https://optimism-mainnet.public.blastapi.io'
    ]
  },
  137: {
    primary: 'https://polygon-bor-rpc.publicnode.com',
    fallbacks: ['https://rpc.ankr.com/polygon', 'https://1rpc.io/matic', 'https://polygon-public.nodies.app']
  },
  42161: {
    primary: 'https://arbitrum-one.public.blastapi.io',
    fallbacks: ['https://1rpc.io/arb', 'https://arbitrum-one-public.nodies.app', 'https://rpc.ankr.com/arbitrum']
  },
  8453: {
    primary: 'https://base-mainnet.public.blastapi.io',
    fallbacks: [
      'https://1rpc.io/base',
      'https://base-public.nodies.app',
      'https://base.public.blockpi.network/v1/rpc/public'
    ]
  },
  250: {
    primary: 'https://fantom-rpc.publicnode.com',
    fallbacks: ['https://1rpc.io/ftm', 'https://fantom-public.nodies.app', 'https://fantom-mainnet.public.blastapi.io']
  }
}

export function getRpcConfig(chainId: number): RpcConfig | undefined {
  return RPC_CONFIG[chainId]
}

export function getAllRpcEndpoints(chainId: number): string[] {
  const config = RPC_CONFIG[chainId]
  if (!config) return []
  return [config.primary, ...config.fallbacks]
}

export function getRandomRpcEndpoint(chainId: number): string | undefined {
  const endpoints = getAllRpcEndpoints(chainId)
  if (endpoints.length === 0) return undefined
  return endpoints[Math.floor(Math.random() * endpoints.length)]
}

const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11'

const VAULT_SELECTORS = {
  totalAssets: '0x01e1d114',
  strategies: '0x39ebf823'
}

function encodeAddressParam(addr: string): string {
  return addr.toLowerCase().replace('0x', '').padStart(64, '0')
}

function encodeMulticallAggregate(calls: Array<{ target: string; callData: string }>): string {
  const selector = '252dba42'
  const numCalls = calls.length

  const arrayOffset = '0000000000000000000000000000000000000000000000000000000000000020'
  const arrayLength = numCalls.toString(16).padStart(64, '0')

  let tupleOffsets = ''
  let tupleData = ''

  let currentOffset = 32 * numCalls

  for (const call of calls) {
    tupleOffsets += currentOffset.toString(16).padStart(64, '0')

    const target = call.target.toLowerCase().replace('0x', '').padStart(64, '0')
    const callData = call.callData.replace(/^0x/, '')
    const callDataLen = callData.length / 2
    const paddedLen = Math.ceil(callDataLen / 32) * 32
    const paddedData = callData.padEnd(paddedLen * 2, '0')

    const bytesOffset = '0000000000000000000000000000000000000000000000000000000000000040'
    const lengthHex = callDataLen.toString(16).padStart(64, '0')

    tupleData += target + bytesOffset + lengthHex + paddedData

    currentOffset += 64 + 32 + paddedLen
  }

  return '0x' + selector + arrayOffset + arrayLength + tupleOffsets + tupleData
}

function decodeMulticallAggregateResult(hex: string): { blockNumber: bigint; results: string[] } {
  const clean = hex.replace(/^0x/, '')

  const blockNumber = BigInt('0x' + clean.slice(0, 64))

  const returnDataOffset = Number(BigInt('0x' + clean.slice(64, 128)))
  const returnDataStart = returnDataOffset * 2
  const arrayLength = Number(BigInt('0x' + clean.slice(returnDataStart, returnDataStart + 64)))

  const results: string[] = []

  for (let i = 0; i < arrayLength; i++) {
    const offsetPos = returnDataStart + 64 + i * 64
    const elementOffset = Number(BigInt('0x' + clean.slice(offsetPos, offsetPos + 64)))
    // bytes[] offsets are relative to the array body, immediately after the length slot.
    const elementStart = returnDataStart + 64 + elementOffset * 2

    const bytesLength = Number(BigInt('0x' + clean.slice(elementStart, elementStart + 64)))
    const bytesData = clean.slice(elementStart + 64, elementStart + 64 + bytesLength * 2)
    results.push('0x' + bytesData)
  }

  return { blockNumber, results }
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc: string
  id: number
  result?: T
  error?: { code: number; message: string }
}

async function jsonRpcCall<T>(endpoint: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  })

  if (!response.ok) {
    throw new Error(`RPC HTTP ${response.status}`)
  }

  const data = (await response.json()) as JsonRpcResponse<T>
  if (data.error) {
    throw new Error(`RPC error ${data.error.code}: ${data.error.message}`)
  }

  if (data.result === undefined) {
    throw new Error('RPC returned undefined result')
  }

  return data.result
}

function decodeUint256(hex: string): bigint {
  return BigInt(hex)
}

function extractCurrentDebtFromStrategiesResult(hex: string): bigint {
  const clean = hex.replace(/^0x/, '')
  const currentDebtHex = '0x' + clean.slice(128, 192)
  return decodeUint256(currentDebtHex)
}

async function fetchVaultStateViaMulticall(
  endpoint: string,
  vaultAddress: string,
  strategyAddresses: string[]
): Promise<{ totalAssets: bigint; strategyDebts: Map<string, bigint> }> {
  const calls = [
    { target: vaultAddress, callData: VAULT_SELECTORS.totalAssets },
    ...strategyAddresses.map((addr) => ({
      target: vaultAddress,
      callData: VAULT_SELECTORS.strategies + encodeAddressParam(addr)
    }))
  ]

  const calldata = encodeMulticallAggregate(calls)
  const result = await jsonRpcCall<string>(endpoint, 'eth_call', [{ to: MULTICALL3_ADDRESS, data: calldata }, 'latest'])

  const decoded = decodeMulticallAggregateResult(result)

  if (decoded.results.length !== calls.length) {
    throw new Error(`Multicall returned ${decoded.results.length} results, expected ${calls.length}`)
  }

  const totalAssets = decodeUint256(decoded.results[0])
  const strategyDebts = new Map<string, bigint>()

  for (let i = 0; i < strategyAddresses.length; i++) {
    const debt = extractCurrentDebtFromStrategiesResult(decoded.results[i + 1])
    strategyDebts.set(strategyAddresses[i].toLowerCase(), debt)
  }

  return { totalAssets, strategyDebts }
}

async function fetchVaultStateSequential(
  endpoint: string,
  vaultAddress: string,
  strategyAddresses: string[]
): Promise<{ totalAssets: bigint; strategyDebts: Map<string, bigint> }> {
  const totalAssetsResult = await jsonRpcCall<string>(endpoint, 'eth_call', [
    { to: vaultAddress, data: VAULT_SELECTORS.totalAssets },
    'latest'
  ])
  const totalAssets = decodeUint256(totalAssetsResult)

  const strategyDebts = new Map<string, bigint>()
  for (const strategy of strategyAddresses) {
    const data = VAULT_SELECTORS.strategies + encodeAddressParam(strategy)
    const result = await jsonRpcCall<string>(endpoint, 'eth_call', [{ to: vaultAddress, data }, 'latest'])
    strategyDebts.set(strategy.toLowerCase(), extractCurrentDebtFromStrategiesResult(result))
  }

  return { totalAssets, strategyDebts }
}

export async function fetchVaultOnChainState(
  chainId: number,
  vaultAddress: string,
  strategyAddresses: string[]
): Promise<{
  totalAssets: bigint
  strategyDebts: Map<string, bigint>
  unallocatedBps: number
}> {
  const endpoints = getAllRpcEndpoints(chainId)
  if (endpoints.length === 0) {
    throw new Error(`No RPC endpoints configured for chain ${chainId}`)
  }

  let lastError: Error | undefined

  for (const endpoint of endpoints) {
    try {
      const { totalAssets, strategyDebts } = await fetchVaultStateViaMulticall(
        endpoint,
        vaultAddress,
        strategyAddresses
      )
      return computeUnallocated(totalAssets, strategyDebts)
    } catch {
      try {
        const { totalAssets, strategyDebts } = await fetchVaultStateSequential(
          endpoint,
          vaultAddress,
          strategyAddresses
        )
        return computeUnallocated(totalAssets, strategyDebts)
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
      }
    }
  }

  throw lastError ?? new Error('All RPC endpoints failed')
}

function computeUnallocated(
  totalAssets: bigint,
  strategyDebts: Map<string, bigint>
): { totalAssets: bigint; strategyDebts: Map<string, bigint>; unallocatedBps: number } {
  const totalAllocated = Array.from(strategyDebts.values()).reduce((sum, debt) => sum + debt, BigInt(0))

  let unallocatedBps: number
  if (totalAssets > BigInt(0)) {
    const unallocated = totalAssets - totalAllocated
    unallocatedBps = Number((unallocated * BigInt(10000)) / totalAssets)
  } else {
    unallocatedBps = 10000
  }

  return { totalAssets, strategyDebts, unallocatedBps }
}
