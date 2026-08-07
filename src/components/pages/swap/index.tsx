'use client'

import { ApprovalOverlay } from '@pages/vaults/components/widget/deposit/ApprovalOverlay'
import { ApprovalResetWarning } from '@pages/vaults/components/widget/deposit/ApprovalResetWarning'
import { InputTokenAmount } from '@pages/vaults/components/widget/InputTokenAmount'
import { SettingsPanel } from '@pages/vaults/components/widget/SettingsPanel'
import { PriceImpactWarning } from '@pages/vaults/components/widget/shared/PriceImpactWarning'
import { TokenSelectorOverlay } from '@pages/vaults/components/widget/shared/TokenSelectorOverlay'
import { TransactionOverlay, type TransactionStep } from '@pages/vaults/components/widget/shared/TransactionOverlay'
import { useProtectedEnsoQuoteState } from '@pages/vaults/components/widget/shared/useProtectedEnsoQuoteState'
import { formatWidgetAllowance, formatWidgetPreciseValue } from '@pages/vaults/components/widget/shared/valueDisplay'
import { getTokenLogoSources } from '@pages/vaults/components/widget/tokenLogo.utils'
import {
  getVaultAddress,
  getVaultAPR,
  getVaultChainID,
  getVaultDecimals,
  getVaultInfo,
  getVaultName,
  getVaultSymbol,
  getVaultToken,
  getVaultTVL
} from '@pages/vaults/domain/kongVaultSelectors'
import { useSolverEnso } from '@pages/vaults/hooks/solvers/useSolverEnso'
import { useDebouncedInput } from '@pages/vaults/hooks/useDebouncedInput'
import { useEnsoEnabled } from '@pages/vaults/hooks/useEnsoEnabled'
import { useEnsoOrder } from '@pages/vaults/hooks/useEnsoOrder'
import { fetchTokenData, useTokens } from '@pages/vaults/hooks/useTokens'
import { getKnownEnsoRouterAddress } from '@pages/vaults/utils/ensoRouters'
import { Button } from '@shared/components/Button'
import { OverflowMarqueeText } from '@shared/components/OverflowMarqueeText'
import { TokenLogoV2 } from '@shared/components/TokenLogoV2'
import { useWalletActions, useWalletTokens } from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useYearn } from '@shared/contexts/useYearn'
import { useTokenList } from '@shared/contexts/WithTokenList'
import { useYearnSpotPrices } from '@shared/hooks/useYearnSpotPrices'
import { IconSettings } from '@shared/icons/IconSettings'
import type { TToken } from '@shared/types'
import type { TCreateNotificationParams } from '@shared/types/notifications'
import { cl, ETH_TOKEN_ADDRESS, formatTAmount, toAddress, toNormalizedBN } from '@shared/utils'
import { requiresAllowanceResetBeforeApproval } from '@shared/utils/approve'
import { formatUSD } from '@shared/utils/format'
import { toBasisPoints } from '@shared/utils/slippage'
import { getNetwork } from '@shared/utils/wagmi'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { type ReactElement, useCallback, useEffect, useMemo, useState } from 'react'
import { type Address, formatUnits, isAddressEqual } from 'viem'
import { useConfig } from 'wagmi'
import { resolveExecutionChainId } from '@/config/tenderly'
import { isSwapChainId, MAJOR_SWAP_TOKENS } from './constants'
import { SwapVaultAnnualReturnRow, SwapVaultWorthRow } from './SwapVaultDetails'
import { SwapWalletPanel } from './SwapWalletPanel'
import { buildSwapSearchParams, parseSwapSelection, type TSwapSelection } from './swapParams'
import { buildSwapVaultPolicyEntries, getSwapSelectionPolicy } from './swapPolicy'
import { resolveSwapTokenPrice } from './swapTokenPrice'
import { getSwapVaultEstimate } from './swapVaultEstimate'

type TSwapTab = 'swap' | 'wallet'
type TSelectorTarget = 'from' | 'to' | null

