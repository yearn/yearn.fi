import { gaugeV2Abi } from '@lib/contracts/abi/gaugeV2.abi'
import { toNormalizedBN, zeroNormalizedBN } from '@lib/utils'
import { useTokenBalance } from '@vaults/hooks/useTokenBalance'
import type { UseUnstakeReturn } from '@vaults/types'
import type { Address } from 'viem'
import { type UseSimulateContractReturnType, useSimulateContract } from 'wagmi'

interface Props {
  gaugeAddress: Address
  amount: bigint
  // Note 10-01-25: Current yearn logic uses vault decimal logic rather
  // than gauge decimal logic. So this keeps it in line with
  // that logic. Though it isn't necessarily the correct logic..
  decimals: number
  account?: Address
  chainId?: number
}

// ** Unstake Action for V2 & V3 ** //

export const useUnstake = ({ gaugeAddress, amount, account, decimals, chainId }: Props): UseUnstakeReturn => {
  const { balance: _balance } = useTokenBalance({
    token: gaugeAddress,
    watch: true,
    chainId
  })

  // Note 10-01-25: Adjustment here related to above note.
  const balance = _balance.raw > 0n ? toNormalizedBN(_balance.raw, decimals) : zeroNormalizedBN

  const isValidInput = balance.raw > 0n
  const prepareUnstakeEnabled = Boolean(isValidInput)

  const prepareUnstake: UseSimulateContractReturnType = useSimulateContract({
    abi: gaugeV2Abi,
    functionName: 'withdraw',
    args: account ? [amount, account, account, false] : undefined,
    address: gaugeAddress,
    account,
    chainId,
    query: { enabled: prepareUnstakeEnabled }
  })

  return {
    actions: {
      prepareUnstake
    },
    periphery: {
      prepareUnstakeEnabled,
      balance
    }
  }
}
