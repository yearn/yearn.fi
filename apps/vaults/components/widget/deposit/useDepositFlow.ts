import { useDirectDeposit } from '@vaults/hooks/actions/useDirectDeposit'
import { useDirectStake } from '@vaults/hooks/actions/useDirectStake'
import { useEnsoDeposit } from '@vaults/hooks/actions/useEnsoDeposit'
import { useMemo } from 'react'
import type { Address } from 'viem'
import type { DepositRouteType } from './types'
import { useDepositRoute } from './useDepositRoute'

interface UseDepositFlowProps {
  // Token addresses
  depositToken: Address
  assetAddress: Address
  destinationToken: Address
  vaultAddress: Address
  stakingAddress?: Address
  // Amount
  amount: bigint
  currentAmount: bigint // For checking if input > 0
  // Account & chain
  account?: Address
  chainId: number
  sourceChainId: number
  destinationChainId?: number
  // Decimals
  inputDecimals: number
  vaultDecimals: number
  // Settings
  slippage: number
  stakingSource?: string
}

export interface DepositFlowResult {
  routeType: DepositRouteType
  activeFlow: {
    actions: {
      prepareApprove: ReturnType<typeof useDirectDeposit>['actions']['prepareApprove']
      prepareDeposit: ReturnType<typeof useDirectDeposit>['actions']['prepareDeposit']
    }
    periphery: {
      prepareApproveEnabled: boolean
      prepareDepositEnabled: boolean
      isAllowanceSufficient: boolean
      expectedOut: bigint
      isLoadingRoute: boolean
      isCrossChain: boolean
      routerAddress?: string
      error?: unknown
    }
  }
}

export const useDepositFlow = ({
  depositToken,
  assetAddress,
  destinationToken,
  vaultAddress,
  stakingAddress,
  amount,
  currentAmount,
  account,
  chainId,
  sourceChainId,
  destinationChainId,
  inputDecimals,
  vaultDecimals,
  slippage,
  stakingSource
}: UseDepositFlowProps): DepositFlowResult => {
  // Determine routing type
  const routeType = useDepositRoute({
    depositToken,
    assetAddress,
    destinationToken,
    vaultAddress,
    stakingAddress
  })

  // Direct deposit flow (asset → vault)
  const directDeposit = useDirectDeposit({
    vaultAddress,
    assetAddress,
    amount,
    account,
    chainId,
    decimals: inputDecimals,
    enabled: routeType === 'DIRECT_DEPOSIT' && amount > 0n
  })

  // Direct stake flow (vault → staking)
  const directStake = useDirectStake({
    stakingAddress,
    vaultAddress,
    amount,
    account,
    chainId,
    decimals: vaultDecimals,
    stakingSource,
    enabled: routeType === 'DIRECT_STAKE' && amount > 0n
  })

  // Enso flow (zaps, cross-chain, etc.)
  const ensoFlow = useEnsoDeposit({
    vaultAddress: destinationToken,
    depositToken,
    amount,
    currentAmount,
    account,
    chainId: sourceChainId,
    destinationChainId,
    decimalsOut: vaultDecimals,
    enabled: routeType === 'ENSO' && !!depositToken && amount > 0n && currentAmount > 0n,
    slippage: slippage * 100
  })

  // Select active flow based on routing type
  const activeFlow = useMemo(() => {
    if (routeType === 'DIRECT_DEPOSIT') return directDeposit
    if (routeType === 'DIRECT_STAKE') return directStake
    return ensoFlow
  }, [routeType, directDeposit, directStake, ensoFlow])

  return {
    routeType,
    activeFlow
  }
}
