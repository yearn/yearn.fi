import { ERC_4626_ROUTER_ABI } from '@shared/contracts/abi/erc4626Router.abi'
import { type Address, encodeFunctionData, maxUint256 } from 'viem'

export function buildRouterMigrationCalls({
  assetAddress,
  vaultFrom,
  vaultTo,
  amount,
  functionName = 'migrate'
}: {
  assetAddress: Address
  vaultFrom: Address
  vaultTo: Address
  amount: bigint
  functionName?: 'migrate' | 'migrateFromV2'
}): `0x${string}`[] {
  return [
    encodeFunctionData({
      abi: ERC_4626_ROUTER_ABI,
      functionName: 'approve',
      args: [assetAddress, vaultTo, maxUint256]
    }),
    encodeFunctionData({ abi: ERC_4626_ROUTER_ABI, functionName, args: [vaultFrom, vaultTo, amount, 0n] })
  ]
}
