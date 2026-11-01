'use client'

import { useQuery } from '@tanstack/react-query'
import { getErc4626ReadMessage, readErc4626Vault } from '@yearn/vault-widget/erc4626/reader'
import { useVaultWidgetRuntime } from '@yearn/vault-widget/runtime'
import type { VaultWidgetVault, WidgetAddress } from '@yearn/vault-widget/types'
import { useCallback } from 'react'
import { isAddress, zeroAddress } from 'viem'
import { usePublicClient } from 'wagmi'

export function useErc4626Vault({
  address,
  chainId,
  account,
  contractKind,
  enabled = true
}: {
  address?: string
  chainId: number
  account?: WidgetAddress
  contractKind?: VaultWidgetVault['contractKind']
  enabled?: boolean
}) {
  const runtime = useVaultWidgetRuntime()
  const executionChainId = runtime.chains.resolveExecutionChainId(chainId)
  const client = usePublicClient({ chainId: executionChainId })
  const validAddress = !!address && isAddress(address) && address.toLowerCase() !== zeroAddress
  const query = useQuery({
    queryKey: [
      'erc4626-vault',
      chainId,
      executionChainId,
      address?.toLowerCase(),
      account?.toLowerCase(),
      contractKind ?? 'erc4626'
    ],
    queryFn: () => {
      if (!client || !validAddress) throw new Error('Vault reader is not configured.')
      return readErc4626Vault({ client, address: address as WidgetAddress, chainId, account, contractKind })
    },
    enabled: enabled && validAddress && executionChainId !== undefined && !!client,
    refetchInterval: 15_000,
    staleTime: 10_000,
    retry: 1
  })
  const refetch = useCallback(async () => {
    const result = await query.refetch()
    if (result.error) throw result.error
  }, [query.refetch])
  const error = !validAddress
    ? 'Enter a valid vault address.'
    : executionChainId === undefined || !client
      ? 'This network is not configured.'
      : query.error
        ? getErc4626ReadMessage(query.error)
        : undefined
  return {
    vault: query.data?.vault,
    vaultUserData: query.data ? { ...query.data.user, isLoading: false, error, refetch } : undefined,
    isLoading: !error && query.isPending,
    error,
    refetch
  }
}
