import { YGAUGE_ZAP_ABI } from '@lib/contracts/abi/yGaugeZap.abi'
import { YGAUGES_ZAP_ADDRESS } from '@lib/utils/constants'
import type { Address } from 'viem'
import { erc20Abi } from 'viem'
import { type UseSimulateContractReturnType, useSimulateContract } from 'wagmi'
import { useTokenAllowance } from '../useTokenAllowance'

interface UseGaugeStakingBoosterProps {
  vaultAddress: Address
  gaugeAddress: Address
  tokenAddress: Address
  amount: bigint
  account?: Address
  chainId?: number
  vaultVersion?: string
  enabled?: boolean
}

interface UseGaugeStakingBoosterReturn {
  actions: {
    prepareApprove: UseSimulateContractReturnType
    prepareZapIn: UseSimulateContractReturnType
  }
  periphery: {
    prepareApproveEnabled: boolean
    prepareZapInEnabled: boolean
    allowance: bigint
    isLoadingAllowance: boolean
  }
}

export const useSolverGaugeStakingBooster = ({
  vaultAddress,
  gaugeAddress,
  tokenAddress,
  amount,
  account,
  chainId,
  vaultVersion,
  enabled = true
}: UseGaugeStakingBoosterProps): UseGaugeStakingBoosterReturn => {
  const { allowance = 0n, isLoading: isLoadingAllowance } = useTokenAllowance({
    account,
    token: tokenAddress,
    spender: YGAUGES_ZAP_ADDRESS,
    watch: true,
    chainId
  })

  const isValidInput = amount > 0n
  const isAllowanceSufficient = allowance >= amount
  const prepareApproveEnabled = !isAllowanceSufficient && isValidInput && enabled
  const prepareZapInEnabled = isAllowanceSufficient && isValidInput && enabled

  const prepareApprove: UseSimulateContractReturnType = useSimulateContract({
    abi: erc20Abi,
    functionName: 'approve',
    address: tokenAddress,
    args: [YGAUGES_ZAP_ADDRESS, amount],
    chainId,
    query: { enabled: prepareApproveEnabled }
  })

  // Determine function name based on vault version
  const functionName = vaultVersion?.startsWith('3') || vaultVersion?.startsWith('~3') ? 'zapIn' : 'zapInLegacy'

  const prepareZapIn: UseSimulateContractReturnType = useSimulateContract({
    abi: YGAUGE_ZAP_ABI,
    functionName,
    address: YGAUGES_ZAP_ADDRESS,
    args: [vaultAddress, amount, gaugeAddress],
    account,
    chainId,
    query: { enabled: prepareZapInEnabled }
  })

  return {
    actions: {
      prepareApprove,
      prepareZapIn
    },
    periphery: {
      prepareApproveEnabled,
      prepareZapInEnabled,
      allowance,
      isLoadingAllowance
    }
  }
}
