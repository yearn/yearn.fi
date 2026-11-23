import { useLocalStorageValue } from '@react-hookz/web'
import { toast } from '@shared/components/yToast'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useYearn } from '@shared/contexts/useYearn'
import { useTokenList } from '@shared/contexts/WithTokenList'
import type {
  TTenderlyFundableAsset,
  TTenderlyFundRequest,
  TTenderlyIncreaseTimeRequest,
  TTenderlyPanelStatus,
  TTenderlySnapshotRecord
} from '@shared/types/localFork'
import {
  createAnvilSnapshot,
  fundAnvilWallet,
  getLocalAnvilRpcUri,
  increaseAnvilTime,
  readAnvilInstance,
  revertAnvilSnapshot
} from '@shared/utils/anvilPanel'
import {
  buildTenderlyFundableAssets,
  clearTenderlySnapshotBucket,
  getTenderlySnapshotBucketKey,
  getValidBaselineSnapshot,
  markTenderlySnapshotInvalid,
  reconcileTenderlySnapshotStorageAfterRevert,
  resolveDefaultTenderlyCanonicalChainId,
  sortTenderlySnapshotRecords,
  type TTenderlySnapshotStorage,
  upsertTenderlySnapshotRecord
} from '@shared/utils/localForkPanel'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
import { canonicalChains } from '@/config/chainDefinitions'
import { isTenderlyModeEnabled, tenderlyRuntime } from '@/config/localForkRuntime'
import { useChains } from '@/context/chainsContext'
import { env } from '@/env'

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
  stateRevision: number
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
  stateRevision: 0,
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

const ANVIL_INSTANCES_QUERY_KEY = ['local-anvil-instances']
const ANVIL_SNAPSHOT_STORAGE_KEY = 'yearn.fi/anvil/snapshots'

const localForkChains = Object.values(tenderlyRuntime.configuredByCanonicalId).flatMap((chain) => {
  const rpcUri = getLocalAnvilRpcUri(chain.rpcUri)
  const canonicalChain = canonicalChains.find((entry) => entry.id === chain.canonicalChainId)
  return rpcUri && canonicalChain
    ? [{ ...chain, rpcUri, canonicalChainName: canonicalChain.name, hasAdminRpc: true }]
    : []
})

async function readLocalAnvilInstances(): Promise<Record<number, string | undefined>> {
  return Object.fromEntries(
    await Promise.all(
      localForkChains.map(async (chain) => [
        chain.canonicalChainId,
        await readAnvilInstance(chain.rpcUri, chain.executionChainId).catch(() => undefined)
      ])
    )
  )
}

