import { decodeFunctionData, isAddressEqual, toFunctionSignature } from 'viem'
import { strategyManagementAbi } from './abi'
import type { TPendingTimelockStrategy, TTimelockControllerConfig, TTimelockStrategyStatus } from './types'

export type TTimelockScheduledCall = {
  operationId: `0x${string}`
  index: number
  target: `0x${string}`
  data: `0x${string}`
  delay: number
  blockTimestamp: number
  transactionHash: `0x${string}`
}

export type TTimelockOperationStatus = {
  isPending: boolean
  isReady: boolean
  isDone: boolean
  timestamp: number
}

export type TDecodePendingTimelockStrategiesParams = {
  controller: TTimelockControllerConfig
  vaultAddress: `0x${string}`
  scheduledCalls: TTimelockScheduledCall[]
  operationStatuses: Map<`0x${string}`, TTimelockOperationStatus>
  strategyMetadata?: Map<`0x${string}`, { name?: string; symbol?: string }>
}

type TDecodedManagementCall =
  | {
      index: number
      operationId: `0x${string}`
      target: `0x${string}`
      name: 'add_strategy'
      strategyAddress: `0x${string}`
      signature: string
      raw: TTimelockScheduledCall
    }
  | {
      index: number
      operationId: `0x${string}`
      target: `0x${string}`
      name: 'update_max_debt_for_strategy'
      strategyAddress: `0x${string}`
      maxDebtRaw: string
      signature: string
      raw: TTimelockScheduledCall
    }
  | {
      index: number
      operationId: `0x${string}`
      target: `0x${string}`
      name: 'update_debt' | 'set_default_queue'
      signature: string
      raw: TTimelockScheduledCall
    }

type TDecodedAddStrategyCall = Extract<TDecodedManagementCall, { name: 'add_strategy' }>
type TDecodedUpdateMaxDebtCall = Extract<TDecodedManagementCall, { name: 'update_max_debt_for_strategy' }>

function decodeManagementCall(call: TTimelockScheduledCall): TDecodedManagementCall | null {
  try {
    const decoded = decodeFunctionData({ abi: strategyManagementAbi, data: call.data })
    const abiItem = strategyManagementAbi.find((item) => item.type === 'function' && item.name === decoded.functionName)
    const signature = abiItem ? toFunctionSignature(abiItem) : decoded.functionName

    if (decoded.functionName === 'add_strategy') {
      return {
        index: call.index,
        operationId: call.operationId,
        target: call.target,
        name: decoded.functionName,
        strategyAddress: decoded.args[0],
        signature,
        raw: call
      }
    }

    if (decoded.functionName === 'update_max_debt_for_strategy') {
      return {
        index: call.index,
        operationId: call.operationId,
        target: call.target,
        name: decoded.functionName,
        strategyAddress: decoded.args[0],
        maxDebtRaw: decoded.args[1].toString(),
        signature,
        raw: call
      }
    }

    return {
      index: call.index,
      operationId: call.operationId,
      target: call.target,
      name: decoded.functionName,
      signature,
      raw: call
    }
  } catch {
    return null
  }
}

const groupByOperationId = (calls: TTimelockScheduledCall[]): Map<`0x${string}`, TTimelockScheduledCall[]> =>
  calls.reduce((groups, call) => {
    const operationCalls = groups.get(call.operationId) ?? []
    groups.set(call.operationId, [...operationCalls, call])
    return groups
  }, new Map<`0x${string}`, TTimelockScheduledCall[]>())

export function decodePendingTimelockStrategies({
  controller,
  vaultAddress,
  scheduledCalls,
  operationStatuses,
  strategyMetadata = new Map()
}: TDecodePendingTimelockStrategiesParams): TPendingTimelockStrategy[] {
  return [...groupByOperationId(scheduledCalls)]
    .flatMap(([operationId, operationCalls]) => {
      const liveStatus = operationStatuses.get(operationId)

      if (!liveStatus?.isPending || liveStatus.isDone) {
        return []
      }

      const decodedCalls = operationCalls
        .map((call) => decodeManagementCall(call))
        .filter((call): call is TDecodedManagementCall => call !== null)
        .sort((a, b) => a.index - b.index)
      const addStrategyCalls = decodedCalls.filter(
        (call): call is TDecodedAddStrategyCall =>
          call.name === 'add_strategy' && isAddressEqual(call.target, vaultAddress)
      )

      return addStrategyCalls.map((addCall) => {
        const maxDebtCall = decodedCalls.find(
          (call): call is TDecodedUpdateMaxDebtCall =>
            call.name === 'update_max_debt_for_strategy' &&
            isAddressEqual(call.target, vaultAddress) &&
            isAddressEqual(call.strategyAddress, addCall.strategyAddress)
        )
        const metadata = strategyMetadata.get(addCall.strategyAddress)
        const status: TTimelockStrategyStatus = liveStatus.isReady ? 'ready' : 'queued'

        return {
          chainId: controller.chainId,
          timelockAddress: controller.timelockAddress,
          vaultAddress,
          strategyAddress: addCall.strategyAddress,
          operationId,
          status,
          queuedAt: addCall.raw.blockTimestamp,
          eta: liveStatus.timestamp,
          delay: addCall.raw.delay,
          scheduleTxHash: addCall.raw.transactionHash,
          executorLabel: controller.executorLabel,
          strategyName: metadata?.name,
          strategySymbol: metadata?.symbol,
          maxDebtRaw: maxDebtCall?.maxDebtRaw,
          decodedCalls: decodedCalls.map((call) => ({
            index: call.index,
            signature: call.signature,
            target: call.target
          }))
        }
      })
    })
    .sort((a, b) => a.eta - b.eta)
}
