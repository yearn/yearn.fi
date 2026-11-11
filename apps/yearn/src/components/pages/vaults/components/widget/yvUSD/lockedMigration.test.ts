import { buildLockedMigrationBatch } from '@pages/vaults/components/widget/yvUSD/lockedMigration'
import { YVUSD_TRANCHE_DEPLOYMENT } from '@pages/vaults/constants/tranchedProducts'
import { YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { erc4626Abi } from '@shared/contracts/abi/4626.abi'
import { ERC_4626_ROUTER_ABI } from '@shared/contracts/abi/erc4626Router.abi'
import { YEARN_4626_ROUTER } from '@shared/utils/constants'
import { decodeFunctionData, erc20Abi, maxUint256 } from 'viem'
import { describe, expect, it } from 'vitest'

const params = {
  account: '0x1111111111111111111111111111111111111111' as const,
  router: YEARN_4626_ROUTER,
  assetAddress: YVUSD_TRANCHE_DEPLOYMENT.asset,
  destination: YVUSD_TRANCHE_DEPLOYMENT.tranches.fixed,
  amount: 500n,
  allowance: 0n,
  chainId: 1
}

describe('locked yvUSD atomic migration', () => {
  it('unlocks an exact amount with zero loss, approves it, then migrates exactly that amount', () => {
    const batch = buildLockedMigrationBatch(params)!
    expect(batch.calls[0].to).toBe(YVUSD_LOCKED_ADDRESS)
    expect(decodeFunctionData({ abi: erc4626Abi, data: batch.calls[0].data })).toMatchObject({
      functionName: 'withdraw',
      args: [500n, params.account, params.account, 0n]
    })
    expect(decodeFunctionData({ abi: erc20Abi, data: batch.calls[1].data })).toMatchObject({
      functionName: 'approve',
      args: [YEARN_4626_ROUTER, 500n]
    })
    const routerCall = decodeFunctionData({ abi: ERC_4626_ROUTER_ABI, data: batch.calls[2].data })
    expect(routerCall.functionName).toBe('multicall')
    const calls = routerCall.args![0] as readonly `0x${string}`[]
    expect(decodeFunctionData({ abi: ERC_4626_ROUTER_ABI, data: calls[0] })).toMatchObject({
      functionName: 'approve',
      args: [params.assetAddress, params.destination, maxUint256]
    })
    expect(decodeFunctionData({ abi: ERC_4626_ROUTER_ABI, data: calls[1] })).toMatchObject({
      functionName: 'migrate',
      args: [YVUSD_UNLOCKED_ADDRESS, params.destination, 500n, 0n]
    })
  })

  it('skips an existing sufficient approval', () => {
    expect(buildLockedMigrationBatch({ ...params, allowance: 500n })?.calls).toHaveLength(2)
  })

  it('only batches a supported router and a positive amount for a connected wallet', () => {
    expect(buildLockedMigrationBatch({ ...params, router: params.account })).toBeUndefined()
    expect(buildLockedMigrationBatch({ ...params, account: undefined })).toBeUndefined()
    expect(buildLockedMigrationBatch({ ...params, amount: 0n })).toBeUndefined()
  })
})
