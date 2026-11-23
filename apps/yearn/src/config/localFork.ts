type TEnvValue = boolean | string | undefined

export type TLocalForkEnv = Record<string, TEnvValue>

export type TLocalForkChain<TChainId extends number> = {
  canonicalChainId: TChainId
  executionChainId: number
  rpcUri: string
  explorerUri?: string
}

function readEnvString(value: TEnvValue): string {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }

  return ''
}

function isTruthyEnvValue(value: TEnvValue): boolean {
  return ['1', 'on', 'true', 'yes'].includes(readEnvString(value).toLowerCase())
}

export function parseLocalForkChains<TChainId extends number>(
  env: TLocalForkEnv,
  canonicalChains: readonly { id: TChainId }[]
): TLocalForkChain<TChainId>[] {
  if (!isTruthyEnvValue(env.NEXT_PUBLIC_LOCAL_FORK_MODE)) {
    return []
  }

  const configuredChains = canonicalChains.reduce<TLocalForkChain<TChainId>[]>((accumulator, chain) => {
    const rawExecutionChainId = readEnvString(env[`NEXT_PUBLIC_LOCAL_FORK_CHAIN_ID_FOR_${chain.id}`])
    const rawRpcUri = readEnvString(env[`NEXT_PUBLIC_LOCAL_FORK_RPC_URI_FOR_${chain.id}`])
    const rawExplorerUri = readEnvString(env[`NEXT_PUBLIC_LOCAL_FORK_EXPLORER_URI_FOR_${chain.id}`])
    const hasAnyConfig = Boolean(rawExecutionChainId || rawRpcUri || rawExplorerUri)

    if (!hasAnyConfig) {
      return accumulator
    }

    if (!rawExecutionChainId || !rawRpcUri) {
      throw new Error(
        `Local fork for chain ${chain.id} requires both NEXT_PUBLIC_LOCAL_FORK_CHAIN_ID_FOR_${chain.id} and NEXT_PUBLIC_LOCAL_FORK_RPC_URI_FOR_${chain.id}`
      )
    }

    const executionChainId = Number(rawExecutionChainId)
    if (!Number.isInteger(executionChainId) || executionChainId <= 0) {
      throw new Error(`Invalid local fork execution chain ID for canonical chain ${chain.id}: ${rawExecutionChainId}`)
    }

    const rpcUri = getLocalAnvilRpcUri(rawRpcUri)
    if (!rpcUri) {
      throw new Error(`Local fork RPC for chain ${chain.id} must use localhost`)
    }

    accumulator.push({
      canonicalChainId: chain.id,
      executionChainId,
      rpcUri,
      explorerUri: rawExplorerUri || undefined
    })

    return accumulator
  }, [])

  if (configuredChains.length === 0) {
    throw new Error('Local fork mode is enabled but no execution chains are configured')
  }

  return configuredChains
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

export function getLocalAnvilRpcUri(rpcUri: string): string | undefined {
  if (!URL.canParse(rpcUri)) {
    return undefined
  }

  const url = new URL(rpcUri)
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    !LOOPBACK_HOSTS.has(url.hostname) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    return undefined
  }

  return url.href
}

export async function callAnvil(rpcUri: string, method: string, params: unknown[] = []): Promise<unknown> {
  const localRpcUri = getLocalAnvilRpcUri(rpcUri)
  if (!localRpcUri) {
    throw new Error('Anvil controls require a localhost RPC')
  }

  const response = await fetch(localRpcUri, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(15_000)
  })
  if (!response.ok) {
    throw new Error(`Anvil RPC returned HTTP ${response.status}`)
  }

  const payload = (await response.json()) as { result?: unknown; error?: { message?: string } } | null
  if (!payload || typeof payload !== 'object' || !('result' in payload) || payload.error) {
    throw new Error(payload?.error?.message || `Anvil RPC request failed: ${method}`)
  }
  return payload.result
}

export async function readAnvilInstance(rpcUri: string, expectedChainId: number): Promise<string> {
  const metadata = (await callAnvil(rpcUri, 'anvil_metadata')) as {
    instanceId?: unknown
    chainId?: unknown
  } | null

  if (typeof metadata?.instanceId !== 'string' || !metadata.instanceId) {
    throw new Error('The local RPC did not identify an Anvil instance')
  }
  if (
    (typeof metadata.chainId !== 'number' && typeof metadata.chainId !== 'string') ||
    Number(metadata.chainId) !== expectedChainId
  ) {
    throw new Error(`The local RPC chain does not match chain ${expectedChainId}`)
  }
  return metadata.instanceId
}
