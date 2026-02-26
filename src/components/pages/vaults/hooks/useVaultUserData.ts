import { VAULT_V3_ABI } from '@shared/contracts/abi/vaultV3.abi'
import { toNormalizedBN } from '@shared/utils'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { type Address, getContract } from 'viem'
import { useConfig } from 'wagmi'
import { getClient } from 'wagmi/actions'
import { type Token, useTokens } from './useTokens'

export interface VaultUserData {
  // Token objects (from useTokens)
  assetToken: Token | undefined
  vaultToken: Token | undefined
  stakingToken: Token | undefined

  // Vault-specific
  pricePerShare: bigint

  // Computed values
  availableToDeposit: bigint
  depositedShares: bigint
  depositedValue: bigint

  // State
  isLoading: boolean
  refetch: () => void
}

interface UseVaultUserDataParams {
  vaultAddress: Address
  assetAddress: Address
  stakingAddress?: Address
  chainId: number
  account?: Address
}

export const useVaultUserData = ({
  vaultAddress,
  assetAddress,
  stakingAddress,
  chainId,
  account
}: UseVaultUserDataParams): VaultUserData => {
  const config = useConfig()

  // Reuse useTokens for token data + balances
  const priorityAddresses = useMemo(() => {
    const addrs: (Address | undefined)[] = [assetAddress, vaultAddress]
    if (stakingAddress) addrs.push(stakingAddress)
    return addrs
  }, [assetAddress, vaultAddress, stakingAddress])

  const { tokens, isLoading: isLoadingTokens, refetch: refetchTokens } = useTokens(priorityAddresses, chainId, account)

  // Separate query for pricePerShare (vault-specific)
  const {
    data: pricePerShare,
    isLoading: isLoadingPPS,
    refetch: refetchPPS
  } = useQuery({
    queryKey: ['vaultPricePerShare', vaultAddress?.toLowerCase(), chainId],
    queryFn: async () => {
      const client = getClient(config, { chainId })
      if (!client) {
        throw new Error(`No client found for chainId ${chainId}`)
      }
      const contract = getContract({
        address: vaultAddress,
        abi: VAULT_V3_ABI,
        client
      })
      return contract.read.pricePerShare()
    },
    enabled: !!vaultAddress && !!chainId,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  })

  // Combined refetch
  const refetch = useCallback(() => {
    refetchTokens()
    refetchPPS()
  }, [refetchTokens, refetchPPS])

  // Derive tokens
  const [assetToken, vaultToken, rawStakingToken] = tokens

  const stakingToken = useMemo(() => {
    if (!rawStakingToken) {
      return undefined
    }

    const metadataMissing = rawStakingToken.symbol === '???' || rawStakingToken.name === 'Unknown'
    if (!metadataMissing) {
      return rawStakingToken
    }

    const fallbackDecimals = vaultToken?.decimals ?? rawStakingToken.decimals ?? 18
    return {
      ...rawStakingToken,
      decimals: fallbackDecimals,
      symbol: vaultToken?.symbol ?? rawStakingToken.symbol,
      name: vaultToken?.name ?? rawStakingToken.name,
      balance: toNormalizedBN(rawStakingToken.balance.raw, fallbackDecimals)
    }
  }, [rawStakingToken, vaultToken?.decimals, vaultToken?.symbol, vaultToken?.name])

  const depositedShares = useMemo(() => {
    const vaultBalance = vaultToken?.balance.raw ?? 0n
    const stakingBalance = stakingToken?.balance.raw ?? 0n
    return vaultBalance + stakingBalance
  }, [vaultToken, stakingToken])

  const depositedValue = useMemo(() => {
    if (!pricePerShare || depositedShares === 0n) return 0n
    const vaultDecimals = vaultToken?.decimals ?? 18
    return (depositedShares * pricePerShare) / 10n ** BigInt(vaultDecimals)
  }, [depositedShares, pricePerShare, vaultToken?.decimals])

  return {
    assetToken,
    vaultToken,
    stakingToken,
    pricePerShare: pricePerShare ?? 0n,
    availableToDeposit: assetToken?.balance.raw ?? 0n,
    depositedShares,
    depositedValue,
    isLoading: isLoadingTokens || isLoadingPPS,
    refetch
  }
}
