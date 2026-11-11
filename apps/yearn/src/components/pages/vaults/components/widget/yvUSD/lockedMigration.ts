import { buildRouterMigrationCalls } from '@pages/vaults/components/widget/migrate/routerMigrationCalls'
import { YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { erc4626Abi } from '@shared/contracts/abi/4626.abi'
import { ERC_4626_ROUTER_ABI } from '@shared/contracts/abi/erc4626Router.abi'
import { YEARN_4626_ROUTER } from '@shared/utils/constants'
import type { TransactionStep } from '@yearn/vault-widget/advanced'
import { type Address, encodeFunctionData, erc20Abi, isAddressEqual } from 'viem'

export function buildLockedMigrationBatch({
  account,
  router,
  assetAddress,
  destination,
  amount,
  allowance,
  chainId
}: {
  account?: Address
  router: Address
  assetAddress: Address
  destination: Address
  amount: bigint
  allowance: bigint
  chainId: number
}): TransactionStep['batch'] | undefined {
  if (!account || amount <= 0n || !isAddressEqual(router, YEARN_4626_ROUTER)) return undefined

  return {
    chainId,
    calls: [
      {
        to: YVUSD_LOCKED_ADDRESS,
        data: encodeFunctionData({
          abi: erc4626Abi,
          functionName: 'withdraw',
          args: [amount, account, account, 0n]
        })
      },
      ...(allowance < amount
        ? [
            {
              to: YVUSD_UNLOCKED_ADDRESS,
              data: encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [router, amount] })
            }
          ]
        : []),
      {
        to: router,
        data: encodeFunctionData({
          abi: ERC_4626_ROUTER_ABI,
          functionName: 'multicall',
          args: [
            buildRouterMigrationCalls({ assetAddress, vaultFrom: YVUSD_UNLOCKED_ADDRESS, vaultTo: destination, amount })
          ]
        })
      }
    ]
  }
}
