import { erc4626Abi } from '@lib/utils/abi/4626.abi'
import { vaultAbi as _vaultAbi } from '@lib/utils/abi/vaultV2.abi'
import type { UseWithdrawReturn } from '@nextgen/types'
import { type Abi, type Address, zeroAddress } from 'viem'
import { type UseSimulateContractReturnType, useSimulateContract } from 'wagmi'

interface Props {
  vaultType: 'v2' | 'v3'
  vaultAddress: Address
  amount: bigint
  account: Address
}

// ** Withdraw Action for V2 & V3 ** //

export const useWithdraw = ({ vaultType, vaultAddress, amount, account }: Props): UseWithdrawReturn => {
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
      prepareWithdrawEnabled
    }
  }
}
