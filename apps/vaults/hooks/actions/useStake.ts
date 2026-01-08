import { gaugeV2Abi } from '@lib/contracts/abi/gaugeV2.abi'
import { toNormalizedBN, zeroNormalizedBN } from '@lib/utils'
import { useTokenBalance } from '@vaults/hooks/useTokenBalance'
import type { UseStakeReturn } from '@vaults/types'
import { type Address, erc20Abi } from 'viem'
import { type UseSimulateContractReturnType, useReadContract, useSimulateContract } from 'wagmi'
import { useTokenAllowance } from '../useTokenAllowance'

interface Props {
  vaultAddress: Address
  gaugeAddress: Address
  amount: bigint
  account?: Address
  chainId?: number
}

// ** Stake Action for V2 & V3 ** //

export const useStake = ({ vaultAddress, gaugeAddress, amount, account, chainId }: Props): UseStakeReturn => {
  const { allowance: depositAllowance = 0n } = useTokenAllowance({
    account,
    token: vaultAddress,
    spender: gaugeAddress,
    watch: true,
    chainId
  })

  const { balance } = useTokenBalance({
    token: vaultAddress,
    watch: true,
    chainId
  })

  const isValidInput = amount > 0n
  const isStakeAllowanceSufficient = Boolean(depositAllowance >= amount)
  const prepareApproveEnabled = Boolean(!isStakeAllowanceSufficient && isValidInput)
  const prepareStakeEnabled = Boolean(isStakeAllowanceSufficient && isValidInput)

  const { data: expectedStakeAmount = zeroNormalizedBN } = useReadContract({
    abi: gaugeV2Abi,
    functionName: 'previewDeposit',
    address: gaugeAddress,
    args: [amount],
    chainId,
    query: { enabled: amount > 0n, select: (data) => toNormalizedBN(data, balance.decimals) }
  })

  const prepareApprove: UseSimulateContractReturnType = useSimulateContract({
    abi: erc20Abi,
    functionName: 'approve',
    address: vaultAddress,
    args: amount > 0n && vaultAddress ? [gaugeAddress, amount] : undefined,
    chainId,
    query: { enabled: prepareApproveEnabled }
  })

  const prepareStake: UseSimulateContractReturnType = useSimulateContract({
    abi: gaugeV2Abi,
    functionName: 'deposit',
    address: gaugeAddress,
    args: [amount],
    account,
    chainId,
    query: { enabled: prepareStakeEnabled }
  })

  return {
    actions: {
      prepareApprove,
      prepareStake
    },
    periphery: {
      prepareApproveEnabled,
      prepareStakeEnabled,
      balance,
      expectedStakeAmount
    }
  }
}
