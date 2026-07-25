'use client'

import { useQueries, useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { erc20Abi } from 'viem'
import { useAccount, useConfig } from 'wagmi'
import { getPublicClient } from 'wagmi/actions'
import { useVaultWidgetServices } from '../context'
import { addVaultWidgetActivitySafely, updateVaultWidgetActivitySafely } from '../services/activity'
import type {
  VaultWidgetEvent,
  VaultWidgetExecutionState,
  VaultWidgetQuote,
  VaultWidgetTransactionMode,
  VaultWidgetTransactionPlan,
  VaultWidgetWalletType
} from '../types'
import { getQuoteApprovalTargets } from './approvals'
import { executeVaultWidgetPlan } from './executeTransactionPlan'
import { buildTransactionPlan } from './transactionPlan'

export type VaultWidgetActionActivity = {
  chainId: number
  destinationChainId?: number
  tokenIn?: `0x${string}`
  tokenOut?: `0x${string}`
}

export type UseVaultWidgetActionControllerParams = {
  activity: VaultWidgetActionActivity
  mode: Extract<VaultWidgetTransactionMode, 'migrate' | 'rewards'>
  onError?: (event: Extract<VaultWidgetEvent, { type: 'transaction_failed' }>) => void
  onEvent?: (event: VaultWidgetEvent) => void
  onRefresh?: () => Promise<void>
  onSuccess?: (event: Extract<VaultWidgetEvent, { type: 'transaction_succeeded' }>) => void
  quote?: VaultWidgetQuote
}

export type VaultWidgetActionController = {
  allowance: bigint
  canSubmit: boolean
  execution: VaultWidgetExecutionState
  isLoading: boolean
  plan?: VaultWidgetTransactionPlan
  submit: () => Promise<void>
  walletType: VaultWidgetWalletType
}

function getError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value))
}

export function useVaultWidgetActionController({
  activity,
  mode,
  onError,
  onEvent,
  onRefresh,
  onSuccess,
  quote
}: UseVaultWidgetActionControllerParams): VaultWidgetActionController {
  const accountState = useAccount()
  const account = accountState.address
  const wagmiConfig = useConfig()
  const services = useVaultWidgetServices()
  const [execution, setExecution] = useState<VaultWidgetExecutionState>({ status: 'idle' })
  const approvalTargets = getQuoteApprovalTargets(quote)
  const allowanceQueries = useQueries({
    queries: approvalTargets.map((target) => ({
      queryKey: [
        'vault-widget',
        mode,
        'action-allowance',
        account,
        target.token.chainId,
        target.token.address,
        target.spender
      ],
      queryFn: async (): Promise<bigint> => {
        if (!account) return 0n
        const approvalClient = getPublicClient(wagmiConfig, { chainId: target.token.chainId })
        if (!approvalClient) return 0n
        return approvalClient.readContract({
          address: target.token.address,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [account, target.spender]
        })
      },
      enabled: !!account,
      refetchInterval: 15_000
    }))
  })
  const walletTypeQuery = useQuery({
    queryKey: ['vault-widget', mode, 'action-wallet-type', account, accountState.connector?.id],
    queryFn: async (): Promise<VaultWidgetWalletType> => {
      if (!account || !services.execution.getWalletType) return 'eoa'
      return services.execution.getWalletType({ account, config: wagmiConfig })
    },
    enabled: !!account && !!services.execution.getWalletType,
    staleTime: Number.POSITIVE_INFINITY
  })
  const allowances = allowanceQueries.map(({ data }) => data ?? 0n)
  const allowance = allowances[0] ?? 0n
  const walletType = walletTypeQuery.data ?? 'eoa'
  const plan = useMemo(
    () =>
      quote
        ? buildTransactionPlan({
            allowance,
            allowances,
            connectedChainId: accountState.chainId,
            mode,
            quote,
            walletType
          })
        : undefined,
    [accountState.chainId, allowance, allowances, mode, quote, walletType]
  )
  const isExecuting =
    execution.status === 'confirming' || execution.status === 'pending' || execution.status === 'submitted'
  const canSubmit =
    !!account &&
    !!plan &&
    !isExecuting &&
    !(services.execution.getWalletType && walletTypeQuery.isLoading) &&
    !allowanceQueries.some(({ isLoading }) => isLoading)

  const submit = useCallback(async (): Promise<void> => {
    if (!account || !plan || !canSubmit) return
    onEvent?.({ type: 'transaction_started', plan })
    const activityId = await addVaultWidgetActivitySafely(services.activityStore, {
      account,
      amount: plan.quote.activityAmount ?? '0',
      bridge: plan.quote.bridge,
      chainId: activity.chainId,
      destinationChainId: activity.destinationChainId,
      status: 'pending',
      timestamp: Date.now(),
      tokenIn: activity.tokenIn,
      tokenOut: activity.tokenOut,
      type: plan.quote.activityType ?? (mode === 'migrate' ? 'migrate' : 'claim')
    })

    try {
      const outcome = await executeVaultWidgetPlan({
        account,
        config: wagmiConfig,
        ensoBridge: services.ensoBridge,
        execution: services.execution,
        onEvent,
        onExecution: setExecution,
        onProgress: async ({ hash, isFinalTransaction, proposalId }) => {
          await updateVaultWidgetActivitySafely(services.activityStore, activityId, {
            hash,
            isFinalTransaction,
            proposalId,
            status: 'submitted',
            timestamp: Date.now()
          })
        },
        onRefresh: async () => {
          await Promise.allSettled([...allowanceQueries.map((query) => query.refetch()), onRefresh?.()])
        },
        onSubmitted: async (hash) => {
          await updateVaultWidgetActivitySafely(services.activityStore, activityId, {
            hash,
            status: 'submitted',
            timestamp: Date.now()
          })
        },
        plan
      })
      await updateVaultWidgetActivitySafely(services.activityStore, activityId, {
        destinationHash: outcome.destinationHash,
        hash: outcome.hash,
        status: 'success',
        timestamp: Date.now()
      })
      const event: Extract<VaultWidgetEvent, { type: 'transaction_succeeded' }> = {
        type: 'transaction_succeeded',
        plan,
        ...outcome
      }
      setExecution({ status: 'success', ...outcome })
      onEvent?.(event)
      onSuccess?.(event)
    } catch (value) {
      const error = getError(value)
      await updateVaultWidgetActivitySafely(services.activityStore, activityId, {
        status: 'error',
        timestamp: Date.now()
      })
      const event: Extract<VaultWidgetEvent, { type: 'transaction_failed' }> = {
        type: 'transaction_failed',
        plan,
        error
      }
      setExecution({ status: 'error', error })
      onEvent?.(event)
      onError?.(event)
    }
  }, [
    account,
    activity,
    canSubmit,
    mode,
    onError,
    onEvent,
    onRefresh,
    onSuccess,
    plan,
    allowanceQueries,
    services.activityStore,
    services.ensoBridge,
    services.execution,
    wagmiConfig
  ])

  return {
    allowance,
    canSubmit,
    execution,
    isLoading: allowanceQueries.some(({ isLoading }) => isLoading) || walletTypeQuery.isLoading,
    plan,
    submit,
    walletType
  }
}