function useResolvedSwapToken(address: Address, chainId: number): { token: TToken; price: number } {
  const { address: account } = useWeb3()
  const { balances, getToken: getWalletToken } = useWalletTokens()
  const { getToken: getListedToken } = useTokenList()
  const { allVaults } = useYearn()
  const isNative = isAddressEqual(address, ETH_TOKEN_ADDRESS)
  const normalizedAddress = toAddress(address)
  const vault = Object.values(allVaults).find(
    (candidate) =>
      getVaultChainID(candidate) === chainId &&
      !getVaultInfo(candidate).isHidden &&
      isAddressEqual(toAddress(getVaultAddress(candidate)), normalizedAddress)
  )
  const vaultUnderlying = vault ? getVaultToken(vault) : undefined
  const { getPrice } = useYearnSpotPrices([
    { address: normalizedAddress, chainID: chainId },
    vaultUnderlying ? { address: vaultUnderlying.address, chainID: chainId } : undefined
  ])
  const { tokens } = useTokens([isNative ? undefined : address], chainId, account)
  const rpcToken = tokens[0]
  const walletToken = balances[chainId]?.[normalizedAddress] ?? getWalletToken({ address, chainID: chainId })
  const listedToken = getListedToken({ address, chainID: chainId })
  const network = getNetwork(chainId)
  const balance =
    walletToken.address && isAddressEqual(walletToken.address, normalizedAddress)
      ? walletToken.balance
      : toNormalizedBN(0n, rpcToken?.decimals ?? (isNative ? network.nativeCurrency.decimals : 18))
  const vaultApr = vault ? getVaultAPR(vault) : undefined
  const price = resolveSwapTokenPrice({
    contextPrice: getPrice({ address: normalizedAddress, chainID: chainId }).normalized,
    walletValue: walletToken.value,
    walletBalance: walletToken.balance.normalized,
    vaultUnderlyingPrice:
      vault && vaultUnderlying
        ? getPrice({ address: vaultUnderlying.address, chainID: chainId }).normalized || getVaultTVL(vault).price
        : undefined,
    vaultPricePerShare: vaultApr?.pricePerShare.today
  })
  const nativeToken: TToken | undefined = isNative
    ? {
        address: ETH_TOKEN_ADDRESS,
        name: network.nativeCurrency.name,
        symbol: network.nativeCurrency.symbol,
        decimals: network.nativeCurrency.decimals,
        chainID: chainId,
        value: balance.normalized * price,
        balance
      }
    : undefined
  const vaultToken: TToken | undefined = vault
    ? {
        address: normalizedAddress,
        name: getVaultName(vault),
        symbol: getVaultSymbol(vault) || 'Vault',
        decimals: getVaultDecimals(vault),
        chainID: chainId,
        value: walletToken.value || balance.normalized * price,
        balance
      }
    : undefined
  const rpcResolvedToken: TToken | undefined = rpcToken?.address
    ? {
        address: normalizedAddress,
        name: rpcToken.name || rpcToken.symbol || 'Token',
        symbol: rpcToken.symbol || '???',
        decimals: rpcToken.decimals ?? 18,
        chainID: chainId,
        value: balance.normalized * price,
        balance
      }
    : undefined
  const metadataToken = [nativeToken, walletToken, listedToken, vaultToken, rpcResolvedToken].find(
    (candidate) =>
      candidate?.address &&
      isAddressEqual(candidate.address, normalizedAddress) &&
      candidate.symbol &&
      candidate.symbol !== '???'
  )

  return {
    token: metadataToken
      ? {
          ...metadataToken,
          address: normalizedAddress,
          chainID: chainId,
          balance,
          value: walletToken.value || balance.normalized * price
        }
      : {
          address: normalizedAddress,
          name: 'Unknown token',
          symbol: '???',
          decimals: 18,
          chainID: chainId,
          value: 0,
          balance
        },
    price
  }
}

function SwapOutputField({
  amount,
  isLoading,
  onSelect,
  token,
  tokenPrice
}: {
  amount: bigint
  isLoading: boolean
  onSelect: () => void
  token: TToken
  tokenPrice: number
}): ReactElement {
  const network = getNetwork(token.chainID)
  const logo = getTokenLogoSources({
    address: token.address,
    chainId: token.chainID,
    logoURI: token.logoURI,
    size: 32
  })
  const normalizedAmount = Number(formatUnits(amount, token.decimals))
  const tokenSelectorTitle = token.name !== token.symbol ? `${token.name} (${token.symbol})` : token.symbol

  return (
    <div className="rounded-md border border-border px-3 py-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">You receive</span>
        <span className="text-xs text-text-secondary">{network.name}</span>
      </div>
      <div className="flex min-h-12 items-center gap-2">
        <span className={cl('min-w-0 flex-1 text-2xl font-medium text-text-primary', isLoading ? 'animate-pulse' : '')}>
          {isLoading ? 'Finding route...' : formatWidgetPreciseValue(amount, token.decimals)}
        </span>
        <button
          type="button"
          onClick={onSelect}
          data-token-selector-button
          title={tokenSelectorTitle}
          className="flex min-h-11 max-w-[60%] shrink-0 items-center gap-2 overflow-hidden rounded-lg px-2 py-1 text-xl font-medium text-text-primary transition-colors hover:bg-surface-secondary"
        >
          <TokenLogoV2
            src={logo.src}
            altSrc={logo.altSrc}
            tokenSymbol={token.symbol}
            tokenName={token.name}
            chainId={token.chainID}
            width={32}
            height={32}
            className="shrink-0 rounded-full"
          />
          <OverflowMarqueeText>{token.symbol}</OverflowMarqueeText>
          <svg className="size-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m19 9-7 7-7-7" />
          </svg>
        </button>
      </div>
      <div className="flex items-center justify-between text-sm text-text-secondary">
        <span>{tokenPrice > 0 && amount > 0n ? formatUSD(normalizedAmount * tokenPrice) : 'Unavailable'}</span>
        <span>Balance: {formatTAmount({ value: token.balance.raw, decimals: token.decimals })}</span>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="text-right font-semibold text-text-primary">{value}</span>
    </div>
  )
}

