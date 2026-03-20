import type { SimulateContractData } from '@wagmi/core/query'
import { useCallback } from 'react'
import type { Abi, ContractFunctionArgs, ContractFunctionName } from 'viem'
import type {
  Config,
  UseBlockNumberParameters,
  UseBlockNumberReturnType,
  UsePublicClientParameters,
  UsePublicClientReturnType,
  UseReadContractParameters,
  UseReadContractReturnType,
  UseSimulateContractParameters,
  UseSimulateContractReturnType,
  UseSwitchChainReturnType,
  UseWaitForTransactionReceiptParameters,
  UseWaitForTransactionReceiptReturnType
} from 'wagmi'
import {
  useBlockNumber as useWagmiBlockNumber,
  useChainId as useWagmiChainId,
  usePublicClient as useWagmiPublicClient,
  useReadContract as useWagmiReadContract,
  useSimulateContract as useWagmiSimulateContract,
  useSwitchChain as useWagmiSwitchChain,
  useWaitForTransactionReceipt as useWagmiWaitForTransactionReceipt
} from 'wagmi'
import { isTenderlyModeEnabled, resolveConnectedCanonicalChainId, resolveExecutionChainId } from '@/config/tenderly'

const DISABLED_CHAIN_ID = Number.MAX_SAFE_INTEGER

function resolveHookChainId(chainId?: number): number | undefined {
  if (!Number.isInteger(chainId)) {
    return undefined
  }

  const resolvedChainId = resolveExecutionChainId(chainId)
  if (resolvedChainId !== undefined) {
    return resolvedChainId
  }

  return isTenderlyModeEnabled() ? DISABLED_CHAIN_ID : chainId
}

function isUnsupportedRequestedChain(chainId?: number): boolean {
  return Number.isInteger(chainId) && resolveExecutionChainId(chainId) === undefined
}

export type AppUseSimulateContractReturnType = {
  data?: {
    request?: {
      chainId?: number
      address?: unknown
      functionName?: unknown
      args?: readonly unknown[]
      [key: string]: unknown
    }
    result?: unknown
    [key: string]: unknown
  }
  error?: unknown
  isError: boolean
  isFetching: boolean
  isLoading: boolean
  isPending?: boolean
  isRefetching?: boolean
  isSuccess: boolean
  refetch?: () => Promise<unknown> | unknown
  status: string
  [key: string]: unknown
}

export function useChainId(): number {
  const rawChainId = useWagmiChainId()
  return resolveConnectedCanonicalChainId(rawChainId) ?? (isTenderlyModeEnabled() ? 0 : rawChainId)
}

export function useSwitchChain(): UseSwitchChainReturnType {
  const wagmiSwitchChain = useWagmiSwitchChain()

  const switchChain = useCallback<UseSwitchChainReturnType['switchChain']>(
    (parameters) => {
      const executionChainId = resolveExecutionChainId(parameters.chainId)
      if (executionChainId === undefined) {
        throw new Error(`Chain ${parameters.chainId} is not enabled for execution`)
      }

      return wagmiSwitchChain.switchChain?.({ ...parameters, chainId: executionChainId })
    },
    [wagmiSwitchChain]
  )

  const switchChainAsync = useCallback<UseSwitchChainReturnType['switchChainAsync']>(
    async (parameters) => {
      const executionChainId = resolveExecutionChainId(parameters.chainId)
      if (executionChainId === undefined) {
        throw new Error(`Chain ${parameters.chainId} is not enabled for execution`)
      }

      return await wagmiSwitchChain.switchChainAsync?.({ ...parameters, chainId: executionChainId })
    },
    [wagmiSwitchChain]
  )

  return {
    ...wagmiSwitchChain,
    switchChain,
    switchChainAsync
  }
}

export function useReadContract<
  abi extends Abi | readonly unknown[] = Abi,
  functionName extends ContractFunctionName<abi, 'pure' | 'view'> = ContractFunctionName<abi, 'pure' | 'view'>,
  args extends ContractFunctionArgs<abi, 'pure' | 'view', functionName> = ContractFunctionArgs<
    abi,
    'pure' | 'view',
    functionName
  >
