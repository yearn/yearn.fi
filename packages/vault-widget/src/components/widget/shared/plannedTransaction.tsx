import {
  buildTransactionPlan,
  type VaultWidgetTransactionMode,
  type VaultWidgetTransactionPlan
} from '@yearn/vault-widget/headless'
import type { AppUseSimulateContractReturnType } from '@yearn/vault-widget/types'
import { type Abi, encodeFunctionData, type Hex, isAddress, isHex } from 'viem'

const ELIGIBLE_ROUTES: Readonly<Record<VaultWidgetTransactionMode, readonly string[]>> = Object.freeze({
  deposit: Object.freeze(['DIRECT_DEPOSIT', 'DIRECT_STAKE', 'YBOLD_ZAPPER']),
  withdraw: Object.freeze(['DIRECT_WITHDRAW', 'DIRECT_UNSTAKE', 'YBOLD_ZAPPER_WITHDRAW'])
})

type TPreparedRequest = NonNullable<NonNullable<AppUseSimulateContractReturnType['data']>['request']>

export type TBuildEligibleStyledWidgetPlanParams = {
  canonicalChainId: number
  connectedCanonicalChainId?: number
  hasBatch?: boolean
  id: string
  isCrossChain: boolean
  isEnabled?: boolean
  isExecutionConfigured: boolean
  isPermit?: boolean
  isWalletSafe: boolean
  label: string
  mode: VaultWidgetTransactionMode
  needsApproval: boolean
  prepare?: AppUseSimulateContractReturnType
  routeType: string
}

function resolvePreparedCallData(request: TPreparedRequest): Hex | undefined {
  if (isHex(request.data)) return request.data
  if (!Array.isArray(request.abi) || typeof request.functionName !== 'string') return undefined

  try {
    return encodeFunctionData({
      abi: request.abi as Abi,
      functionName: request.functionName,
      args: request.args as readonly unknown[] | undefined
    })
  } catch {
    return undefined
  }
}

function isEligibleRoute(mode: VaultWidgetTransactionMode, routeType: string): boolean {
  return ELIGIBLE_ROUTES[mode].includes(routeType)
}

/**
 * Converts the final, already-simulated styled-widget request into the public
 * headless plan shape. Returning undefined is intentional: callers must keep
 * using the battle-tested legacy overlay whenever eligibility is uncertain.
 */
export function buildEligibleStyledWidgetPlan({
  canonicalChainId,
  connectedCanonicalChainId,
  hasBatch = false,
  id,
  isCrossChain,
  isEnabled = true,
  isExecutionConfigured,
  isPermit = false,
  isWalletSafe,
  label,
  mode,
  needsApproval,
  prepare,
  routeType
}: TBuildEligibleStyledWidgetPlanParams): VaultWidgetTransactionPlan | undefined {
  if (
    isWalletSafe ||
    !isExecutionConfigured ||
    isCrossChain ||
    needsApproval ||
    hasBatch ||
    isPermit ||
    !isEnabled ||
    !isEligibleRoute(mode, routeType) ||
    !Number.isSafeInteger(canonicalChainId) ||
    canonicalChainId <= 0 ||
    connectedCanonicalChainId !== canonicalChainId ||
    !prepare?.isSuccess
  ) {
    return undefined
  }

  const request = prepare.data?.request
  if (
    !request ||
    request.__isEnsoOrder === true ||
    typeof request.address !== 'string' ||
    !isAddress(request.address)
  ) {
    return undefined
  }
  if (request.value !== undefined && (typeof request.value !== 'bigint' || request.value < 0n)) return undefined

  const data = resolvePreparedCallData(request)
  if (!data) return undefined

  return buildTransactionPlan({
    connectedChainId: connectedCanonicalChainId,
    walletType: 'eoa',
    intent: {
      id,
      mode,
      calls: [
        {
          id: mode,
          label,
          request: {
            chainId: canonicalChainId,
            to: request.address,
            data,
            value: request.value as bigint | undefined
          }
        }
      ]
    }
  })
}
