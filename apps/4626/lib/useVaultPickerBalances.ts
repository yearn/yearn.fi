'use client'

import { DemoContext } from '@erc4626/lib/demoContext'
import { isDemoToken } from '@erc4626/lib/demoHolding'
import type { TVaultChoice } from '@erc4626/lib/vaultDiscovery'
import { useQuery } from '@tanstack/react-query'
import { getPublicClient } from '@wagmi/core'
import { useContext } from 'react'
import { type Address, erc20Abi } from 'viem'
import { useAccount, useConfig } from 'wagmi'

export const walletTokenKey = (chainId: number, address: string) => `${chainId}:${address.toLowerCase()}`

/** Read balances only for the currently rendered rows, using the demo's isolated transport when active. */
export function useVaultPickerBalances(vaults: TVaultChoice[]) {
  const demo = useContext(DemoContext)
  const config = useConfig()
  const { address: owner } = useAccount()
  const tokens = Array.from(
    new Map(
      vaults
        .flatMap((vault) => [
          { address: vault.address, chainId: vault.chainId },
          ...(vault.assetAddress ? [{ address: vault.assetAddress, chainId: vault.chainId }] : [])
        ])
        .filter((token) => !demo || isDemoToken(token.chainId, token.address))
        .map((token) => [walletTokenKey(token.chainId, token.address), token])
    ).values()
  ).sort((a, b) => walletTokenKey(a.chainId, a.address).localeCompare(walletTokenKey(b.chainId, b.address)))
  return useQuery({
    queryKey: ['vault-picker-balances', demo, owner?.toLowerCase(), tokens],
    enabled: !!owner && tokens.length > 0,
    staleTime: 15_000,
    refetchInterval: 15_000,
    queryFn: async () => {
      const results = await Promise.all(
        Array.from(new Set(tokens.map((token) => token.chainId))).map(async (chainId) => {
          const client = getPublicClient(config, { chainId })
          const group = tokens.filter((token) => token.chainId === chainId)
          if (!client) return { entries: [], unreadable: group.length }
          const contracts = group.map((token) => ({
            address: token.address as Address,
            abi: erc20Abi,
            functionName: 'balanceOf' as const,
            args: [owner!] as const
          }))
          const reads = demo
            ? await Promise.all(
                contracts.map(async (call) =>
                  client
                    .readContract(call)
                    .then((result) => ({ status: 'success' as const, result }))
                    .catch(() => ({ status: 'failure' as const }))
                )
              )
            : await client
                .multicall({ contracts, allowFailure: true })
                .catch(() => group.map(() => ({ status: 'failure' as const })))
          return {
            entries: reads.flatMap((read, index) =>
              read.status === 'success' ? [[walletTokenKey(chainId, group[index].address), read.result] as const] : []
            ),
            unreadable: reads.filter((read) => read.status === 'failure').length
          }
        })
      )
      return {
        balances: Object.fromEntries(results.flatMap((result) => result.entries)) as Record<string, bigint>,
        unreadable: results.reduce((total, result) => total + result.unreadable, 0)
      }
    }
  })
}
