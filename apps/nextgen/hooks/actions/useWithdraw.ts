import { erc4626Abi } from '@lib/utils/abi/4626.abi'
import { vaultAbi as _vaultAbi } from '@lib/utils/abi/vaultV2.abi'
import type { UseWithdrawReturn } from '@nextgen/types'
import { type Abi, type Address, zeroAddress } from 'viem'
import { type UseSimulateContractReturnType, useReadContracts, useSimulateContract } from 'wagmi'

interface Props {
  vaultType: 'v2' | 'v3'
  vaultAddress: Address
  amount: bigint
  account?: Address
}

// ** Withdraw Action for V2 & V3 ** //

export const useWithdraw = ({ vaultType, vaultAddress, amount, account }: Props): UseWithdrawReturn => {
  const { data: [expectedWithdrawAmount, balanceOf] = [0n, 0n] } = useReadContracts({
    contracts: [
      {
        abi: erc4626Abi,
        address: vaultAddress,
        functionName: 'previewWithdraw',
        args: [amount]
      },
      {
        abi: erc4626Abi,
        address: vaultAddress,
        functionName: 'balanceOf',
        args: account ? [account] : undefined
      }
    ],
    query: { select: (data) => [data[0]?.result ?? 0n, data[1]?.result ?? 0n], enabled: !!account }
  })

  console.log('vaultAddress, account', vaultAddress, account)

  const { abi, args, functionName } = (() => {
    if (vaultType === 'v2') {
      return {
        abi: _vaultAbi,
        functionName: 'withdraw',
        args: [amount, account, account] as [bigint, Address, Address]
      }
    }
    return {
      abi: erc4626Abi,
      functionName: 'withdraw',
      args: [amount, account, account] as [bigint, Address, Address]
    }
  })()

  const prepareWithdrawEnabled = Boolean(amount > 0n && vaultAddress !== zeroAddress)

  const prepareWithdraw: UseSimulateContractReturnType = useSimulateContract({
    abi: abi as Abi,
    functionName,
    address: vaultAddress,
    args,
    query: {
      enabled: prepareWithdrawEnabled
    }
  })

  return {
    actions: {
      prepareWithdraw
    },
    periphery: {
      prepareWithdrawEnabled,
      expectedWithdrawAmount,
      balanceOf
    }
  }
}
