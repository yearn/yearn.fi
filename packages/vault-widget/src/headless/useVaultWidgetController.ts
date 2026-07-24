'use client'

import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { type Address, erc20Abi, formatUnits, isAddressEqual, parseUnits } from 'viem'
import { useAccount, useConfig, usePublicClient } from 'wagmi'
import { getPublicClient } from 'wagmi/actions'
import { useVaultWidgetServices } from '../context'
import type { VaultWidgetSettings } from '../services'
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
import { executeVaultWidgetPlan } from './executeTransactionPlan'
import {
  getAvailableVaultWidgetModes,
  getDefaultPositionSource,
  getPositionSources,
  readPositionSourceState,
  sumPositionValues
} from './positionSources'
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
  const [settings, setSettingsState] = useState<VaultWidgetSettings>(() => services.settings.read())
  const parsedAmount = parseAmount(amount, selectedToken.decimals)

  // Settings are an external browser store, so a subscription is the appropriate synchronization boundary.
  useEffect(() => services.settings.subscribe?.(() => setSettingsState(services.settings.read())), [services.settings])
  useEffect(() => {
    if (controlledMode !== undefined && controlledMode !== mode) onModeChange?.(mode)
  }, [controlledMode, mode, onModeChange])

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
          positionBalance: activePositionSource.balance,
          positionSource: selectedPositionSource,
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
      positionSource: selectedPositionSource,
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

  const balance = transactionMode === 'deposit' ? (balanceQuery.data ?? 0n) : activePositionSource.value
  const positionBalance = activePositionSource.balance
  const positionValue = sumPositionValues(infoPositionSourceStates)
  const positionValueDecimals = config.withdrawTokens[0]?.decimals ?? config.positionToken.decimals
  const overBalance =
    transactionMode === 'deposit' ? parsedAmount > balance : (quoteQuery.data?.positionAmount ?? 0n) > positionBalance
  const allowance = allowanceQuery.data ?? 0n
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
            connectedChainId,
            mode: transactionMode,
            quote: quoteQuery.data,
            walletType
          })
        : undefined,
    [allowance, connectedChainId, quoteQuery.data, transactionMode, walletType]
  )
  const error = quoteQuery.error ? getError(quoteQuery.error) : undefined
  const isExecuting =
    execution.status === 'confirming' || execution.status === 'pending' || execution.status === 'submitted'
  const canSubmit =
    !!account &&
    !!plan &&
    parsedAmount > 0n &&
    !overBalance &&
    !isExecuting &&
    !(services.execution.getWalletType && walletTypeQuery.isLoading)

  const refresh = useCallback(async (): Promise<void> => {
    await Promise.allSettled([balanceQuery.refetch(), positionSourcesQuery.refetch(), allowanceQuery.refetch()])
  }, [allowanceQuery, balanceQuery, positionSourcesQuery])

  const resolveFreshPlan = useCallback(async (): Promise<VaultWidgetTransactionPlan> => {
    if (!plan) throw new Error('No transaction plan is available')
    if (!plan.quote.expiresAt || plan.quote.expiresAt > Date.now()) return plan

    const refreshedQuote = (await refetchQuote()).data
    if (!refreshedQuote) throw new Error('The route quote expired and could not be refreshed')
    return buildTransactionPlan({
      allowance,
      connectedChainId,
      mode: transactionMode,
      quote: refreshedQuote,
      walletType
    })
  }, [allowance, connectedChainId, plan, refetchQuote, transactionMode, walletType])

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
      amount: transactionPlan.quote.activityAmount ?? amount,
      bridge: transactionPlan.quote.bridge,
      chainId: transactionPlan.quote.transaction.chainId,
      destinationChainId: selectedToken.chainId,
      status: 'pending',
      timestamp: Date.now(),
      tokenIn: transactionMode === 'deposit' ? selectedToken.address : selectedPositionSource.token.address,
      tokenOut: transactionMode === 'deposit' ? config.positionToken.address : selectedToken.address,
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
          await services.activityStore.update(activityId, {
            hash,
            isFinalTransaction,
            proposalId,
            status: 'submitted',
            timestamp: Date.now()
          })
        },
        onRefresh: refresh,
        onSubmitted: async (sourceHash) => {
          await services.activityStore.update(activityId, {
            hash: sourceHash,
            status: 'submitted',
            timestamp: Date.now()
          })
        },
        plan: transactionPlan
      })
      await services.activityStore.update(activityId, {
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
      setAmountValue(formatUnits(amountAtPercentage, selectedToken.decimals))
      setExecution({ status: 'idle' })
    },
    [activePositionSource.value, balanceQuery.data, selectedToken.decimals, transactionMode]
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
    isLoading: balanceQuery.isLoading || positionSourcesQuery.isLoading,
    isQuoteLoading: quoteQuery.isLoading || quoteQuery.isFetching,
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
