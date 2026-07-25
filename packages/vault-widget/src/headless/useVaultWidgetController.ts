'use client'

import { useQueries, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { type Address, erc20Abi, formatUnits, isAddressEqual, parseUnits } from 'viem'
import { useAccount, useConfig, usePublicClient } from 'wagmi'
import { getPublicClient } from 'wagmi/actions'
import { useVaultWidgetServices } from '../context'
import type { VaultWidgetSettings } from '../services'
import {
  addVaultWidgetActivitySafely,
  resolveVaultWidgetActivityDestinationChainId,
  updateVaultWidgetActivitySafely
} from '../services/activity'
import type {
  VaultWidgetActivity,
  VaultWidgetApprovalTarget,
  VaultWidgetConfig,
  VaultWidgetEvent,
  VaultWidgetExecutionState,
  VaultWidgetMode,
  VaultWidgetPositionSource,
  VaultWidgetPositionSourceState,
  VaultWidgetQuote,
  VaultWidgetToken,
  VaultWidgetTransactionPlan,
  VaultWidgetWalletType
} from '../types'
import { getQuoteApprovalTargets, matchApprovalAllowances } from './approvals'
import { executeVaultWidgetPlan } from './executeTransactionPlan'
import {
  getAvailableVaultWidgetModes,
  getDefaultPositionSource,
  getPositionSources,
  isModeAvailabilityPending,
  readPositionSourceState,
  sumPositionValues
} from './positionSources'
import { resolveVaultWidgetSettings } from './settings'
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
  balanceDecimals: number
  balanceFormatted: string
  canSubmit: boolean
  error?: Error
  execution: VaultWidgetExecutionState
  isLoading: boolean
  isQuoteLoading: boolean
  needsApproval: boolean
  infoPositionSources: readonly VaultWidgetPositionSourceState[]
  mode: VaultWidgetMode
  modes: readonly VaultWidgetMode[]
  overBalance: boolean
  plan?: VaultWidgetTransactionPlan
  approvalTarget?: VaultWidgetApprovalTarget
  positionBalance: bigint
  positionSources: readonly VaultWidgetPositionSourceState[]
  selectedPositionSource: VaultWidgetPositionSourceState
  positionValue: bigint
  positionValueDecimals: number
  quote?: VaultWidgetQuote
  selectedToken: VaultWidgetToken
  settings: VaultWidgetSettings
  tokens: readonly VaultWidgetToken[]
  walletType: VaultWidgetWalletType
  setAmount: (amount: string) => void
  setMode: (mode: VaultWidgetMode) => void
  setPercentage: (percentage: number) => void
  setSelectedPositionSource: (source: VaultWidgetPositionSource) => void
  setSelectedToken: (token: VaultWidgetToken) => void
  setSettings: (settings: VaultWidgetSettings) => void
  submit: () => Promise<void>
  reset: () => void
  refresh: () => Promise<void>
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

function getActivityType(mode: 'deposit' | 'withdraw', quote: VaultWidgetQuote): VaultWidgetActivity['type'] {
  if (quote.activityType) return quote.activityType
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
  const { address: account, chainId: connectedChainId, connector } = useAccount()
  const configuredModes = config.modes ?? ['deposit', 'withdraw']
  const initialMode = defaultMode ?? config.defaultMode ?? configuredModes[0] ?? 'deposit'
  const [internalMode, setInternalMode] = useState<VaultWidgetMode>(initialMode)
  const positionSources = useMemo(() => getPositionSources(config), [config])
  const infoPositionSources = useMemo(
    () => config.infoPositionSources ?? positionSources,
    [config.infoPositionSources, positionSources]
  )
  const balanceSources = useMemo(
    () =>
      [...positionSources, ...infoPositionSources].filter(
        (source, index, sources) =>
          sources.findIndex(({ token }) => isAddressEqual(token.address, source.token.address)) === index
      ),
    [infoPositionSources, positionSources]
  )
  const defaultPositionSource = getDefaultPositionSource(positionSources, config.defaultPositionSource)
  const [selectedPositionSourceId, setSelectedPositionSourceId] = useState(defaultPositionSource.id)
  const selectedPositionSource =
    positionSources.find(({ id }) => id === selectedPositionSourceId) ?? defaultPositionSource
  const positionSourcesQuery = useQuery({
    queryKey: [
      'vault-widget',
      config.id,
      'position-sources',
      account,
      balanceSources.map(({ id, token }) => `${id}:${token.chainId}:${token.address}`).join(',')
    ],
    queryFn: async (): Promise<readonly VaultWidgetPositionSourceState[]> => {
      if (!account) return []
      return Promise.all(
        balanceSources.map(async (source) => {
          const publicClient = getPublicClient(wagmiConfig, { chainId: source.token.chainId })
          if (!publicClient) throw new Error(`No public client is configured for chain ${source.token.chainId}`)
          return readPositionSourceState(publicClient, account, source)
        })
      )
    },
    enabled: !!account,
    refetchInterval: 15_000
  })
  const getPositionSourceState = (source: VaultWidgetPositionSource): VaultWidgetPositionSourceState => {
    const state = positionSourcesQuery.data?.find(({ token }) => isAddressEqual(token.address, source.token.address))
    return {
      ...source,
      balance: state?.balance ?? 0n,
      value: state?.value ?? 0n
    }
  }
  const positionSourceStates = positionSources.map(getPositionSourceState)
  const infoPositionSourceStates = infoPositionSources.map(getPositionSourceState)
  const activePositionSource = positionSourceStates.find(({ id }) => id === selectedPositionSource.id) ??
    positionSourceStates[0] ?? {
      ...selectedPositionSource,
      balance: 0n,
      value: 0n
    }
  const migrationBalance =
    positionSourceStates.find(({ token }) => isAddressEqual(token.address, config.positionToken.address))?.balance ?? 0n
  const modes = getAvailableVaultWidgetModes(configuredModes, migrationBalance)
  const requestedMode = controlledMode ?? internalMode
  const mode = modes.includes(requestedMode) ? requestedMode : (modes[0] ?? 'withdraw')
  const transactionMode = mode === 'withdraw' ? 'withdraw' : 'deposit'
  const availableTokens =
    transactionMode === 'withdraw'
      ? config.withdrawTokens.filter((token) =>
          config.adapters.some((candidate) =>
            candidate.supports({
              chainId: selectedPositionSource.token.chainId,
              mode: transactionMode,
              positionSource: selectedPositionSource,
              selectedToken: token
            })
          )
        )
      : config.depositTokens
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<Address>(getDefaultToken(config, mode).address)
  const selectedToken =
    availableTokens.find((token) => isAddressEqual(token.address, selectedTokenAddress)) ??
    availableTokens[0] ??
    getDefaultToken(config, mode)
  const [amount, setAmountValue] = useState('')
  const [execution, setExecution] = useState<VaultWidgetExecutionState>({ status: 'idle' })
  const [settings, setSettingsState] = useState<VaultWidgetSettings>(() =>
    resolveVaultWidgetSettings(config, services.settings)
  )
  const balanceDecimals =
    transactionMode === 'withdraw'
      ? (config.depositTokens[0]?.decimals ?? selectedToken.decimals)
      : selectedToken.decimals
  const parsedAmount = parseAmount(amount, balanceDecimals)
  const redeemAll = transactionMode === 'withdraw' && parsedAmount > 0n && parsedAmount === activePositionSource.value

  // Settings are an external browser store, so a subscription is the appropriate synchronization boundary.
  useEffect(() => {
    const syncSettings = (): void => {
      setSettingsState(
        resolveVaultWidgetSettings(
          {
            defaultMaxLossBps: config.defaultMaxLossBps,
            defaultSlippagePercent: config.defaultSlippagePercent
          },
          services.settings
        )
      )
    }
    syncSettings()
    return services.settings.subscribe?.(syncSettings)
  }, [config.defaultMaxLossBps, config.defaultSlippagePercent, services.settings])
  // A controlled migration can only be validated after the connected account's
  // asynchronous share balance resolves, so defer fallback synchronization.
  useEffect(() => {
    if (
      controlledMode !== undefined &&
      controlledMode !== mode &&
      !isModeAvailabilityPending(controlledMode, account, positionSourcesQuery.isLoading)
    ) {
      onModeChange?.(mode)
    }
  }, [account, controlledMode, mode, onModeChange, positionSourcesQuery.isLoading])

  const balanceClient = usePublicClient({ chainId: selectedToken.chainId })
  const quoteChainId = transactionMode === 'deposit' ? selectedToken.chainId : selectedPositionSource.token.chainId
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

  const adapter = config.adapters.find((candidate) =>
    candidate.supports({
      autoStake: settings.autoStake,
      chainId: quoteChainId,
      mode: transactionMode,
      positionSource: selectedPositionSource,
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
      selectedPositionSource.id,
      activePositionSource.balance.toString(),
      parsedAmount.toString(),
      redeemAll,
      settings.maxLossBps,
      settings.slippagePercent,
      settings.autoStake
    ],
    queryFn: async ({ signal }): Promise<VaultWidgetQuote> => {
      if (!account || !adapter || !quoteClient) throw new Error('No route is available')
      const quote = await adapter.quote(
        {
          account,
          amount: parsedAmount,
          autoStake: settings.autoStake,
          chainId: quoteChainId,
          maxLossBps: settings.maxLossBps,
          mode: transactionMode,
          positionBalance: activePositionSource.balance,
          positionSource: selectedPositionSource,
          redeemAll,
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

  const approvalRequest = {
    autoStake: settings.autoStake,
    chainId: quoteChainId,
    mode: transactionMode,
    positionSource: selectedPositionSource,
    selectedToken
  } as const
  const legacyApprovalTarget = adapter?.getApprovalTarget?.(approvalRequest)
  const adapterApprovalTargets =
    adapter?.getApprovalTargets?.(approvalRequest) ?? (legacyApprovalTarget ? [legacyApprovalTarget] : [])
  const quoteApprovalTargets = getQuoteApprovalTargets(quoteQuery.data)
  const approvalTargets = quoteApprovalTargets.length ? quoteApprovalTargets : adapterApprovalTargets
  const approvalTarget = approvalTargets[0]
  const allowanceQueries = useQueries({
    queries: approvalTargets.map((target) => ({
      queryKey: [
        'vault-widget',
        config.id,
        'allowance',
        account,
        target.token.chainId,
        target.token.address,
        target.spender
      ],
      queryFn: async (): Promise<bigint> => {
        if (!account) return 0n
        const allowanceClient = getPublicClient(wagmiConfig, { chainId: target.token.chainId })
        if (!allowanceClient) return 0n
        return allowanceClient.readContract({
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

  const balance = transactionMode === 'deposit' ? (balanceQuery.data ?? 0n) : activePositionSource.value
  const positionBalance = activePositionSource.balance
  const positionValue = sumPositionValues(infoPositionSourceStates)
  const positionValueDecimals = config.withdrawTokens[0]?.decimals ?? config.positionToken.decimals
  const overBalance =
    transactionMode === 'deposit' ? parsedAmount > balance : (quoteQuery.data?.positionAmount ?? 0n) > positionBalance
  const allowances = allowanceQueries.map(({ data }) => data ?? 0n)
  const allowance = allowances[0] ?? 0n
  const needsApproval =
    quoteQuery.data?.approvals?.some((approval, index) => (allowances[index] ?? 0n) < approval.amount) ??
    (!!quoteQuery.data?.approval && allowance < quoteQuery.data.approval.amount)
  const walletTypeQuery = useQuery({
    queryKey: ['vault-widget', config.id, 'wallet-type', account, connector?.id],
    queryFn: async (): Promise<VaultWidgetWalletType> => {
      if (!account || !services.execution.getWalletType) return 'eoa'
      return services.execution.getWalletType({ account, config: wagmiConfig })
    },
    enabled: !!account && !!services.execution.getWalletType,
    staleTime: Number.POSITIVE_INFINITY
  })
  const walletType = walletTypeQuery.data ?? 'eoa'
  const plan = useMemo(
    () =>
      quoteQuery.data
        ? buildTransactionPlan({
            allowance,
            allowances,
            connectedChainId,
            mode: transactionMode,
            quote: quoteQuery.data,
            walletType
          })
        : undefined,
    [allowance, allowances, connectedChainId, quoteQuery.data, transactionMode, walletType]
  )
  const queryError = quoteQuery.error ?? positionSourcesQuery.error ?? balanceQuery.error
  const error = queryError ? getError(queryError) : undefined
  const isExecuting =
    execution.status === 'confirming' || execution.status === 'pending' || execution.status === 'submitted'
  const canSubmit =
    !!account &&
    !!plan &&
    parsedAmount > 0n &&
    !overBalance &&
    !isExecuting &&
    !allowanceQueries.some(({ isLoading }) => isLoading) &&
    !(services.execution.getWalletType && walletTypeQuery.isLoading)

  const refresh = useCallback(async (): Promise<void> => {
    await Promise.allSettled([
      balanceQuery.refetch(),
      positionSourcesQuery.refetch(),
      ...allowanceQueries.map((query) => query.refetch())
    ])
  }, [allowanceQueries, balanceQuery, positionSourcesQuery])

  const resolveFreshPlan = useCallback(async (): Promise<VaultWidgetTransactionPlan> => {
    if (!plan) throw new Error('No transaction plan is available')
    if (!plan.quote.expiresAt || plan.quote.expiresAt > Date.now()) return plan

    const refreshResult = await refetchQuote()
    if (refreshResult.error) throw getError(refreshResult.error)
    const refreshedQuote = refreshResult.data
    if (!refreshedQuote || (refreshedQuote.expiresAt !== undefined && refreshedQuote.expiresAt <= Date.now())) {
      throw new Error('The route quote expired and could not be refreshed')
    }
    const refreshedAllowances = matchApprovalAllowances(refreshedQuote, approvalTargets, allowances)
    return buildTransactionPlan({
      allowance: refreshedAllowances[0] ?? 0n,
      allowances: refreshedAllowances,
      connectedChainId,
      mode: transactionMode,
      quote: refreshedQuote,
      walletType
    })
  }, [allowances, approvalTargets, connectedChainId, plan, refetchQuote, transactionMode, walletType])

  const submit = useCallback(async (): Promise<void> => {
    if (!account || !plan || !canSubmit) return
    const transactionPlan = await resolveFreshPlan().catch((value: unknown) => {
      setExecution({ status: 'error', error: getError(value) })
      return undefined
    })
    if (!transactionPlan) return

    onEvent?.({ type: 'transaction_started', plan: transactionPlan })
    const activityId = await addVaultWidgetActivitySafely(services.activityStore, {
      account,
      amount: transactionPlan.quote.activityAmount ?? amount,
      bridge: transactionPlan.quote.bridge,
      chainId: transactionPlan.quote.transaction.chainId,
      destinationChainId: resolveVaultWidgetActivityDestinationChainId({
        configChainId: config.chainId,
        mode: transactionMode,
        quote: transactionPlan.quote,
        selectedTokenChainId: selectedToken.chainId
      }),
      status: 'pending',
      timestamp: Date.now(),
      tokenIn:
        transactionPlan.quote.activityTokenIn ??
        (transactionMode === 'deposit' ? selectedToken.address : selectedPositionSource.token.address),
      tokenOut:
        transactionPlan.quote.activityTokenOut ??
        (transactionMode === 'deposit' ? config.positionToken.address : selectedToken.address),
      type: getActivityType(transactionMode, transactionPlan.quote)
    })

    try {
      const { destinationHash, hash, proposalId } = await executeVaultWidgetPlan({
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
        onRefresh: refresh,
        onSubmitted: async (sourceHash) => {
          await updateVaultWidgetActivitySafely(services.activityStore, activityId, {
            hash: sourceHash,
            status: 'submitted',
            timestamp: Date.now()
          })
        },
        plan: transactionPlan
      })
      await updateVaultWidgetActivitySafely(services.activityStore, activityId, {
        destinationHash,
        hash,
        status: 'success',
        timestamp: Date.now()
      })
      const event: Extract<VaultWidgetEvent, { type: 'transaction_succeeded' }> = {
        type: 'transaction_succeeded',
        plan: transactionPlan,
        destinationHash,
        hash,
        proposalId
      }
      setExecution({ status: 'success', destinationHash, hash, proposalId })
      setAmountValue('')
      onEvent?.(event)
      onSuccess?.(event)
    } catch (value) {
      const transactionError = getError(value)
      await updateVaultWidgetActivitySafely(services.activityStore, activityId, {
        status: 'error',
        timestamp: Date.now()
      })
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
    config.chainId,
    config.positionToken.address,
    onError,
    onEvent,
    onSuccess,
    plan,
    resolveFreshPlan,
    selectedToken.address,
    selectedToken.chainId,
    selectedPositionSource.token.address,
    services.activityStore,
    services.ensoBridge,
    services.execution,
    transactionMode,
    wagmiConfig,
    refresh
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

  const setSelectedPositionSource = useCallback(
    (source: VaultWidgetPositionSource): void => {
      if (!positionSources.some(({ id }) => id === source.id)) return
      const nextToken = config.withdrawTokens.find((token) =>
        config.adapters.some((candidate) =>
          candidate.supports({
            chainId: source.token.chainId,
            mode: 'withdraw',
            positionSource: source,
            selectedToken: token
          })
        )
      )
      setSelectedPositionSourceId(source.id)
      if (nextToken) setSelectedTokenAddress(nextToken.address)
      setAmountValue('')
      setExecution({ status: 'idle' })
      onEvent?.({ type: 'position_source_changed', source })
    },
    [config.adapters, config.withdrawTokens, onEvent, positionSources]
  )

  const setAmount = useCallback((nextAmount: string): void => {
    if (/^\d*\.?\d*$/.test(nextAmount)) {
      setAmountValue(nextAmount)
      setExecution({ status: 'idle' })
    }
  }, [])

  const setPercentage = useCallback(
    (percentage: number): void => {
      const available = transactionMode === 'deposit' ? (balanceQuery.data ?? 0n) : activePositionSource.value
      const amountAtPercentage = (available * BigInt(percentage)) / 100n
      setAmountValue(formatUnits(amountAtPercentage, balanceDecimals))
      setExecution({ status: 'idle' })
    },
    [activePositionSource.value, balanceDecimals, balanceQuery.data, transactionMode]
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
    balanceDecimals,
    balanceFormatted: formatUnits(balance, balanceDecimals),
    canSubmit,
    error,
    execution,
    isLoading: balanceQuery.isLoading || positionSourcesQuery.isLoading,
    isQuoteLoading: quoteQuery.isLoading || quoteQuery.isFetching,
    needsApproval,
    infoPositionSources: infoPositionSourceStates,
    mode,
    modes,
    overBalance,
    plan,
    approvalTarget,
    positionBalance,
    positionSources: positionSourceStates,
    selectedPositionSource: activePositionSource,
    positionValue,
    positionValueDecimals,
    quote: quoteQuery.data,
    selectedToken,
    settings,
    tokens: availableTokens,
    walletType,
    setAmount,
    setMode,
    setPercentage,
    setSelectedPositionSource,
    setSelectedToken,
    setSettings,
    submit,
    reset,
    refresh
  }
}
