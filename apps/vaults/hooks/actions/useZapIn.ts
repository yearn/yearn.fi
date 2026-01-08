import { erc4626Abi } from '@lib/contracts/abi/4626.abi'
import { V3_REWARDS_ZAP_ABI } from '@lib/contracts/abi/V3RewardsZap.abi'
import { V3_STAKING_ZAP_ADDRESS } from '@lib/utils'
import type { Address } from 'viem'
import { type UseSimulateContractReturnType, useChainId, useReadContracts, useSimulateContract } from 'wagmi'

interface Props {
  vaultType: 'v2' | 'v3'
  vaultAddress: Address
  assetAddress: Address
  amount: bigint
  account?: Address
}

// ** ZapIn Action for V2 & V3 ** //

// PARTIAL - INCOMPLETE

export const useZapIn = ({ vaultAddress, assetAddress, amount, account }: Props): any => {
  const chainID = useChainId()

  const { data: [expectedDepositAmount, balanceOf] = [0n, 0n] } = useReadContracts({
    contracts: [
      {
        abi: erc4626Abi,
        address: vaultAddress,
        functionName: 'previewDeposit',
        args: [amount]
      },
      {
        abi: erc4626Abi,
        address: assetAddress,
        functionName: 'balanceOf',
        args: account ? [account] : undefined
      }
    ],
    query: { select: (data) => [data[0]?.result ?? 0n, data[1]?.result ?? 0n], enabled: !!account }
  })

  const isValidInput = amount > 0n
  const prepareDepositEnabled = Boolean(isValidInput)

  // Needs more
  const prepareDeposit: UseSimulateContractReturnType = useSimulateContract({
    abi: V3_REWARDS_ZAP_ABI,
    functionName: 'zapIn',
    address: chainID in V3_STAKING_ZAP_ADDRESS ? V3_STAKING_ZAP_ADDRESS[chainID] : undefined,
    args: [vaultAddress, amount, false],
    account,
    query: { enabled: prepareDepositEnabled }
  })

  return {
    actions: {
      prepareDeposit
    },
    periphery: {
      prepareDepositEnabled,
      expectedDepositAmount,
      balanceOf
    }
  }
}
