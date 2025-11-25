import type { UseWidgetFlowReturn } from '@nextgen/types'
import { STAKING_REWARDS_ABI } from '@vaults-v2/utils/abi/stakingRewards.abi'
import { VEYFI_GAUGE_ABI } from '@vaults-v2/utils/abi/veYFIGauge.abi'
import { TOKENIZED_STRATEGY_ABI } from '@vaults-v3/utils/abi/tokenizedStrategy.abi'
import type { Address } from 'viem'
import { erc20Abi } from 'viem'
import { type UseSimulateContractReturnType, useReadContract, useSimulateContract } from 'wagmi'
import { useTokenAllowance } from '../useTokenAllowance'

interface UseDirectStakeParams {
  stakingAddress?: Address
  vaultAddress: Address
  amount: bigint
  account?: Address
  chainId: number
  decimals: number
  stakingSource?: string // 'VeYFI' | 'yBOLD' | undefined (default)
  enabled: boolean
}

export function useDirectStake(params: UseDirectStakeParams): UseWidgetFlowReturn {
  // Check current allowance (vault tokens → staking contract)
  const { allowance = 0n } = useTokenAllowance({
    account: params.account,
    token: params.vaultAddress,
    spender: params.stakingAddress,
    watch: true,
    chainId: params.chainId
  })

  // Fetch expected stake amount based on staking type
  // For VeYFI: use previewDeposit
  const { data: veYFIExpectedAmount = 0n } = useReadContract({
    address: params.stakingAddress,
    abi: VEYFI_GAUGE_ABI,
    functionName: 'previewDeposit',
    args: [params.amount],
    chainId: params.chainId,
    query: {
      enabled: params.enabled && params.stakingSource === 'VeYFI' && params.amount > 0n && !!params.stakingAddress
    }
  })

  // For yBOLD: use previewDeposit
  const { data: yBOLDExpectedAmount = 0n } = useReadContract({
    address: params.stakingAddress,
    abi: TOKENIZED_STRATEGY_ABI,
    functionName: 'previewDeposit',
    args: [params.amount],
    chainId: params.chainId,
    query: {
      enabled: params.enabled && params.stakingSource === 'yBOLD' && params.amount > 0n && !!params.stakingAddress
    }
  })

  // Calculate expected stake amount based on staking source
  const expectedOut = (() => {
    switch (params.stakingSource) {
      case 'VeYFI':
        return veYFIExpectedAmount
      case 'yBOLD':
        return yBOLDExpectedAmount
      default:
        // 1:1 for default staking
        return params.amount
    }
  })()

  const isValidInput = params.amount > 0n && !!params.stakingAddress
  const isAllowanceSufficient = allowance >= params.amount
  const prepareApproveEnabled = !isAllowanceSufficient && isValidInput && !!params.account
  const prepareDepositEnabled = isAllowanceSufficient && isValidInput && !!params.account

  // Prepare approve transaction
  const prepareApprove: UseSimulateContractReturnType = useSimulateContract({
    abi: erc20Abi,
    functionName: 'approve',
    address: params.vaultAddress,
    args: params.amount > 0n && params.stakingAddress ? [params.stakingAddress, params.amount] : undefined,
    chainId: params.chainId,
    query: { enabled: prepareApproveEnabled }
  })

  // Prepare stake transaction (varies by staking source) - mapped to prepareDeposit for unified interface
  const { abi, functionName, args } = (() => {
    switch (params.stakingSource) {
      case 'VeYFI':
        return {
          abi: VEYFI_GAUGE_ABI,
          functionName: 'deposit' as const,
          args: [params.amount] as const
        }
      case 'yBOLD':
        return {
          abi: TOKENIZED_STRATEGY_ABI,
          functionName: 'deposit' as const,
          args: [params.amount, params.account] as const
        }
      default:
        // Default staking (OP Boost, V3 Staking, Juiced)
        return {
          abi: STAKING_REWARDS_ABI,
          functionName: 'stake' as const,
          args: [params.amount] as const
        }
    }
  })()

  const prepareDeposit: UseSimulateContractReturnType = useSimulateContract({
    abi,
    functionName,
    address: params.stakingAddress,
    args: args as [bigint, Address],
    account: params.account,
    chainId: params.chainId,
    query: { enabled: prepareDepositEnabled }
  })

  return {
    actions: {
      prepareApprove,
      prepareDeposit // Renamed from prepareStake for unified interface
    },
    periphery: {
      prepareApproveEnabled,
      prepareDepositEnabled, // Renamed from prepareStakeEnabled for unified interface
      isAllowanceSufficient,
      expectedOut, // Renamed from expectedStakeAmount for unified interface
      isLoadingRoute: false,
      isCrossChain: false,
      error: undefined
    }
  }
}