export default function SwapPage(): ReactElement {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selection = useMemo(() => parseSwapSelection(new URLSearchParams(searchParams.toString())), [searchParams])
  const [activeTab, setActiveTab] = useState<TSwapTab>('swap')
  const [selectorTarget, setSelectorTarget] = useState<TSelectorTarget>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isApprovalOpen, setIsApprovalOpen] = useState(false)
  const [selectionPolicyNotice, setSelectionPolicyNotice] = useState<string | undefined>()
  const [customRecipient, setCustomRecipient] = useState<Address | undefined>()
  const [requestedSlippage, setRequestedSlippage] = useState(0)
  const { address: account, openLoginModal } = useWeb3()
  const wagmiConfig = useConfig()
  const { onRefresh } = useWalletActions()
  const { allVaults, isLoadingVaultList, zapSlippage } = useYearn()
  const ensoEnabled = useEnsoEnabled()
  const { token: fromToken, price: fromTokenPrice } = useResolvedSwapToken(selection.fromToken, selection.fromChainId)
  const { token: toToken, price: toTokenPrice } = useResolvedSwapToken(selection.toToken, selection.toChainId)
  const swapBalanceRefreshTokens = useMemo(
    () => [
      {
        address: fromToken.address,
        chainID: selection.fromChainId,
        decimals: fromToken.decimals,
        name: fromToken.name,
        symbol: fromToken.symbol
      },
      {
        address: toToken.address,
        chainID: selection.toChainId,
        decimals: toToken.decimals,
        name: toToken.name,
        symbol: toToken.symbol
      }
    ],
    [
      fromToken.address,
      fromToken.decimals,
      fromToken.name,
      fromToken.symbol,
      selection.fromChainId,
      selection.toChainId,
      toToken.address,
      toToken.decimals,
      toToken.name,
      toToken.symbol
    ]
  )
  const destinationVault = useMemo(
    () =>
      Object.values(allVaults).find(
        (vault) =>
          getVaultChainID(vault) === selection.toChainId &&
          !getVaultInfo(vault).isHidden &&
          !getVaultInfo(vault).isRetired &&
          isAddressEqual(toAddress(getVaultAddress(vault)), selection.toToken)
      ),
    [allVaults, selection.toChainId, selection.toToken]
  )
  const destinationVaultMetadata = useMemo(() => {
    if (!destinationVault) return undefined

    const apr = getVaultAPR(destinationVault)
    const underlying = getVaultToken(destinationVault)
    const vaultTvlPrice = getVaultTVL(destinationVault).price
    const underlyingPrice =
      toTokenPrice > 0 && apr.pricePerShare.today > 0 ? toTokenPrice / apr.pricePerShare.today : vaultTvlPrice

    return {
      annualRate: apr.forwardAPR.type ? apr.forwardAPR.netAPR : undefined,
      pricePerShare: apr.pricePerShare.today,
      underlyingPrice: underlyingPrice > 0 ? underlyingPrice : undefined,
      underlyingSymbol: underlying.symbol
    }
  }, [destinationVault, toTokenPrice])
  const input = useDebouncedInput(fromToken.decimals)
  const [inputValue, , setInputValue] = input
  const receiver = customRecipient ?? account
  const isSameToken =
    selection.fromChainId === selection.toChainId && isAddressEqual(selection.fromToken, selection.toToken)
  const routeKey = [
    selection.fromChainId,
    selection.fromToken,
    selection.toChainId,
    selection.toToken,
    receiver,
    inputValue.debouncedBn
  ].join(':')
  const vaultPolicyEntries = useMemo(() => buildSwapVaultPolicyEntries(allVaults), [allVaults])
  const selectionPolicy = useMemo(
    () =>
      getSwapSelectionPolicy({
        entries: vaultPolicyEntries,
        isLoading: isLoadingVaultList,
        selection
      }),
    [isLoadingVaultList, selection, vaultPolicyEntries]
  )

  const updateSelection = useCallback(
    (nextSelection: TSwapSelection): void => {
      const nextPolicy = getSwapSelectionPolicy({
        entries: vaultPolicyEntries,
        isLoading: isLoadingVaultList,
        selection: nextSelection
      })
      if (!nextPolicy.isAllowed) {
        setSelectionPolicyNotice(nextPolicy.message ?? 'Vault data is still loading. Try again shortly.')
        return
      }

      setSelectionPolicyNotice(undefined)
      router.replace(`${pathname}?${buildSwapSearchParams(nextSelection).toString()}`, { scroll: false })
    },
    [isLoadingVaultList, pathname, router, vaultPolicyEntries]
  )

  const resolveCustomToken = useCallback(
    async (address: Address, chainId: number): Promise<TToken | undefined> => {
      const executionChainId = resolveExecutionChainId(chainId)
      if (!executionChainId) return undefined
      const [token] = await fetchTokenData(wagmiConfig, [address], chainId, executionChainId, account)
      if (!token?.address || !token.symbol || token.symbol === '???') return undefined

      return {
        address: token.address,
        name: token.name || token.symbol,
        symbol: token.symbol,
        decimals: token.decimals ?? 18,
        chainID: chainId,
        value: 0,
        balance: token.balance
      }
    },
    [account, wagmiConfig]
  )

  // Keep the shareable route explicit even when the user lands on the default pair.
  useEffect(() => {
    const canonical = buildSwapSearchParams(selection).toString()
    if (searchParams.toString() !== canonical) {
      router.replace(`${pathname}?${canonical}`, { scroll: false })
    }
  }, [pathname, router, searchParams, selection])

  useEffect(() => {
    setRequestedSlippage(0)
    setIsApprovalOpen(false)
    setSelectionPolicyNotice(undefined)
  }, [routeKey])

  const solver = useSolverEnso({
    tokenIn: selection.fromToken,
    tokenOut: selection.toToken,
    amountIn: inputValue.debouncedBn,
    fromAddress: account,
    receiver,
    chainId: selection.fromChainId,
    destinationChainId: selection.toChainId === selection.fromChainId ? undefined : selection.toChainId,
    slippage: toBasisPoints(requestedSlippage),
    requestKey: `${routeKey}:${requestedSlippage}`,
    decimalsOut: toToken.decimals,
    enabled:
      ensoEnabled && selectionPolicy.isAllowed && !isSameToken && fromToken.symbol !== '???' && toToken.symbol !== '???'
  })

  useEffect(() => {
    if (
      !account ||
      !receiver ||
      inputValue.debouncedBn <= 0n ||
      isSameToken ||
      !ensoEnabled ||
      !selectionPolicy.isAllowed
    ) {
      solver.methods.resetRoute()
      return
    }

    void solver.methods.getRoute()
  }, [
    account,
    ensoEnabled,
    inputValue.debouncedBn,
    isSameToken,
    receiver,
    routeKey,
    requestedSlippage,
    selectionPolicy.isAllowed,
    solver.methods.getRoute,
    solver.methods.resetRoute
  ])

  const expectedOut = solver.periphery.expectedOut.raw
  const minExpectedOut = solver.periphery.minExpectedOut.raw
  const destinationVaultEstimate = useMemo(
    () =>
      destinationVaultMetadata
        ? getSwapVaultEstimate({
            expectedShares: expectedOut,
            minimumShares: minExpectedOut,
            shareDecimals: toToken.decimals,
            pricePerShare: destinationVaultMetadata.pricePerShare,
            underlyingPrice: destinationVaultMetadata.underlyingPrice,
            annualRate: destinationVaultMetadata.annualRate
          })
        : undefined,
    [destinationVaultMetadata, expectedOut, minExpectedOut, toToken.decimals]
  )
  const inputUsd = inputValue.debouncedSimple * fromTokenPrice
  const expectedOutUsd = Number(formatUnits(expectedOut, toToken.decimals)) * toTokenPrice
  const minExpectedOutUsd = Number(formatUnits(minExpectedOut, toToken.decimals)) * toTokenPrice
  const localPriceImpact =
    inputUsd > 0 && expectedOutUsd > 0 ? Math.max(0, ((inputUsd - expectedOutUsd) / inputUsd) * 100) : 0
  const localWorstCaseImpact =
    inputUsd > 0 && minExpectedOutUsd > 0 ? Math.max(0, ((inputUsd - minExpectedOutUsd) / inputUsd) * 100) : 0
  const protectedQuote = useProtectedEnsoQuoteState({
    stateKey: routeKey,
    isEnsoRoute: true,
    amount: inputValue.debouncedBn,
    requestedSlippage,
    setRequestedSlippage,
    isLoadingQuote: solver.periphery.isLoadingRoute,
    userTolerancePercentage: zapSlippage,
    localPriceImpactPercentage: localPriceImpact,
    localWorstCasePriceImpactPercentage: localWorstCaseImpact,
    hasIncompleteUsdValuation: fromTokenPrice <= 0 || toTokenPrice <= 0,
    ensoPriceImpact: solver.periphery.priceImpact,
    expectedOut,
    minExpectedOut,
    tx: solver.periphery.route?.tx,
    display: { expectedOut, minExpectedOut }
  })
  const getProtectedTransaction = useCallback(
    () =>
      protectedQuote.executableTx
        ? {
            ...protectedQuote.executableTx,
            chainId: solver.periphery.route?.tx.chainId ?? selection.fromChainId
          }
        : undefined,
    [protectedQuote.executableTx, selection.fromChainId, solver.periphery.route?.tx.chainId]
  )
  const { prepareEnsoOrder } = useEnsoOrder({
    getEnsoTransaction: getProtectedTransaction,
    enabled: Boolean(protectedQuote.executableTx && solver.periphery.isAllowanceSufficient),
    chainId: selection.fromChainId
  })

  const formattedInput = formatTAmount({
    value: inputValue.debouncedBn,
    decimals: fromToken.decimals,
    options: { maximumFractionDigits: 8 }
  })
  const formattedOutput = formatTAmount({
    value: minExpectedOut,
    decimals: toToken.decimals,
    options: { maximumFractionDigits: 8 }
  })
  const isCrossChain = selection.fromChainId !== selection.toChainId
  const needsApproval = !solver.periphery.isAllowanceSufficient
  const inputExceedsBalance = inputValue.bn > fromToken.balance.raw
  const hasSyncedInput = !inputValue.isDebouncing && inputValue.bn === inputValue.debouncedBn
  const shouldBlockApprovalForAllowanceReset =
    hasSyncedInput && !inputExceedsBalance && needsApproval && solver.periphery.needsAllowanceResetBeforeApproval
  const isNativeInput = isAddressEqual(fromToken.address, ETH_TOKEN_ADDRESS)
  const approvalSpenderAddress = solver.periphery.approvalWarning
    ? undefined
    : (solver.periphery.routerAddress ?? getKnownEnsoRouterAddress(selection.fromChainId))
  const allowanceDisplay = formatWidgetAllowance(solver.periphery.allowance, fromToken.decimals) ?? '0'

  const approveNotification = useMemo<TCreateNotificationParams | undefined>(
    () =>
      account && solver.periphery.routerAddress
        ? {
            type: 'approve',
            amount: formattedInput,
            fromAddress: selection.fromToken,
            fromSymbol: fromToken.symbol,
            fromChainId: selection.fromChainId,
            toAddress: solver.periphery.routerAddress,
            toSymbol: 'Enso Router'
          }
        : undefined,
    [
      account,
      formattedInput,
      fromToken.symbol,
      selection.fromChainId,
      selection.fromToken,
      solver.periphery.routerAddress
    ]
  )
  const swapNotification = useMemo<TCreateNotificationParams | undefined>(
    () =>
      account && expectedOut > 0n
        ? {
            type: isCrossChain ? 'crosschain swap' : 'swap',
            amount: formattedInput,
            fromAddress: selection.fromToken,
            fromSymbol: fromToken.symbol,
            fromChainId: selection.fromChainId,
            toAddress: selection.toToken,
            toSymbol: toToken.symbol,
            toAmount: formattedOutput,
            toChainId: isCrossChain ? selection.toChainId : undefined
          }
        : undefined,
    [
      account,
      expectedOut,
      formattedInput,
      formattedOutput,
      fromToken.symbol,
      isCrossChain,
      selection.fromChainId,
      selection.fromToken,
      selection.toChainId,
      selection.toToken,
      toToken.symbol
    ]
  )

  const currentStep = useMemo<TransactionStep | undefined>(() => {
    if (needsApproval) {
      return {
        prepare: solver.actions.prepareApprove,
        label: 'Approve',
        confirmMessage: `Approving ${formattedInput} ${fromToken.symbol}`,
        successTitle: 'Approval successful',
        successMessage: `${fromToken.symbol} is approved for this swap.`,
        isEnabled: solver.periphery.prepareApproveEnabled && !protectedQuote.isPreparing,
        completesFlow: false,
        notification: approveNotification
      }
    }

    return {
      prepare: prepareEnsoOrder,
      label: 'Swap',
      confirmMessage: `Swapping ${formattedInput} ${fromToken.symbol}`,
      successTitle: isCrossChain ? 'Swap submitted' : 'Swap successful',
      successMessage: isCrossChain
        ? `Your cross-chain swap to ${toToken.symbol} has been submitted. It may take a few minutes to arrive.`
        : `Swapped ${formattedInput} ${fromToken.symbol} for ${formattedOutput} ${toToken.symbol}.`,
      isEnabled: Boolean(protectedQuote.executableTx && prepareEnsoOrder.isSuccess),
      completesFlow: true,
      showConfetti: true,
      notification: swapNotification
    }
  }, [
    approveNotification,
    formattedInput,
    formattedOutput,
    fromToken.symbol,
    isCrossChain,
    needsApproval,
    prepareEnsoOrder,
    protectedQuote.executableTx,
    protectedQuote.isPreparing,
    solver.actions.prepareApprove,
    solver.periphery.prepareApproveEnabled,
    swapNotification,
    toToken.symbol
  ])

  const [isTransactionOpen, setIsTransactionOpen] = useState(false)
  const selectionPolicyError = selectionPolicy.message ?? selectionPolicyNotice
  const isQuoteBlocked =
    protectedQuote.priceImpactInfo.isBlocking ||
    protectedQuote.priceImpactInfo.isAboveTolerance ||
    protectedQuote.hasUnpricedQuoteError
  const isPreparing =
    !selectionPolicy.isReady ||
    inputValue.isDebouncing ||
    protectedQuote.isPreparing ||
    solver.periphery.isLoadingAllowance
  const isActionDisabled =
    inputValue.bn <= 0n ||
    inputExceedsBalance ||
    isSameToken ||
    !selectionPolicy.isAllowed ||
    shouldBlockApprovalForAllowanceReset ||
    isQuoteBlocked ||
    isPreparing ||
    Boolean(solver.periphery.error) ||
    !currentStep?.isEnabled

  const handleMax = useCallback((): void => {
    const balance = fromToken.balance.raw
    const isNative = isAddressEqual(fromToken.address, ETH_TOKEN_ADDRESS)
    const nativeReserve = 3_000_000_000_000_000n
    const maxAmount = isNative ? (balance > nativeReserve ? balance - nativeReserve : (balance * 9n) / 10n) : balance
    setInputValue(formatUnits(maxAmount, fromToken.decimals))
  }, [fromToken.address, fromToken.balance.raw, fromToken.decimals, setInputValue])

  const handlePairTokenChange = useCallback(
    (target: Exclude<TSelectorTarget, null>, address: Address, chainId?: number): void => {
      if (!chainId || !isSwapChainId(chainId)) return
      updateSelection(
        target === 'from'
          ? { ...selection, fromToken: toAddress(address), fromChainId: chainId }
          : { ...selection, toToken: toAddress(address), toChainId: chainId }
      )
      setSelectorTarget(null)
    },
    [selection, updateSelection]
  )

  const reversePair = useCallback((): void => {
    updateSelection({
      fromChainId: selection.toChainId,
      fromToken: selection.toToken,
      toChainId: selection.fromChainId,
      toToken: selection.fromToken
    })
    setInputValue('')
  }, [selection, setInputValue, updateSelection])

  const actionLabel = !account
    ? 'Connect Wallet'
    : !selectionPolicy.isReady
      ? 'Loading vault data'
      : selectionPolicyError
        ? 'Choose different assets'
        : inputValue.bn <= 0n
          ? 'Enter an amount'
          : inputExceedsBalance
            ? `Insufficient ${fromToken.symbol} balance`
            : isSameToken
              ? 'Choose different assets'
              : isPreparing
                ? 'Finding best route'
                : shouldBlockApprovalForAllowanceReset
                  ? `Reset ${fromToken.symbol} approval`
                  : needsApproval
                    ? `Approve ${fromToken.symbol}`
                    : 'Swap'

  const selectedToken = selectorTarget === 'from' ? selection.fromToken : selection.toToken
  const selectedChainId = selectorTarget === 'from' ? selection.fromChainId : selection.toChainId
  const routeError = solver.periphery.error?.message

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-col px-4 pb-16 pt-8 md:pt-16">
      <div className="relative overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        <div
          className="flex gap-2 border-b border-border bg-surface-secondary p-1"
          role="tablist"
          aria-label="Swap views"
        >
          {(['swap', 'wallet'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`swap-${tab}-panel`}
              id={`swap-${tab}-tab`}
              onClick={() => {
                setSelectorTarget(null)
                setIsSettingsOpen(false)
                setActiveTab(tab)
              }}
              className={cl(
                'min-h-10 flex-1 rounded-md border px-3 py-2 text-xs font-semibold capitalize transition-colors',
                activeTab === tab
                  ? 'border-border bg-surface text-text-primary'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'wallet' ? (
          <div id="swap-wallet-panel" role="tabpanel" aria-labelledby="swap-wallet-tab" className="h-[640px]">
            <SwapWalletPanel
              onSelectToken={(address, chainId) => {
                if (!isSwapChainId(chainId)) return
                updateSelection({ ...selection, fromToken: address, fromChainId: chainId })
                setActiveTab('swap')
              }}
            />
          </div>
        ) : (
          <div
            id="swap-swap-panel"
            role="tabpanel"
            aria-labelledby="swap-swap-tab"
            className="relative flex h-[640px] flex-col overflow-hidden"
          >
            <div className="flex shrink-0 items-center justify-between px-6 pt-4">
              <p className="text-xs text-text-secondary">Best available route, powered by Enso.</p>
              {isCrossChain ? (
                <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">Cross-chain</span>
              ) : null}
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3 p-6 pt-3">
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
                <InputTokenAmount
                  input={input}
                  title="You pay"
                  placeholder="0.00"
                  balance={fromToken.balance.raw}
                  decimals={fromToken.decimals}
                  symbol={fromToken.symbol}
                  tokenName={fromToken.name}
                  onMaxClick={handleMax}
                  errorMessage={inputExceedsBalance ? `Insufficient ${fromToken.symbol} balance` : undefined}
                  showTokenSelector
                  limitTokenSelectorWidth
                  inputTokenUsdPrice={fromTokenPrice}
                  tokenAddress={fromToken.address}
                  tokenChainId={fromToken.chainID}
                  tokenLogoURI={fromToken.logoURI}
                  onTokenSelectorClick={() => setSelectorTarget('from')}
                />

                <div className="relative h-0">
                  <button
                    type="button"
                    onClick={reversePair}
                    aria-label="Reverse swap direction"
                    className="absolute left-1/2 top-1/2 z-10 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-text-secondary shadow-sm transition-colors hover:text-text-primary"
                  >
                    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                      <path
                        d="M8 4v14m0 0-3-3m3 3 3-3M16 20V6m0 0-3 3m3-3 3 3"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>

                <SwapOutputField
                  amount={protectedQuote.display.expectedOut}
                  isLoading={protectedQuote.isDisplayLoading}
                  onSelect={() => setSelectorTarget('to')}
                  token={toToken}
                  tokenPrice={toTokenPrice}
                />

                <div className="min-h-[201px] space-y-2 pt-3">
                  <DetailRow
                    label="Minimum received"
                    value={
                      minExpectedOut > 0n
                        ? `${formatWidgetPreciseValue(minExpectedOut, toToken.decimals)} ${toToken.symbol}`
                        : 'Unavailable'
                    }
                  />
                  {destinationVaultEstimate && destinationVaultMetadata ? (
                    <SwapVaultWorthRow
                      estimate={destinationVaultEstimate}
                      underlyingSymbol={destinationVaultMetadata.underlyingSymbol}
                      isLoading={protectedQuote.isDisplayLoading}
                    />
                  ) : null}
                  <DetailRow
                    label="Est. / Worst price impact"
                    value={
                      expectedOut > 0n
                        ? `${protectedQuote.estimatedPriceImpactPercentage.toFixed(2)}% | ${protectedQuote.worstCaseRouteImpactPercentage.toFixed(2)}%`
                        : 'Unavailable'
                    }
                  />
                  {destinationVaultEstimate && destinationVaultMetadata ? (
                    <SwapVaultAnnualReturnRow
                      estimate={destinationVaultEstimate}
                      underlyingSymbol={destinationVaultMetadata.underlyingSymbol}
                      annualRate={destinationVaultMetadata.annualRate}
                      isLoading={protectedQuote.isDisplayLoading}
                    />
                  ) : null}
                  <DetailRow label="Routing" value="Enso" />
                  {customRecipient ? (
                    <DetailRow
                      label="Recipient"
                      value={`${customRecipient.slice(0, 6)}...${customRecipient.slice(-4)}`}
                    />
                  ) : null}
                  {account && !isNativeInput && approvalSpenderAddress ? (
                    <div className="flex items-start justify-between gap-4 text-sm">
                      <button
                        type="button"
                        onClick={() => setIsApprovalOpen(true)}
                        className="yearn--link-dots text-left text-text-secondary transition-colors hover:text-text-primary"
                      >
                        Existing Approval (Enso Router)
                      </button>
                      {solver.periphery.isLoadingAllowance ? (
                        <span className="inline-block h-4 w-20 animate-pulse rounded bg-surface-secondary" />
                      ) : solver.periphery.allowance > 0n && allowanceDisplay !== 'Unlimited' ? (
                        <button
                          type="button"
                          onClick={() => setInputValue(formatUnits(solver.periphery.allowance, fromToken.decimals))}
                          className="text-right font-semibold text-text-primary transition-colors hover:text-primary"
                        >
                          {allowanceDisplay} {fromToken.symbol}
                        </button>
                      ) : (
                        <span className="text-right font-semibold text-text-primary">
                          {allowanceDisplay === 'Unlimited'
                            ? allowanceDisplay
                            : `${allowanceDisplay} ${fromToken.symbol}`}
                        </span>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="max-h-60 shrink-0 space-y-3 overflow-y-auto empty:hidden" aria-live="polite">
                {selectionPolicyError ? (
                  <p className="break-words rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
                    {selectionPolicyError}
                  </p>
                ) : null}
                {shouldBlockApprovalForAllowanceReset ? (
                  <ApprovalResetWarning
                    tokenSymbol={fromToken.symbol}
                    onManageApproval={() => setIsApprovalOpen(true)}
                  />
                ) : null}
                <PriceImpactWarning
                  percentage={protectedQuote.worstCaseRouteImpactPercentage}
                  userTolerancePercentage={zapSlippage}
                  isBlocking={protectedQuote.priceImpactInfo.isBlocking}
                  isLoading={protectedQuote.isPreparing}
                  isDebouncing={inputValue.isDebouncing}
                  isAmountSynced={inputValue.bn === inputValue.debouncedBn}
                  hasAmount={inputValue.bn > 0n}
                />
                {protectedQuote.hasUnpricedQuoteError ? (
                  <p className="break-words rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
                    Price impact cannot be verified for this pair, so execution is blocked.
                  </p>
                ) : null}
                {routeError ? (
                  <p className="break-words rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
                    {routeError}
                  </p>
                ) : null}
                {!ensoEnabled ? (
                  <p className="break-words rounded-md border border-border bg-surface-secondary px-3 py-2 text-xs text-text-secondary">
                    Enso routing is temporarily unavailable.
                  </p>
                ) : null}
              </div>

              <div className="mt-auto flex shrink-0 items-center gap-2">
                <div className="flex-1">
                  {!account ? (
                    <Button
                      onClick={openLoginModal}
                      variant="filled"
                      className="w-full"
                      classNameOverride="yearn--button--nextgen w-full"
                    >
                      {actionLabel}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setIsTransactionOpen(true)}
                      variant={isPreparing ? 'busy' : 'filled'}
                      isBusy={isPreparing}
                      disabled={isActionDisabled}
                      className="w-full"
                      classNameOverride="yearn--button--nextgen w-full"
                    >
                      {actionLabel}
                    </Button>
                  )}
                </div>
                {account ? (
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    aria-label="Open transaction settings"
                    aria-pressed={isSettingsOpen}
                    className="flex min-h-11 items-center justify-center rounded-md bg-surface-secondary px-3 py-2 text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
                  >
                    <IconSettings className="size-4" />
                  </button>
                ) : null}
              </div>
            </div>

            <SettingsPanel
              isActive={isSettingsOpen}
              onClose={() => setIsSettingsOpen(false)}
              variant="overlay"
              description="Route impact consumes part of this tolerance. You can also send the output to another address."
              showAutoStaking={false}
              defaultRecipient={account}
              recipient={customRecipient}
              onRecipientChange={setCustomRecipient}
            />
          </div>
        )}

        {selectorTarget ? (
          <TokenSelectorOverlay
            onClose={() => setSelectorTarget(null)}
            onChange={(address, chainId) => handlePairTokenChange(selectorTarget, address, chainId)}
            chainId={selectedChainId}
            value={selectedToken}
            priorityTokens={MAJOR_SWAP_TOKENS}
            topTokens={MAJOR_SWAP_TOKENS}
            mode="swap"
            excludeRetiredVaults={selectorTarget === 'to'}
            balanceOnly={selectorTarget === 'from'}
            resolveCustomToken={resolveCustomToken}
          />
        ) : null}

        {approvalSpenderAddress && !isNativeInput ? (
          <ApprovalOverlay
            isOpen={isApprovalOpen}
            onClose={() => setIsApprovalOpen(false)}
            onDone={async () => {
              await solver.periphery.refetchAllowance()
            }}
            disableSetUnlimited={
              solver.periphery.allowance > 0n && requiresAllowanceResetBeforeApproval(fromToken.address)
            }
            tokenSymbol={fromToken.symbol}
            tokenAddress={toAddress(fromToken.address)}
            tokenDecimals={fromToken.decimals}
            spenderAddress={approvalSpenderAddress}
            spenderName="Enso Router"
            chainId={selection.fromChainId}
            currentAllowance={allowanceDisplay}
            approvalWarning={solver.periphery.approvalWarning}
            actionLabel="swapping"
          />
        ) : null}

        <TransactionOverlay
          isOpen={isTransactionOpen}
          onClose={() => setIsTransactionOpen(false)}
          step={currentStep}
          isLastStep={!needsApproval}
          autoContinueToNextStep
          autoContinueStepLabels={['Approve']}
          onStepSuccess={(label) => {
            if (label === 'Approve') void solver.periphery.refetchAllowance()
          }}
          onBeforeSuccess={async () => {
            await onRefresh(swapBalanceRefreshTokens)
          }}
          onAllComplete={() => {
            setInputValue('')
          }}
        />
      </div>
    </div>
  )
}
