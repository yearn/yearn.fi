'use client'

import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { type Address, erc20Abi, formatUnits, type Hash, isAddressEqual, parseUnits } from 'viem'
import { useAccount, useConfig, usePublicClient } from 'wagmi'
import { switchChain } from 'wagmi/actions'
import { useVaultWidgetServices } from '../context'
import type { VaultWidgetSettings } from '../services'
import type {
  VaultWidgetApprovalTarget,
  VaultWidgetConfig,
  VaultWidgetEvent,
  VaultWidgetExecutionState,
  VaultWidgetExecutionStep,
  VaultWidgetMode,
  VaultWidgetQuote,
  VaultWidgetToken,
  VaultWidgetTransactionPlan
} from '../types'
import { buildTransactionPlan } from './transactionPlan'

type UseVaultWidgetControllerParams = {
  config: VaultWidgetConfig
  mode?: VaultWidgetMode
  defaultMode?: VaultWidgetMode
  onModeChange?: (mode: VaultWidgetMode) => void
  onEvent?: (event: VaultWidgetEvent) => void
  onSuccess?: (event: Extract<VaultWidgetEvent, { type: 'transaction_succeeded' }>) => void
  onError?: (event: Extract<VaultWidgetEvent, { type: 'transaction_failed' }>) => void
}

type VaultWidgetController = {
  account?: Address
  allowance: bigint
  amount: string
  balance: bigint
  balanceFormatted: string
  canSubmit: boolean
  error?: Error
  execution: VaultWidgetExecutionState
  isLoading: boolean
  isQuoteLoading: boolean
  mode: VaultWidgetMode
  modes: readonly VaultWidgetMode[]
  overBalance: boolean
  plan?: VaultWidgetTransactionPlan
  approvalTarget?: VaultWidgetApprovalTarget
  positionBalance: bigint
  positionValue: bigint
  quote?: VaultWidgetQuote
  selectedToken: VaultWidgetToken
  settings: VaultWidgetSettings
  tokens: readonly VaultWidgetToken[]
  setAmount: (amount: string) => void
  setMode: (mode: VaultWidgetMode) => void
  setPercentage: (percentage: number) => void
  setSelectedToken: (token: VaultWidgetToken) => void
  setSettings: (settings: VaultWidgetSettings) => void
  submit: () => Promise<void>
  reset: () => void
}

function getDefaultToken(config: VaultWidgetConfig, mode: VaultWidgetMode): VaultWidgetToken {
  const tokens = mode === 'withdraw' ? config.withdrawTokens : config.depositTokens
  const preferredAddress = mode === 'withdraw' ? config.defaultWithdrawToken : config.defaultDepositToken
  return (
    tokens.find((token) => preferredAddress && isAddressEqual(token.address, preferredAddress)) ??
    tokens[0] ??
    config.positionToken
  )
}

function parseAmount(value: string, decimals: number): bigint {
  if (!value || !/^\d*\.?\d*$/.test(value)) return 0n
  try {
    return parseUnits(value, decimals)
  } catch {
    return 0n
  }
}

function getActivityType(
  mode: 'deposit' | 'withdraw',
  quote: VaultWidgetQuote
): 'deposit' | 'withdraw' | 'zap' | 'crosschain zap' | 'withdraw zap' | 'crosschain withdraw zap' {
  if (quote.adapterId !== 'enso') return mode
  if (mode === 'deposit') return quote.isCrossChain ? 'crosschain zap' : 'zap'
  return quote.isCrossChain ? 'crosschain withdraw zap' : 'withdraw zap'
}

function getError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value))
}