export function TenderlyPanelProvider({ children }: { children: ReactNode }): ReactElement {
  const queryClient = useQueryClient()
  const { chainIdIntent } = useChains()
  const { chainID, address } = useWeb3()
  const { allVaults, enableVaultListFetch } = useYearn()
  const { tokenLists } = useTokenList()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedCanonicalChainIdPreference, setSelectedCanonicalChainIdState] = useState<number | undefined>(undefined)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [stateRevision, setStateRevision] = useState(0)
  const { value: snapshotStorage = {}, set: setSnapshotStorage } = useLocalStorageValue<
    Record<string, TTenderlySnapshotStorage>
  >(ANVIL_SNAPSHOT_STORAGE_KEY, { defaultValue: {} })
  const isTenderlyMode =
    env.DEV &&
    isTenderlyModeEnabled() &&
    typeof window !== 'undefined' &&
    Boolean(getLocalAnvilRpcUri(window.location.origin))
  const {
    data: anvilInstances,
    isFetching: isStatusLoading,
    refetch
  } = useQuery({
    queryKey: ANVIL_INSTANCES_QUERY_KEY,
    queryFn: readLocalAnvilInstances,
    enabled: isTenderlyMode && localForkChains.length > 0
  })
  const isPanelAvailable = isTenderlyMode && localForkChains.length > 0 && anvilInstances !== undefined

  const refetchStatus = useCallback(async (): Promise<void> => {
    if (isPanelAvailable) await refetch()
  }, [isPanelAvailable, refetch])

  useEffect(() => {
    if (isOpen) {
      enableVaultListFetch()
      void refetchStatus()
    }
  }, [enableVaultListFetch, isOpen, refetchStatus])

  const status = useMemo<TTenderlyPanelStatus | undefined>(
    () =>
      isPanelAvailable
        ? {
            isTenderlyModeEnabled: true,
            configuredChains: localForkChains.map(
              ({ canonicalChainId, canonicalChainName, executionChainId, hasAdminRpc }) => ({
                canonicalChainId,
                canonicalChainName,
                executionChainId,
                hasAdminRpc
              })
            )
          }
        : undefined,
    [isPanelAvailable]
  )
  const selectedCanonicalChainId =
    selectedCanonicalChainIdPreference ??
    resolveDefaultTenderlyCanonicalChainId(localForkChains, [chainID, chainIdIntent])

  const selectedChain = useMemo(
    () => localForkChains.find((chain) => chain.canonicalChainId === selectedCanonicalChainId),
    [selectedCanonicalChainId]
  )
  const snapshotBucketKey =
    selectedChain && selectedCanonicalChainId !== undefined
      ? getTenderlySnapshotBucketKey(selectedCanonicalChainId, selectedChain.executionChainId)
      : undefined
  const selectedInstanceId = selectedChain && anvilInstances?.[selectedChain.canonicalChainId]
  const snapshotRecords = useMemo(
    () =>
      selectedInstanceId && snapshotBucketKey
        ? sortTenderlySnapshotRecords(snapshotStorage[selectedInstanceId]?.[snapshotBucketKey] || [])
        : [],
    [selectedInstanceId, snapshotBucketKey, snapshotStorage]
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

  const refreshTenderlyDependentState = useCallback(async (): Promise<void> => {
    await queryClient.invalidateQueries()
    setStateRevision((currentRevision) => currentRevision + 1)
  }, [queryClient])

  const updateSnapshotStorage = useCallback(
    (instanceId: string, updater: (storage: TTenderlySnapshotStorage) => TTenderlySnapshotStorage): void => {
      setSnapshotStorage((currentStorage = {}) => ({
        ...currentStorage,
        [instanceId]: updater(currentStorage?.[instanceId] || {})
      }))
    },
    [setSnapshotStorage]
  )

  const getLocalFork = useCallback(async () => {
    if (!isPanelAvailable || !selectedChain) {
      throw new Error('Select a local Anvil chain')
    }

    const instanceId = await readAnvilInstance(selectedChain.rpcUri, selectedChain.executionChainId)
    queryClient.setQueryData<Record<number, string | undefined>>(ANVIL_INSTANCES_QUERY_KEY, (instances) => ({
      ...instances,
      [selectedChain.canonicalChainId]: instanceId
    }))
    return { ...selectedChain, instanceId }
  }, [isPanelAvailable, queryClient, selectedChain])

  const createSnapshotWithKind = useCallback(
    async (isBaseline: boolean): Promise<void> => {
      setPendingAction(isBaseline ? 'create-baseline' : 'create-snapshot')
      try {
        const fork = await getLocalFork()
        const snapshotRecord = await createAnvilSnapshot(fork.rpcUri, fork.executionChainId, {
          canonicalChainId: fork.canonicalChainId,
          isBaseline
        })
        updateSnapshotStorage(fork.instanceId, (storage) => upsertTenderlySnapshotRecord(storage, snapshotRecord))
        toast({
          content: isBaseline ? 'Baseline snapshot created' : 'Snapshot created',
          type: 'success'
        })
      } finally {
        setPendingAction(null)
      }
    },
    [getLocalFork, updateSnapshotStorage]
  )

  const revertToSnapshot = useCallback(
    async (snapshotRecord: TTenderlySnapshotRecord): Promise<void> => {
      setPendingAction('revert-snapshot')
      try {
        const fork = await getLocalFork()
        if (
          fork.instanceId !== selectedInstanceId ||
          fork.canonicalChainId !== snapshotRecord.canonicalChainId ||
          fork.executionChainId !== snapshotRecord.executionChainId
        ) {
          throw new Error('This snapshot belongs to a different Anvil session')
        }

        try {
          await revertAnvilSnapshot(fork.rpcUri, snapshotRecord.snapshotId)
        } catch (error) {
          updateSnapshotStorage(fork.instanceId, (storage) => markTenderlySnapshotInvalid(storage, snapshotRecord))
          throw error
        }

        const replacementSnapshotRecord = await createAnvilSnapshot(fork.rpcUri, fork.executionChainId, {
          canonicalChainId: snapshotRecord.canonicalChainId,
          isBaseline: snapshotRecord.kind === 'baseline',
          label: snapshotRecord.label
        }).catch((error) => {
          console.error('Failed to create replacement Anvil snapshot after revert:', error)
          return undefined
        })

        updateSnapshotStorage(fork.instanceId, (storage) =>
          reconcileTenderlySnapshotStorageAfterRevert(storage, {
            revertedSnapshotRecord: snapshotRecord,
            replacementSnapshotRecord
          })
        )

        try {
          await refreshTenderlyDependentState()
        } catch (error) {
          console.error('Failed to refresh state after Anvil revert:', error)
        }

        toast({
          content: replacementSnapshotRecord
            ? snapshotRecord.kind === 'baseline'
              ? 'Reset to baseline complete'
              : 'Snapshot revert complete'
            : snapshotRecord.kind === 'baseline'
              ? 'Reset to baseline complete, but the baseline was consumed. Create a new baseline snapshot before resetting again.'
              : 'Snapshot revert complete, but that snapshot was consumed. Create a new snapshot if you want to reuse it.',
          type: replacementSnapshotRecord ? 'success' : 'warning'
        })
      } finally {
        setPendingAction(null)
      }
    },
    [getLocalFork, refreshTenderlyDependentState, selectedInstanceId, updateSnapshotStorage]
  )

  const increaseTime = useCallback(
    async (params: Omit<TTenderlyIncreaseTimeRequest, 'canonicalChainId'>): Promise<void> => {
      setPendingAction('increase-time')
      try {
        const fork = await getLocalFork()
        if (fork.instanceId !== selectedInstanceId || !baselineSnapshot) {
          throw new Error('Create a baseline snapshot for this Anvil session first')
        }
        await increaseAnvilTime(fork.rpcUri, params)
        await refreshTenderlyDependentState()
        toast({
          content: `Fast-forwarded Anvil by ${params.seconds} seconds`,
          type: 'success'
        })
      } finally {
        setPendingAction(null)
      }
    },
    [baselineSnapshot, getLocalFork, refreshTenderlyDependentState, selectedInstanceId]
  )

  const fundWallet = useCallback(
    async (params: Omit<TTenderlyFundRequest, 'canonicalChainId' | 'walletAddress'>): Promise<void> => {
      if (!address) {
        throw new Error('Connect a wallet before using the Anvil faucet')
      }

      setPendingAction('fund-wallet')
      try {
        const fork = await getLocalFork()
        if (fork.instanceId !== selectedInstanceId || !baselineSnapshot) {
          throw new Error('Create a baseline snapshot for this Anvil session first')
        }
        await fundAnvilWallet(fork.rpcUri, {
          canonicalChainId: fork.canonicalChainId,
          walletAddress: address,
          ...params
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
    [address, baselineSnapshot, getLocalFork, refreshTenderlyDependentState, selectedInstanceId]
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
    if (!selectedCanonicalChainId || !selectedChain?.executionChainId || !selectedInstanceId) {
      return
    }

    updateSnapshotStorage(selectedInstanceId, (currentStorage) =>
      clearTenderlySnapshotBucket(currentStorage, {
        canonicalChainId: selectedCanonicalChainId,
        executionChainId: selectedChain.executionChainId
      })
    )
    toast({
      content: 'Cleared local Anvil snapshot history for this chain',
      type: 'success'
    })
  }, [selectedCanonicalChainId, selectedChain?.executionChainId, selectedInstanceId, updateSnapshotStorage])

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
          content: error instanceof Error ? error.message : 'Failed to fast-forward Anvil',
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
          content: error instanceof Error ? error.message : 'Failed to fund wallet on Anvil',
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
      stateRevision,
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
      stateRevision,
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
