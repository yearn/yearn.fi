import { toNormalizedBN, zeroNormalizedBN } from '@lib/utils'
import { gaugeV2Abi } from '@lib/utils/abi/gaugeV2.abi'
import { useTokenBalance } from '@nextgen/hooks/useTokenBalance'
import type { UseUnstakeReturn } from '@nextgen/types'
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
}

// ** Unstake Action for V2 & V3 ** //

export const useUnstake = ({ gaugeAddress, amount, account, decimals }: Props): UseUnstakeReturn => {
  const { balance: _balance } = useTokenBalance({
    token: gaugeAddress,
    watch: true
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
