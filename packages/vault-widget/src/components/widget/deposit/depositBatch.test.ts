import { buildDepositBatch } from '@yearn/vault-widget/internal/components/widget/deposit/depositBatch'
import { vaultAbi } from '@yearn/vault-widget/internal/contracts/abi/vaultV2.abi'
import { yBoldZapperAbi } from '@yearn/vault-widget/internal/contracts/abi/yBoldZapper.abi'
import { getApproveAbi } from '@yearn/vault-widget/internal/utils/approve'
import { BOLD_ADDRESS, YBOLD_ZAPPER_ADDRESS } from '@yearn/vault-widget/internal/utils/yBold'
import { decodeFunctionData, getAddress } from 'viem'
import { describe, expect, it } from 'vitest'

const ACCOUNT = '0x1111111111111111111111111111111111111111'
const VAULT = '0x2222222222222222222222222222222222222222'

describe('buildDepositBatch', () => {
  it('resets a partial allowance before approval and a direct Yearn deposit', () => {
    const batch = buildDepositBatch({
      routeType: 'DIRECT_DEPOSIT',
      account: ACCOUNT,
      depositToken: BOLD_ADDRESS,
      amount: 10n,
      currentAllowance: 5n,
      chainId: 1,
      vaultAddress: VAULT,
      approvalSpenderAddress: VAULT
    })
    expect(batch?.calls).toHaveLength(3)
    expect(
      batch?.calls.slice(0, 2).map((call) => decodeFunctionData({ abi: getApproveAbi(BOLD_ADDRESS), data: call.data }))
    ).toEqual([
      { functionName: 'approve', args: [VAULT, 0n] },
      { functionName: 'approve', args: [VAULT, 10n] }
    ])
    expect(decodeFunctionData({ abi: vaultAbi, data: batch!.calls[2].data })).toEqual({
      functionName: 'deposit',
      args: [10n, ACCOUNT]
    })
  })

  it('does not batch an unready quote or an untrusted spender', () => {
    const params = {
      routeType: 'ENSO',
      account: ACCOUNT,
      depositToken: BOLD_ADDRESS,
      amount: 10n,
      chainId: 8453,
      vaultAddress: VAULT,
      approvalSpenderAddress: VAULT
    } as const
    expect(buildDepositBatch(params)).toBeUndefined()
    expect(
      buildDepositBatch({ ...params, routeType: 'DIRECT_DEPOSIT', approvalSpenderAddress: undefined })
    ).toBeUndefined()
  })

  it('builds one atomic approval and yBOLD zap-in batch', () => {
    const amount = 10n ** 18n
    const batch = buildDepositBatch({
      routeType: 'YBOLD_ZAPPER',
      account: ACCOUNT,
      depositToken: BOLD_ADDRESS,
      amount,
      chainId: 1,
      vaultAddress: VAULT,
      approvalSpenderAddress: YBOLD_ZAPPER_ADDRESS
    })

    expect(batch?.chainId).toBe(1)
    expect(batch?.calls).toHaveLength(2)
    expect(batch?.calls[0]?.to).toBe(BOLD_ADDRESS)
    expect(
      decodeFunctionData({
        abi: getApproveAbi(BOLD_ADDRESS),
        data: batch?.calls[0]?.data ?? '0x'
      })
    ).toMatchObject({ functionName: 'approve', args: [getAddress(YBOLD_ZAPPER_ADDRESS), amount] })
    expect(batch?.calls[1]?.to).toBe(YBOLD_ZAPPER_ADDRESS)
    expect(
      decodeFunctionData({
        abi: yBoldZapperAbi,
        data: batch?.calls[1]?.data ?? '0x'
      })
    ).toMatchObject({ functionName: 'zapIn', args: [amount, ACCOUNT] })
  })
})