export function useVaultWidgetController({
  config,
  mode: controlledMode,
  defaultMode,
  onModeChange,
  onEvent,
  onSuccess,
  onError
}: UseVaultWidgetControllerParams): VaultWidgetController {
  const wagmiConfig = useConfig()
  const services = useVaultWidgetServices()
  const { address: account, chainId: connectedChainId } = useAccount()
  const modes = config.modes ?? ['deposit', 'withdraw']
  const initialMode = defaultMode ?? config.defaultMode ?? modes[0] ?? 'deposit'
  const [internalMode, setInternalMode] = useState<VaultWidgetMode>(initialMode)
  const mode = controlledMode ?? internalMode
  const transactionMode = mode === 'withdraw' ? 'withdraw' : 'deposit'
  const availableTokens = transactionMode === 'withdraw' ? config.withdrawTokens : config.depositTokens
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<Address>(
    getDefaultToken(config, initialMode).address
  )
  const selectedToken =
    availableTokens.find((token) => isAddressEqual(token.address, selectedTokenAddress)) ??
    getDefaultToken(config, mode)
  const [amount, setAmountValue] = useState('')
  const [execution, setExecution] = useState<VaultWidgetExecutionState>({ status: 'idle' })
  const [settings, setSettingsState] = useState<VaultWidgetSettings>(() => services.settings.read())
  const parsedAmount = parseAmount(amount, selectedToken.decimals)

  // Settings are an external browser store, so a subscription is the appropriate synchronization boundary.
  useEffect(() => services.settings.subscribe?.(() => setSettingsState(services.settings.read())), [services.settings])

  const balanceClient = usePublicClient({ chainId: selectedToken.chainId })
  const positionClient = usePublicClient({ chainId: config.positionToken.chainId })
  const quoteChainId = transactionMode === 'deposit' ? selectedToken.chainId : config.positionToken.chainId
  const quoteClient = usePublicClient({ chainId: quoteChainId })

  const balanceQuery = useQuery({
    queryKey: ['vault-widget', config.id, 'balance', account, selectedToken.chainId, selectedToken.address],
    queryFn: async (): Promise<bigint> => {
      if (!account || !balanceClient) return 0n
      if (selectedToken.isNative) return balanceClient.getBalance({ address: account })
      return balanceClient.readContract({
        address: selectedToken.address,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account]
      })
    },
    enabled: !!account && !!balanceClient,
    refetchInterval: 15_000
  })

  const positionBalanceQuery = useQuery({
    queryKey: ['vault-widget', config.id, 'position-balance', account, config.positionToken.address],
    queryFn: async (): Promise<bigint> => {
      if (!account || !positionClient) return 0n
      return positionClient.readContract({
        address: config.positionToken.address,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account]
      })
    },
    enabled: !!account && !!positionClient,
    refetchInterval: 15_000
  })

  const positionValueQuery = useQuery({
    queryKey: ['vault-widget', config.id, 'position-value', positionBalanceQuery.data?.toString() ?? '0'],
    queryFn: async (): Promise<bigint> => {
      const shares = positionBalanceQuery.data ?? 0n
      if (!positionClient || !config.readPositionValue || shares === 0n) return shares
      return config.readPositionValue(positionClient, shares)
    },
    enabled: !!positionClient && (positionBalanceQuery.data ?? 0n) > 0n
  })

  const adapter = config.adapters.find((candidate) =>
    candidate.supports({
      chainId: quoteChainId,
      mode: transactionMode,
      selectedToken
    })
  )

  const quoteQuery = useQuery({
    queryKey: [
      'vault-widget',
      config.id,
      'quote',
      account,
      transactionMode,
      selectedToken.chainId,
      selectedToken.address,
      parsedAmount.toString(),
      settings.maxLossBps,
      settings.slippagePercent
    ],
    queryFn: async ({ signal }): Promise<VaultWidgetQuote> => {
      if (!account || !adapter || !quoteClient) throw new Error('No route is available')
      const quote = await adapter.quote(
        {
          account,
          amount: parsedAmount,
          chainId: quoteChainId,
          maxLossBps: settings.maxLossBps,
          mode: transactionMode,
          positionBalance: positionBalanceQuery.data ?? 0n,
          selectedToken,
          signal,
          slippageBps: Math.round(settings.slippagePercent * 100)
        },
        quoteClient
      )
      onEvent?.({ type: 'quote_received', quote })
      return quote
    },
    enabled: !!account && !!adapter && !!quoteClient && parsedAmount > 0n,
    staleTime: 15_000,
    retry: false
  })
  const refetchQuote = quoteQuery.refetch

  const approvalTarget =
    quoteQuery.data?.approval ??
    adapter?.getApprovalTarget?.({
      chainId: quoteChainId,
      mode: transactionMode,
      selectedToken
    })
  const allowanceClient = usePublicClient({ chainId: approvalTarget?.token.chainId ?? config.chainId })
  const allowanceQuery = useQuery({
    queryKey: ['vault-widget', config.id, 'allowance', account, approvalTarget?.token.address, approvalTarget?.spender],
    queryFn: async (): Promise<bigint> => {
      if (!account || !approvalTarget || !allowanceClient) return 0n
      return allowanceClient.readContract({
        address: approvalTarget.token.address,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [account, approvalTarget.spender]
      })
    },
    enabled: !!account && !!approvalTarget && !!allowanceClient,
    refetchInterval: 15_000
  })

  const balance = transactionMode === 'deposit' ? (balanceQuery.data ?? 0n) : (positionValueQuery.data ?? 0n)
  const positionBalance = positionBalanceQuery.data ?? 0n
  const overBalance =
    transactionMode === 'deposit' ? parsedAmount > balance : (quoteQuery.data?.positionAmount ?? 0n) > positionBalance
  const allowance = allowanceQuery.data ?? 0n
  const plan = useMemo(
    () =>
      quoteQuery.data
        ? buildTransactionPlan({
            allowance,
            connectedChainId,
            mode: transactionMode,
            quote: quoteQuery.data
          })
        : undefined,
    [allowance, connectedChainId, quoteQuery.data, transactionMode]
  )
  const error = quoteQuery.error ? getError(quoteQuery.error) : undefined
  const isExecuting = execution.status === 'confirming' || execution.status === 'pending'
  const canSubmit = !!account && !!plan && parsedAmount > 0n && !overBalance && !isExecuting

  const refresh = useCallback(async (): Promise<void> => {
    await Promise.allSettled([
      balanceQuery.refetch(),
      positionBalanceQuery.refetch(),
      positionValueQuery.refetch(),
      allowanceQuery.refetch()
    ])
  }, [allowanceQuery, balanceQuery, positionBalanceQuery, positionValueQuery])

  const executeSteps = useCallback(
    async (
      transactionPlan: VaultWidgetTransactionPlan,
      steps: readonly VaultWidgetExecutionStep[],
      index = 0,
      lastHash?: Hash
    ): Promise<Hash | undefined> => {
      const step = steps[index]
      if (!step) return lastHash

      setExecution({
        status: 'confirming',
        step,
        stepIndex: index,
        stepCount: steps.length
      })
      onEvent?.({ type: 'transaction_step', step })

      if (step.kind === 'switch-chain' && step.chainId) {
        await switchChain(wagmiConfig, { chainId: step.chainId })
        return executeSteps(transactionPlan, steps, index + 1, lastHash)
      }
      if (step.kind === 'refresh') {
        await refresh()
        return executeSteps(transactionPlan, steps, index + 1, lastHash)
      }
      if (!step.request || !account) {
        return executeSteps(transactionPlan, steps, index + 1, lastHash)
      }

      const hash = await services.execution.execute({
        account,
        config: wagmiConfig,
        request: step.request,
        step
      })
      setExecution({
        status: 'pending',
        step,
        stepIndex: index,
        stepCount: steps.length,
        hash
      })
      onEvent?.({ type: 'transaction_step', step, hash })
      await services.execution.waitForReceipt(wagmiConfig, step.request.chainId, hash)
      return executeSteps(transactionPlan, steps, index + 1, hash)
    },
    [account, onEvent, refresh, services.execution, wagmiConfig]
  )

  const resolveFreshPlan = useCallback(async (): Promise<VaultWidgetTransactionPlan> => {
    if (!plan) throw new Error('No transaction plan is available')
    if (!plan.quote.expiresAt || plan.quote.expiresAt > Date.now()) return plan

    const refreshedQuote = (await refetchQuote()).data
    if (!refreshedQuote) throw new Error('The route quote expired and could not be refreshed')
    return buildTransactionPlan({
      allowance,
      connectedChainId,
      mode: transactionMode,
      quote: refreshedQuote
    })
  }, [allowance, connectedChainId, plan, refetchQuote, transactionMode])

  const submit = useCallback(async (): Promise<void> => {
    if (!account || !plan || !canSubmit) return
    const transactionPlan = await resolveFreshPlan().catch((value: unknown) => {
      setExecution({ status: 'error', error: getError(value) })
      return undefined
    })
    if (!transactionPlan) return

    onEvent?.({ type: 'transaction_started', plan: transactionPlan })
    const activityId = await services.activityStore.add({
      account,
      amount,
      chainId: transactionPlan.quote.transaction.chainId,
      destinationChainId: selectedToken.chainId,
      status: 'pending',
      timestamp: Date.now(),
      tokenIn: transactionMode === 'deposit' ? selectedToken.address : config.positionToken.address,
      tokenOut: transactionMode === 'deposit' ? config.positionToken.address : selectedToken.address,
      type: getActivityType(transactionMode, transactionPlan.quote)
    })

    try {
      const hash = await executeSteps(transactionPlan, transactionPlan.steps)
      await services.activityStore.update(activityId, { hash, status: 'success', timestamp: Date.now() })
      const event: Extract<VaultWidgetEvent, { type: 'transaction_succeeded' }> = {
        type: 'transaction_succeeded',
        plan: transactionPlan,
        hash
      }
      setExecution({ status: 'success', hash })
      setAmountValue('')
      onEvent?.(event)
      onSuccess?.(event)
    } catch (value) {
      const transactionError = getError(value)
      await services.activityStore.update(activityId, { status: 'error', timestamp: Date.now() })
      const event: Extract<VaultWidgetEvent, { type: 'transaction_failed' }> = {
        type: 'transaction_failed',
        plan: transactionPlan,
        error: transactionError
      }
      setExecution({ status: 'error', error: transactionError })
      onEvent?.(event)
      onError?.(event)
    }
  }, [
    account,
    amount,
    canSubmit,
    config.positionToken.address,
    executeSteps,
    onError,
    onEvent,
    onSuccess,
    plan,
    resolveFreshPlan,
    selectedToken.address,
    selectedToken.chainId,
    services.activityStore,
    transactionMode
  ])

  const setMode = useCallback(
    (nextMode: VaultWidgetMode): void => {
      if (!modes.includes(nextMode)) return
      if (controlledMode === undefined) setInternalMode(nextMode)
      setSelectedTokenAddress(getDefaultToken(config, nextMode).address)
      setAmountValue('')
      setExecution({ status: 'idle' })
      onModeChange?.(nextMode)
      onEvent?.({ type: 'mode_changed', mode: nextMode })
    },
    [config, controlledMode, modes, onEvent, onModeChange]
  )

  const setSelectedToken = useCallback(
    (token: VaultWidgetToken): void => {
      setSelectedTokenAddress(token.address)
      setAmountValue('')
      setExecution({ status: 'idle' })
      onEvent?.({ type: 'token_changed', mode: transactionMode, token })
    },
    [onEvent, transactionMode]
  )

  const setAmount = useCallback((nextAmount: string): void => {
    if (/^\d*\.?\d*$/.test(nextAmount)) {
      setAmountValue(nextAmount)
      setExecution({ status: 'idle' })
    }
  }, [])

  const setPercentage = useCallback(
    (percentage: number): void => {
      const available = transactionMode === 'deposit' ? (balanceQuery.data ?? 0n) : (positionValueQuery.data ?? 0n)
      const amountAtPercentage = (available * BigInt(percentage)) / 100n
      setAmountValue(formatUnits(amountAtPercentage, selectedToken.decimals))
      setExecution({ status: 'idle' })
    },
    [balanceQuery.data, positionValueQuery.data, selectedToken.decimals, transactionMode]
  )

  const setSettings = useCallback(
    (nextSettings: VaultWidgetSettings): void => {
      services.settings.write(nextSettings)
      setSettingsState(nextSettings)
    },
    [services.settings]
  )

  const reset = useCallback((): void => {
    setAmountValue('')
    setExecution({ status: 'idle' })
  }, [])

  return {
    account,
    allowance,
    amount,
    balance,
    balanceFormatted: formatUnits(balance, selectedToken.decimals),
    canSubmit,
    error,
    execution,
    isLoading: balanceQuery.isLoading || positionBalanceQuery.isLoading || positionValueQuery.isLoading,
    isQuoteLoading: quoteQuery.isLoading || quoteQuery.isFetching,
    mode,
    modes,
    overBalance,
    plan,
    approvalTarget,
    positionBalance,
    positionValue: positionValueQuery.data ?? 0n,
    quote: quoteQuery.data,
    selectedToken,
    settings,
    tokens: availableTokens,
    setAmount,
    setMode,
    setPercentage,
    setSelectedToken,
    setSettings,
    submit,
    reset
  }
}
