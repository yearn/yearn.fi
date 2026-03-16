import { useBlockNumber, usePublicClient } from '@shared/hooks/useAppWagmi'
import { useCallback, useEffect, useState } from 'react'

type TChainTimestampState = {
  blockTimestamp: number
  fetchedAtMs: number
}

export function useChainTimestamp({ chainId, enabled = true }: { chainId?: number; enabled?: boolean }): {
  timestamp: number
  latestBlockTimestamp?: number
  isLoading: boolean
  refetch: () => Promise<void>
} {
  const { data: blockNumber } = useBlockNumber({
    chainId,
    watch: enabled,
    query: { enabled: Boolean(enabled && chainId) }
  })
  const publicClient = usePublicClient({ chainId })
  const [chainTimestampState, setChainTimestampState] = useState<TChainTimestampState | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)
  const [, setTick] = useState(0)

  const refetch = useCallback(async (): Promise<void> => {
    if (!enabled || !publicClient) {
      return
    }

    setIsLoading(true)
    try {
      const block =
        blockNumber !== undefined ? await publicClient.getBlock({ blockNumber }) : await publicClient.getBlock()
      setChainTimestampState({
        blockTimestamp: Number(block.timestamp),
        fetchedAtMs: Date.now()
      })
    } finally {
      setIsLoading(false)
    }
  }, [blockNumber, enabled, publicClient])

  useEffect(() => {
    void refetch()
  }, [refetch])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const interval = window.setInterval(() => {
      setTick((current) => current + 1)
    }, 1_000)

    return () => window.clearInterval(interval)
  }, [enabled])

  const fallbackTimestamp = Math.floor(Date.now() / 1000)
  const timestamp = chainTimestampState
    ? chainTimestampState.blockTimestamp +
      Math.max(0, Math.floor((Date.now() - chainTimestampState.fetchedAtMs) / 1_000))
    : fallbackTimestamp

  return {
    timestamp,
    latestBlockTimestamp: chainTimestampState?.blockTimestamp,
    isLoading,
    refetch
  }
}
