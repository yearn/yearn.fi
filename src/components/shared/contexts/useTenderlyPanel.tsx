import { useLocalStorageValue } from '@react-hookz/web'
import { toast } from '@shared/components/yToast'
import { useWallet } from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useYearn } from '@shared/contexts/useYearn'
import { useTokenList } from '@shared/contexts/WithTokenList'
import type {
  TTenderlyFundableAsset,
  TTenderlyFundRequest,
  TTenderlyIncreaseTimeRequest,
  TTenderlyPanelStatus,
  TTenderlySnapshotRecord,
  TTenderlySnapshotRequest
} from '@shared/types/tenderly'
import {
  buildTenderlyFundableAssets,
  clearTenderlySnapshotBucket,
  getTenderlySnapshotBucketKey,
  getValidBaselineSnapshot,
  markTenderlySnapshotInvalid,
  resolveDefaultTenderlyCanonicalChainId,
  sortTenderlySnapshotRecords,
  TENDERLY_SNAPSHOT_STORAGE_KEY,
  type TTenderlySnapshotStorage,
  upsertTenderlySnapshotRecord
} from '@shared/utils/tenderlyPanel'
import { useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react'
import { isTenderlyModeEnabled } from '@/config/tenderly'
import { useChains } from '@/context/chainsContext'

type TTenderlyPanelContext = {
  isTenderlyMode: boolean
  isStatusLoading: boolean
  isPanelAvailable: boolean
  isOpen: boolean
  status?: TTenderlyPanelStatus
  selectedCanonicalChainId?: number
  selectedExecutionChainId?: number
  snapshotRecords: TTenderlySnapshotRecord[]
  baselineSnapshot?: TTenderlySnapshotRecord
  fundableAssets: TTenderlyFundableAsset[]
  connectedWalletAddress?: `0x${string}`
  pendingAction: string | null
  openPanel: () => void
  closePanel: () => void
  togglePanel: () => void
  setSelectedCanonicalChainId: (chainId: number) => void
  refetchStatus: () => Promise<void>
  createBaselineSnapshot: () => Promise<void>
  createSnapshot: () => Promise<void>
  clearSnapshotHistory: () => void
  revertToSnapshot: (snapshotRecord: TTenderlySnapshotRecord) => Promise<void>
  increaseTime: (params: Omit<TTenderlyIncreaseTimeRequest, 'canonicalChainId'>) => Promise<void>
  fundWallet: (params: Omit<TTenderlyFundRequest, 'canonicalChainId' | 'walletAddress'>) => Promise<void>
}

const TenderlyPanelContext = createContext<TTenderlyPanelContext>({
  isTenderlyMode: false,
  isStatusLoading: false,
  isPanelAvailable: false,
  isOpen: false,
  snapshotRecords: [],
  fundableAssets: [],
  pendingAction: null,
  openPanel: (): void => undefined,
  closePanel: (): void => undefined,
  togglePanel: (): void => undefined,
  setSelectedCanonicalChainId: (): void => undefined,
  refetchStatus: async (): Promise<void> => undefined,
  createBaselineSnapshot: async (): Promise<void> => undefined,
  createSnapshot: async (): Promise<void> => undefined,
  clearSnapshotHistory: (): void => undefined,
  revertToSnapshot: async (): Promise<void> => undefined,
  increaseTime: async (): Promise<void> => undefined,
  fundWallet: async (): Promise<void> => undefined
})

async function fetchTenderlyApi<TResponse, TRequest = undefined>(
  path: string,
  options?: {
    method?: 'GET' | 'POST'
    body?: TRequest
  }
): Promise<TResponse> {
  const response = await fetch(path, {
    method: options?.method || 'GET',
    headers: options?.body ? { 'content-type': 'application/json' } : undefined,
    body: options?.body ? JSON.stringify(options.body) : undefined
  })
  const payload = (await response.json().catch(() => undefined)) as { error?: string } & TResponse

  if (!response.ok) {
    throw new Error(payload?.error || `Tenderly API request failed with status ${response.status}`)
  }

  return payload
}

export function TenderlyPanelProvider({ children }: { children: ReactNode }): ReactElement {
  const queryClient = useQueryClient()
  const { chainIdIntent } = useChains()
  const { chainID, address } = useWeb3()
  const { onRefresh } = useWallet()
  const { allVaults, enableVaultListFetch } = useYearn()
  const { tokenLists } = useTokenList()
  const [status, setStatus] = useState<TTenderlyPanelStatus | undefined>(undefined)
  const [isStatusLoading, setIsStatusLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedCanonicalChainId, setSelectedCanonicalChainIdState] = useState<number | undefined>(undefined)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const { value: snapshotStorageValue, set: setSnapshotStorage } = useLocalStorageValue<TTenderlySnapshotStorage>(
    TENDERLY_SNAPSHOT_STORAGE_KEY,
    {
      defaultValue: {}
    }
  )
  const snapshotStorage = snapshotStorageValue || {}
  const isTenderlyMode = isTenderlyModeEnabled()

  const refetchStatus = useCallback(async (): Promise<void> => {
    if (!isTenderlyMode) {
      setStatus(undefined)
      return
    }

    setIsStatusLoading(true)
    try {
      const nextStatus = await fetchTenderlyApi<TTenderlyPanelStatus>('/api/tenderly/status')
      setStatus(nextStatus)
    } catch (error) {
      console.error('Failed to fetch Tenderly status:', error)
      setStatus(undefined)
    } finally {
      setIsStatusLoading(false)
    }
  }, [isTenderlyMode])

  useEffect(() => {
    void refetchStatus()
  }, [refetchStatus])

  useEffect(() => {
    if (isOpen) {
      enableVaultListFetch()
    }
  }, [enableVaultListFetch, isOpen])

  const availableConfiguredChains = useMemo(
    () => (status?.configuredChains || []).filter((chain) => chain.hasAdminRpc),
    [status?.configuredChains]
  )

  useEffect(() => {
    const defaultCanonicalChainId = resolveDefaultTenderlyCanonicalChainId(availableConfiguredChains, [
      chainID,
      chainIdIntent
    ])
    const canKeepSelectedChain = availableConfiguredChains.some(
      (chain) => chain.canonicalChainId === selectedCanonicalChainId
    )

    if (canKeepSelectedChain) {
      return
    }

    setSelectedCanonicalChainIdState(defaultCanonicalChainId)
  }, [availableConfiguredChains, chainID, chainIdIntent, selectedCanonicalChainId])

  const selectedChain = useMemo(
    () => availableConfiguredChains.find((chain) => chain.canonicalChainId === selectedCanonicalChainId),
    [availableConfiguredChains, selectedCanonicalChainId]
  )
  const snapshotBucketKey =
    selectedChain && selectedCanonicalChainId !== undefined
      ? getTenderlySnapshotBucketKey(selectedCanonicalChainId, selectedChain.executionChainId)
      : undefined
  const snapshotRecords = useMemo(
    () => (snapshotBucketKey ? sortTenderlySnapshotRecords(snapshotStorage[snapshotBucketKey] || []) : []),
    [snapshotBucketKey, snapshotStorage]
  )
  const baselineSnapshot = useMemo(() => getValidBaselineSnapshot(snapshotRecords), [snapshotRecords])
  const fundableAssets = useMemo(
    () =>
      selectedCanonicalChainId
        ? buildTenderlyFundableAssets({
            chainId: selectedCanonicalChainId,
            tokenLists,
            allVaults
          })
        : [],
    [allVaults, selectedCanonicalChainId, tokenLists]
  )

  const isPanelAvailable = isTenderlyMode && availableConfiguredChains.length > 0

  const refreshTenderlyDependentState = useCallback(async (): Promise<void> => {
    await queryClient.invalidateQueries()
    if (address) {
      await onRefresh().catch((error) => {
        console.error('Failed to refresh wallet balances after Tenderly action:', error)
      })
    }
  }, [address, onRefresh, queryClient])

  const updateSnapshotStorage = useCallback(
    (updater: (snapshotStorage: TTenderlySnapshotStorage) => TTenderlySnapshotStorage): void => {
      setSnapshotStorage(updater(snapshotStorage))
    },
    [setSnapshotStorage, snapshotStorage]
  )

  const createSnapshotWithKind = useCallback(
    async (isBaseline: boolean): Promise<void> => {
      if (!selectedCanonicalChainId) {
        throw new Error('No Tenderly chain selected')
      }

      setPendingAction(isBaseline ? 'create-baseline' : 'create-snapshot')
      try {
        const snapshotRecord = await fetchTenderlyApi<TTenderlySnapshotRecord, TTenderlySnapshotRequest>(
          '/api/tenderly/snapshot',
          {
            method: 'POST',
            body: {
              canonicalChainId: selectedCanonicalChainId,
              isBaseline
            }
          }
        )
        updateSnapshotStorage((currentStorage) => upsertTenderlySnapshotRecord(currentStorage, snapshotRecord))
        toast({
          content: isBaseline ? 'Baseline snapshot created' : 'Snapshot created',
          type: 'success'
        })
      } finally {
        setPendingAction(null)
      }
    },
    [selectedCanonicalChainId, updateSnapshotStorage]
  )

  const revertToSnapshot = useCallback(
    async (snapshotRecord: TTenderlySnapshotRecord): Promise<void> => {
      setPendingAction('revert-snapshot')
      try {
        await fetchTenderlyApi('/api/tenderly/revert', {
          method: 'POST',
          body: {
            canonicalChainId: snapshotRecord.canonicalChainId,
            snapshotId: snapshotRecord.snapshotId
          }
        })
        await refreshTenderlyDependentState()
        toast({
          content: snapshotRecord.kind === 'baseline' ? 'Reset to baseline complete' : 'Snapshot revert complete',
          type: 'success'
        })
      } catch (error) {
        updateSnapshotStorage((currentStorage) =>
          markTenderlySnapshotInvalid(currentStorage, {
            canonicalChainId: snapshotRecord.canonicalChainId,
            executionChainId: snapshotRecord.executionChainId,
            snapshotId: snapshotRecord.snapshotId
          })
        )
        throw error
      } finally {
        setPendingAction(null)
      }
    },
    [refreshTenderlyDependentState, updateSnapshotStorage]
  )

  const increaseTime = useCallback(
    async (params: Omit<TTenderlyIncreaseTimeRequest, 'canonicalChainId'>): Promise<void> => {
      if (!selectedCanonicalChainId) {
        throw new Error('No Tenderly chain selected')
      }

      setPendingAction('increase-time')
      try {
        await fetchTenderlyApi('/api/tenderly/increase-time', {
          method: 'POST',
          body: {
            canonicalChainId: selectedCanonicalChainId,
            seconds: params.seconds,
            mineBlock: params.mineBlock
          }
        })
        await refreshTenderlyDependentState()
        toast({
          content: `Fast-forwarded Tenderly by ${params.seconds} seconds`,
          type: 'success'
        })
      } finally {
        setPendingAction(null)
      }
    },
    [refreshTenderlyDependentState, selectedCanonicalChainId]
  )

  const fundWallet = useCallback(
    async (params: Omit<TTenderlyFundRequest, 'canonicalChainId' | 'walletAddress'>): Promise<void> => {
      if (!selectedCanonicalChainId) {
        throw new Error('No Tenderly chain selected')
      }
      if (!address) {
        throw new Error('Connect a wallet before using the Tenderly faucet')
      }

      setPendingAction('fund-wallet')
      try {
        await fetchTenderlyApi('/api/tenderly/fund', {
          method: 'POST',
          body: {
            canonicalChainId: selectedCanonicalChainId,
            walletAddress: address,
            ...params
          }
        })
        await refreshTenderlyDependentState()
        toast({
          content: `Funded ${address}`,
          type: 'success'
        })
      } finally {
        setPendingAction(null)
      }
    },
    [address, refreshTenderlyDependentState, selectedCanonicalChainId]
  )

  const createBaselineSnapshot = useCallback(async (): Promise<void> => {
    try {
      await createSnapshotWithKind(true)
    } catch (error) {
      toast({
        content: error instanceof Error ? error.message : 'Failed to create baseline snapshot',
        type: 'error'
      })
    }
  }, [createSnapshotWithKind])

  const createSnapshot = useCallback(async (): Promise<void> => {
    try {
      await createSnapshotWithKind(false)
    } catch (error) {
      toast({
        content: error instanceof Error ? error.message : 'Failed to create snapshot',
        type: 'error'
      })
    }
  }, [createSnapshotWithKind])

  const clearSnapshotHistory = useCallback((): void => {
    if (!selectedCanonicalChainId || !selectedChain?.executionChainId) {
      return
    }

    updateSnapshotStorage((currentStorage) =>
      clearTenderlySnapshotBucket(currentStorage, {
        canonicalChainId: selectedCanonicalChainId,
        executionChainId: selectedChain.executionChainId
      })
    )
    toast({
      content: 'Cleared local Tenderly snapshot history for this chain',
      type: 'success'
    })
  }, [selectedCanonicalChainId, selectedChain?.executionChainId, updateSnapshotStorage])

  const revertToSnapshotWithToast = useCallback(
    async (snapshotRecord: TTenderlySnapshotRecord): Promise<void> => {
      try {
        await revertToSnapshot(snapshotRecord)
      } catch (error) {
        toast({
          content: error instanceof Error ? error.message : 'Failed to revert snapshot',
          type: 'error'
        })
      }
    },
    [revertToSnapshot]
  )

  const increaseTimeWithToast = useCallback(
    async (params: Omit<TTenderlyIncreaseTimeRequest, 'canonicalChainId'>): Promise<void> => {
      try {
        await increaseTime(params)
      } catch (error) {
        toast({
          content: error instanceof Error ? error.message : 'Failed to fast-forward Tenderly',
          type: 'error'
        })
      }
    },
    [increaseTime]
  )

  const fundWalletWithToast = useCallback(
    async (params: Omit<TTenderlyFundRequest, 'canonicalChainId' | 'walletAddress'>): Promise<void> => {
      try {
        await fundWallet(params)
      } catch (error) {
        toast({
          content: error instanceof Error ? error.message : 'Failed to fund wallet on Tenderly',
          type: 'error'
        })
      }
    },
    [fundWallet]
  )

  const contextValue = useMemo(
    (): TTenderlyPanelContext => ({
      isTenderlyMode,
      isStatusLoading,
      isPanelAvailable,
      isOpen,
      status,
      selectedCanonicalChainId,
      selectedExecutionChainId: selectedChain?.executionChainId,
      snapshotRecords,
      baselineSnapshot,
      fundableAssets,
      connectedWalletAddress: address,
      pendingAction,
      openPanel: (): void => setIsOpen(true),
      closePanel: (): void => setIsOpen(false),
      togglePanel: (): void => setIsOpen((current) => !current),
      setSelectedCanonicalChainId: setSelectedCanonicalChainIdState,
      refetchStatus,
      createBaselineSnapshot,
      createSnapshot,
      clearSnapshotHistory,
      revertToSnapshot: revertToSnapshotWithToast,
      increaseTime: increaseTimeWithToast,
      fundWallet: fundWalletWithToast
    }),
    [
      isTenderlyMode,
      isStatusLoading,
      isPanelAvailable,
      isOpen,
      status,
      selectedCanonicalChainId,
      selectedChain?.executionChainId,
      snapshotRecords,
      baselineSnapshot,
      fundableAssets,
      address,
      pendingAction,
      refetchStatus,
      createBaselineSnapshot,
      createSnapshot,
      clearSnapshotHistory,
      revertToSnapshotWithToast,
      increaseTimeWithToast,
      fundWalletWithToast
    ]
  )

  return <TenderlyPanelContext.Provider value={contextValue}>{children}</TenderlyPanelContext.Provider>
}

export function useTenderlyPanel(): TTenderlyPanelContext {
  return useContext(TenderlyPanelContext)
}