>(parameters: UseReadContractParameters<abi, functionName, args>): UseReadContractReturnType<abi, functionName, args> {
  const unsupportedRequestedChain = isUnsupportedRequestedChain(parameters.chainId)

  return useWagmiReadContract({
    ...parameters,
    chainId: resolveHookChainId(parameters.chainId),
    query: {
      ...(parameters.query || {}),
      enabled: !unsupportedRequestedChain && (parameters.query?.enabled ?? true)
    }
  } as UseReadContractParameters<abi, functionName, args>)
}

export function useSimulateContract<
  abi extends Abi | readonly unknown[] = Abi,
  functionName extends ContractFunctionName<abi, 'nonpayable' | 'payable'> = ContractFunctionName<
    abi,
    'nonpayable' | 'payable'
  >,
  args extends ContractFunctionArgs<abi, 'nonpayable' | 'payable', functionName> = ContractFunctionArgs<
    abi,
    'nonpayable' | 'payable',
    functionName
  >,
  chainId extends Config['chains'][number]['id'] | undefined = undefined,
  selectData = SimulateContractData<abi, functionName, args, Config, chainId>
>(
  parameters?: UseSimulateContractParameters<abi, functionName, args, Config, chainId, selectData>
): UseSimulateContractReturnType<abi, functionName, args, Config, chainId, selectData> {
  const unsupportedRequestedChain = isUnsupportedRequestedChain(parameters?.chainId)

  return useWagmiSimulateContract({
    ...(parameters || {}),
    chainId: resolveHookChainId(parameters?.chainId) as chainId,
    query: {
      ...(parameters?.query || {}),
      enabled: !unsupportedRequestedChain && (parameters?.query?.enabled ?? true)
    }
  } as UseSimulateContractParameters<abi, functionName, args, Config, chainId, selectData>)
}

export function useBlockNumber<chainId extends Config['chains'][number]['id'] = Config['chains'][number]['id']>(
  parameters?: UseBlockNumberParameters<Config, chainId>
): UseBlockNumberReturnType {
  const unsupportedRequestedChain = isUnsupportedRequestedChain(parameters?.chainId)

  return useWagmiBlockNumber({
    ...(parameters || {}),
    chainId: resolveHookChainId(parameters?.chainId) as chainId,
    query: {
      ...(parameters?.query || {}),
      enabled: !unsupportedRequestedChain && (parameters?.query?.enabled ?? true)
    },
    watch: !unsupportedRequestedChain && Boolean(parameters?.watch)
  } as UseBlockNumberParameters<Config, chainId>)
}

export function useWaitForTransactionReceipt<
  chainId extends Config['chains'][number]['id'] = Config['chains'][number]['id']
>(
  parameters: UseWaitForTransactionReceiptParameters<Config, chainId>
): UseWaitForTransactionReceiptReturnType<Config, chainId> {
  const unsupportedRequestedChain = isUnsupportedRequestedChain(parameters.chainId)

  return useWagmiWaitForTransactionReceipt({
    ...parameters,
    chainId: resolveHookChainId(parameters.chainId) as chainId,
    hash: unsupportedRequestedChain ? undefined : parameters.hash,
    query: {
      ...(parameters.query || {}),
      enabled: !unsupportedRequestedChain && (parameters.query?.enabled ?? true)
    }
  } as UseWaitForTransactionReceiptParameters<Config, chainId>)
}

export function usePublicClient<chainId extends Config['chains'][number]['id'] | number | undefined = undefined>(
  parameters?: UsePublicClientParameters<Config, chainId>
): UsePublicClientReturnType<Config, chainId> {
  return useWagmiPublicClient({
    ...(parameters || {}),
    chainId: resolveHookChainId(parameters?.chainId) as chainId
  } as UsePublicClientParameters<Config, chainId>)
}
