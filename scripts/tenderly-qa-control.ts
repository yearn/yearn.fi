export const TENDERLY_QA_FLOW_IDS = [
  'yvusd-direct',
  'yvusd-locked',
  'yvbtc',
  'ybold',
  'v3-staking',
  'v2-migration',
  'v3-permit-migration',
  'juiced-accrual',
  'juiced-existing',
  'enso-same-chain',
  'enso-cross-chain'
] as const

export type TTenderlyQaFlowId = (typeof TENDERLY_QA_FLOW_IDS)[number]
export type TTenderlyQaSuite = 'full' | 'smoke'

const TENDERLY_QA_FLOW_ID_SET = new Set<string>(TENDERLY_QA_FLOW_IDS)
const TENDERLY_QA_SMOKE_FLOW_IDS = ['yvusd-direct', 'v3-staking', 'enso-same-chain'] as const

export const TENDERLY_QA_ALLOWED_RPC_METHODS = new Set([
  'debug_traceTransaction',
  'eth_blockNumber',
  'eth_call',
  'eth_chainId',
  'eth_getBalance',
  'eth_getBlockByNumber',
  'eth_getCode',
  'eth_getLogs',
  'eth_getTransactionByHash',
  'eth_getTransactionCount',
  'eth_getTransactionReceipt',
  'eth_sendTransaction',
  'evm_increaseTime',
  'evm_mine',
  'evm_revert',
  'evm_snapshot',
  'tenderly_setBalance',
  'tenderly_setErc20Balance'
])

type TTenderlyQaParsedFlags = {
  flowIds: string[]
  list: boolean
  maxRpcMethods?: string
  suite?: string
}

export type TTenderlyQaSelection =
  | {
      list: true
      flowIds: readonly TTenderlyQaFlowId[]
    }
  | {
      list: false
      flowIds: readonly TTenderlyQaFlowId[]
      maxRpcMethods: number
      suite?: TTenderlyQaSuite
    }

type TJsonRpcRequest = {
  method?: unknown
}

type TRpcBudgetChainState = {
  httpRequests: number
  methodCounts: Record<string, number>
  reservedCleanups: number
}

export type TTenderlyRpcBudgetSummary = {
  maxRpcMethods: number
  totalHttpRequests: number
  totalRpcMethods: number
  outstandingCleanupReservations: number
  chains: Record<
    string,
    {
      httpRequests: number
      methodCounts: Record<string, number>
      reservedCleanups: number
    }
  >
}

export type TTenderlyRpcBudget = {
  assertAllCleanupsConsumed: () => void
  recordRequest: (chain: string, body: BodyInit | null | undefined) => void
  releaseCleanup: (chain: string) => void
  reserveCleanup: (chain: string) => void
  summary: () => TTenderlyRpcBudgetSummary
}

type TTenderlyRpcRequest = (method: string, params?: readonly unknown[]) => Promise<unknown>

function parseTenderlyQaFlags(argv: readonly string[]): TTenderlyQaParsedFlags {
  const recurse = (index: number, flags: TTenderlyQaParsedFlags): TTenderlyQaParsedFlags => {
    if (index >= argv.length) {
      return flags
    }

    const argument = argv[index]
    if (argument === '--list') {
      return recurse(index + 1, {
        flowIds: flags.flowIds,
        list: true,
        maxRpcMethods: flags.maxRpcMethods,
        suite: flags.suite
      })
    }
    if (argument === '--flow') {
      const flowId = argv[index + 1]
      if (!flowId || flowId.startsWith('--')) {
        throw new Error('--flow requires a flow id')
      }
      return recurse(index + 2, {
        flowIds: flags.flowIds.concat(flowId),
        list: flags.list,
        maxRpcMethods: flags.maxRpcMethods,
        suite: flags.suite
      })
    }
    if (argument === '--suite') {
      const suite = argv[index + 1]
      if (!suite || suite.startsWith('--')) {
        throw new Error('--suite requires smoke or full')
      }
      return recurse(index + 2, {
        flowIds: flags.flowIds,
        list: flags.list,
        maxRpcMethods: flags.maxRpcMethods,
        suite
      })
    }
    if (argument === '--max-rpc-methods') {
      const maxRpcMethods = argv[index + 1]
      if (!maxRpcMethods || maxRpcMethods.startsWith('--')) {
        throw new Error('--max-rpc-methods requires a positive integer')
      }
      return recurse(index + 2, {
        flowIds: flags.flowIds,
        list: flags.list,
        maxRpcMethods,
        suite: flags.suite
      })
    }
    if (argument.startsWith('--')) {
      throw new Error(`Unknown Tenderly QA option: ${argument}`)
    }
    throw new Error(`Unexpected Tenderly QA argument: ${argument}`)
  }

  return recurse(0, { flowIds: [], list: false })
}

