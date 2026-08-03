import type { SimulateContractData } from '@wagmi/core/query'
import { useVaultWidgetRuntime } from '@yearn/vault-widget/runtime'
import type { AppUseSimulateContractReturnType } from '@yearn/vault-widget/types'
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

export type { AppUseSimulateContractReturnType }

const DISABLED_CHAIN_ID = Number.MAX_SAFE_INTEGER

type ChainResolver = (chainId: number | undefined) => number | undefined

function resolveHookChainId(chainId: number | undefined, resolveExecutionChainId: ChainResolver): number | undefined {
  if (!Number.isInteger(chainId)) {
    return undefined
  }
  return resolveExecutionChainId(chainId) ?? DISABLED_CHAIN_ID
}

function isUnsupportedRequestedChain(chainId: number | undefined, resolveExecutionChainId: ChainResolver): boolean {
  return Number.isInteger(chainId) && resolveExecutionChainId(chainId) === undefined
}

export function useChainId(): number {
  const rawChainId = useWagmiChainId()
  const { chains } = useVaultWidgetRuntime()
  return chains.resolveCanonicalChainId(rawChainId) ?? rawChainId
}

export function useSwitchChain(): UseSwitchChainReturnType {
  const wagmiSwitchChain = useWagmiSwitchChain()
  const { chains } = useVaultWidgetRuntime()

  const switchChain = useCallback<UseSwitchChainReturnType['switchChain']>(
    (parameters) => {
      const chainId = chains.resolveExecutionChainId(parameters.chainId)
      if (chainId === undefined) {
        throw new Error(`Chain ${parameters.chainId} is not enabled for execution`)
      }
      return wagmiSwitchChain.switchChain?.({ ...parameters, chainId })
    },
    [chains, wagmiSwitchChain.switchChain]
  )

  const switchChainAsync = useCallback<UseSwitchChainReturnType['switchChainAsync']>(
    async (parameters) => {
      const chainId = chains.resolveExecutionChainId(parameters.chainId)
      if (chainId === undefined) {
        throw new Error(`Chain ${parameters.chainId} is not enabled for execution`)
      }
      return await wagmiSwitchChain.switchChainAsync?.({ ...parameters, chainId })
    },
    [chains, wagmiSwitchChain.switchChainAsync]
  )

  return { ...wagmiSwitchChain, switchChain, switchChainAsync }
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
  const { chains } = useVaultWidgetRuntime()
  const unsupported = isUnsupportedRequestedChain(parameters.chainId, chains.resolveExecutionChainId)

  return useWagmiReadContract({
    ...parameters,
    chainId: resolveHookChainId(parameters.chainId, chains.resolveExecutionChainId),
    query: {
      ...(parameters.query || {}),
      enabled: !unsupported && (parameters.query?.enabled ?? true)
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
  const { chains } = useVaultWidgetRuntime()
  const unsupported = isUnsupportedRequestedChain(parameters?.chainId, chains.resolveExecutionChainId)
  const resolvedParameters = parameters
    ? ({
        ...parameters,
        chainId: resolveHookChainId(parameters.chainId, chains.resolveExecutionChainId) as chainId,
        query: {
          ...(parameters.query || {}),
          enabled: !unsupported && (parameters.query?.enabled ?? true)
        }
      } as UseSimulateContractParameters<abi, functionName, args, Config, chainId, selectData>)
    : undefined

  return useWagmiSimulateContract(resolvedParameters as never) as UseSimulateContractReturnType<
    abi,
    functionName,
    args,
    Config,
    chainId,
    selectData
  >
}

export function useBlockNumber<chainId extends Config['chains'][number]['id'] = Config['chains'][number]['id']>(
  parameters?: UseBlockNumberParameters<Config, chainId>
): UseBlockNumberReturnType {
  const { chains } = useVaultWidgetRuntime()
  const unsupported = isUnsupportedRequestedChain(parameters?.chainId, chains.resolveExecutionChainId)

  return useWagmiBlockNumber({
    ...(parameters || {}),
    chainId: resolveHookChainId(parameters?.chainId, chains.resolveExecutionChainId) as chainId,
    query: {
      ...(parameters?.query || {}),
      enabled: !unsupported && (parameters?.query?.enabled ?? true)
    },
    watch: !unsupported && Boolean(parameters?.watch)
  } as UseBlockNumberParameters<Config, chainId>)
}

export function useWaitForTransactionReceipt<
  chainId extends Config['chains'][number]['id'] = Config['chains'][number]['id']
>(
  parameters: UseWaitForTransactionReceiptParameters<Config, chainId>
): UseWaitForTransactionReceiptReturnType<Config, chainId> {
  const { chains } = useVaultWidgetRuntime()
  const unsupported = isUnsupportedRequestedChain(parameters.chainId, chains.resolveExecutionChainId)

  return useWagmiWaitForTransactionReceipt({
    ...parameters,
    chainId: resolveHookChainId(parameters.chainId, chains.resolveExecutionChainId) as chainId,
    hash: unsupported ? undefined : parameters.hash,
    query: {
      ...(parameters.query || {}),
      enabled: !unsupported && (parameters.query?.enabled ?? true)
    }
  } as UseWaitForTransactionReceiptParameters<Config, chainId>)
}

export function usePublicClient<chainId extends Config['chains'][number]['id'] | number | undefined = undefined>(
  parameters?: UsePublicClientParameters<Config, chainId>
): UsePublicClientReturnType<Config, chainId> {
  const { chains } = useVaultWidgetRuntime()
  return useWagmiPublicClient({
    ...(parameters || {}),
    chainId: resolveHookChainId(parameters?.chainId, chains.resolveExecutionChainId) as chainId
  } as UsePublicClientParameters<Config, chainId>)
}
