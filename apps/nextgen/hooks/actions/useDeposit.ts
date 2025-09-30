import { erc4626Abi } from '@lib/utils/abi/4626.abi'
import { vaultAbi as _vaultAbi } from '@lib/utils/abi/vaultV2.abi'
import type { UseDepositReturn } from '@nextgen/types'
import { type Abi, type Address, erc20Abi } from 'viem'
import { type UseSimulateContractReturnType, useReadContracts, useSimulateContract } from 'wagmi'
import { useTokenAllowance } from '../useTokenAllowance'

interface Props {
  vaultType: 'v2' | 'v3'
  vaultAddress: Address
  assetAddress: Address
  amount: bigint
  account?: Address
}

// ** Deposit Action for V2 & V3 ** //

export const useDeposit = ({ vaultType, vaultAddress, assetAddress, amount, account }: Props): UseDepositReturn => {
  const { allowance: depositAllowance = 0n } = useTokenAllowance({
    account,
    token: assetAddress,
    spender: vaultAddress,
    watch: true
  })

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
  const isDepositAllowanceSufficient = Boolean(depositAllowance >= amount)
  const prepareApproveEnabled = Boolean(!isDepositAllowanceSufficient && isValidInput)
  const prepareDepositEnabled = Boolean(isDepositAllowanceSufficient && isValidInput)

  const { abi, args, functionName } = (() => {
    if (vaultType === 'v2') {
      return {
        abi: _vaultAbi,
        functionName: 'deposit',
        args: [amount, account] as [bigint, Address]
      }
    }
    return {
      abi: erc4626Abi,
      functionName: 'deposit',
      args: [amount]
    }
  })()

  const prepareApprove: UseSimulateContractReturnType = useSimulateContract({
    abi: erc20Abi,
    functionName: 'approve',
    address: vaultAddress,
    args: amount > 0n && vaultAddress ? [vaultAddress, amount] : undefined,
    query: { enabled: prepareApproveEnabled }
  })

  const prepareDeposit: UseSimulateContractReturnType = useSimulateContract({
    abi: abi as Abi,
    functionName,
    address: vaultAddress,
    args,
    account,
    query: { enabled: prepareDepositEnabled }
  })

  return {
    actions: {
      prepareApprove,
      prepareDeposit
    },
    periphery: {
      prepareApproveEnabled,
      prepareDepositEnabled,
      expectedDepositAmount,
      balanceOf
    }
  }
}