function parseMaxRpcMethods(value: string | undefined): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 2) {
    throw new Error('--max-rpc-methods must be an integer of at least 2 so snapshot cleanup can be reserved')
  }
  return parsed
}

function parseSuite(value: string | undefined): TTenderlyQaSuite | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value !== 'smoke' && value !== 'full') {
    throw new Error(`Unknown Tenderly QA suite: ${value}`)
  }
  return value
}

function parseFlowIds(flowIds: readonly string[]): TTenderlyQaFlowId[] {
  return [...new Set(flowIds)].map((flowId) => {
    if (!TENDERLY_QA_FLOW_ID_SET.has(flowId)) {
      throw new Error(`Unknown Tenderly QA flow: ${flowId}`)
    }
    return flowId as TTenderlyQaFlowId
  })
}

export function parseTenderlyQaSelection(argv: readonly string[]): TTenderlyQaSelection {
  const flags = parseTenderlyQaFlags(argv)
  if (flags.list) {
    if (flags.flowIds.length > 0 || flags.suite || flags.maxRpcMethods) {
      throw new Error('--list cannot be combined with execution options')
    }
    return { list: true, flowIds: TENDERLY_QA_FLOW_IDS }
  }

  const suite = parseSuite(flags.suite)
  if (suite && flags.flowIds.length > 0) {
    throw new Error('Choose either --suite or --flow, not both')
  }
  if (!suite && flags.flowIds.length === 0) {
    throw new Error('Select Tenderly QA work with --suite <smoke|full> or one or more --flow <id> arguments')
  }

  const flowIds =
    suite === 'full'
      ? [...TENDERLY_QA_FLOW_IDS]
      : suite === 'smoke'
        ? [...TENDERLY_QA_SMOKE_FLOW_IDS]
        : parseFlowIds(flags.flowIds)

  return {
    list: false,
    flowIds,
    maxRpcMethods: parseMaxRpcMethods(flags.maxRpcMethods),
    suite
  }
}

export function shouldRunTenderlyQaFlow(
  selection: Exclude<TTenderlyQaSelection, { list: true }>,
  flowId: TTenderlyQaFlowId
): boolean {
  return selection.flowIds.includes(flowId)
}

export async function revertTenderlySnapshot({
  chain,
  rpcRequest,
  snapshotId
}: {
  chain: string
  rpcRequest: TTenderlyRpcRequest
  snapshotId: string
}): Promise<void> {
  const reverted = await rpcRequest('evm_revert', [snapshotId])
  if (reverted !== true) {
    throw new Error(`Unable to revert the ${chain} Tenderly QA snapshot`)
  }
}

export function extractJsonRpcMethods(body: BodyInit | null | undefined): string[] {
  if (typeof body !== 'string') {
    throw new Error('Tenderly RPC requests must use a JSON string body')
  }

  const parsed = JSON.parse(body) as TJsonRpcRequest | TJsonRpcRequest[]
  const requests = Array.isArray(parsed) ? parsed : [parsed]
  if (requests.length === 0) {
    throw new Error('Tenderly RPC batches cannot be empty')
  }

  return requests.map((request) => {
    if (typeof request.method !== 'string' || request.method.length === 0) {
      throw new Error('Tenderly RPC requests must declare a method')
    }
    return request.method
  })
}

function getChainState(state: Record<string, TRpcBudgetChainState>, chain: string): TRpcBudgetChainState {
  if (!state[chain]) {
    state[chain] = {
      httpRequests: 0,
      methodCounts: {},
      reservedCleanups: 0
    }
  }
  return state[chain]
}

export function createTenderlyRpcBudget({
  allowedMethods = TENDERLY_QA_ALLOWED_RPC_METHODS,
  maxRpcMethods
}: {
  allowedMethods?: ReadonlySet<string>
  maxRpcMethods: number
}): TTenderlyRpcBudget {
  if (!Number.isInteger(maxRpcMethods) || maxRpcMethods < 1) {
    throw new Error('Tenderly RPC method budget must be a positive integer')
  }

  const chainState: Record<string, TRpcBudgetChainState> = {}
  const totalRpcMethods = (): number =>
    Object.values(chainState).reduce(
      (total, chain) => total + Object.values(chain.methodCounts).reduce((chainTotal, count) => chainTotal + count, 0),
      0
    )
  const totalReservedCleanups = (): number =>
    Object.values(chainState).reduce((total, chain) => total + chain.reservedCleanups, 0)

  const summary = (): TTenderlyRpcBudgetSummary => ({
    maxRpcMethods,
    totalHttpRequests: Object.values(chainState).reduce((total, chain) => total + chain.httpRequests, 0),
    totalRpcMethods: totalRpcMethods(),
    outstandingCleanupReservations: totalReservedCleanups(),
    chains: Object.fromEntries(
      Object.entries(chainState).map(([chain, state]) => [
        chain,
        {
          httpRequests: state.httpRequests,
          methodCounts: { ...state.methodCounts },
          reservedCleanups: state.reservedCleanups
        }
      ])
    )
  })

  return {
    assertAllCleanupsConsumed: () => {
      const outstanding = totalReservedCleanups()
      if (outstanding > 0) {
        throw new Error(`Tenderly QA finished with ${outstanding} unconsumed snapshot cleanup reservation(s)`)
      }
    },
    recordRequest: (chain, body) => {
      const methods = extractJsonRpcMethods(body)
      const unexpectedMethod = methods.find((method) => !allowedMethods.has(method))
      if (unexpectedMethod) {
        throw new Error(`Unexpected Tenderly RPC method blocked before network I/O: ${unexpectedMethod}`)
      }

      const currentChainState = getChainState(chainState, chain)
      const cleanupMethods = methods.filter((method) => method === 'evm_revert').length
      if (cleanupMethods > currentChainState.reservedCleanups) {
        throw new Error(`Tenderly cleanup request on ${chain} has no reserved snapshot slot`)
      }

      const projectedTotal = totalRpcMethods() + methods.length
      const projectedReservations = totalReservedCleanups() - cleanupMethods
      if (projectedTotal + projectedReservations > maxRpcMethods) {
        throw new Error(
          `Tenderly RPC budget exhausted before network I/O: ${projectedTotal + projectedReservations}/${maxRpcMethods} methods including reserved cleanup`
        )
      }

      currentChainState.httpRequests += 1
      currentChainState.reservedCleanups -= cleanupMethods
      methods.forEach((method) => {
        currentChainState.methodCounts[method] = (currentChainState.methodCounts[method] || 0) + 1
      })
    },
    releaseCleanup: (chain) => {
      const currentChainState = getChainState(chainState, chain)
      if (currentChainState.reservedCleanups === 0) {
        throw new Error(`Tenderly cleanup reservation on ${chain} is already empty`)
      }
      currentChainState.reservedCleanups -= 1
    },
    reserveCleanup: (chain) => {
      if (totalRpcMethods() + totalReservedCleanups() + 2 > maxRpcMethods) {
        throw new Error(
          `Tenderly RPC budget cannot reserve snapshot and cleanup on ${chain}: ${maxRpcMethods} method limit`
        )
      }
      getChainState(chainState, chain).reservedCleanups += 1
    },
    summary
  }
}

export function createBudgetedTenderlyFetch({
  budget,
  chain,
  fetchFn = fetch
}: {
  budget: TTenderlyRpcBudget
  chain: string
  fetchFn?: typeof fetch
}): typeof fetch {
  return async (input, init) => {
    budget.recordRequest(chain, init?.body)
    return await fetchFn(input, init)
  }
}
