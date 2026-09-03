import { buildWithdrawBatch } from '@yearn/vault-widget/internal/components/widget/withdraw/safeWithdrawBatch'
import { yBoldZapperAbi } from '@yearn/vault-widget/internal/contracts/abi/yBoldZapper.abi'
import { getApproveAbi } from '@yearn/vault-widget/internal/utils/approve'
import { YBOLD_ZAPPER_ADDRESS } from '@yearn/vault-widget/internal/utils/yBold'
import { decodeFunctionData, getAddress } from 'viem'
import { describe, expect, it } from 'vitest'

const ACCOUNT = '0x1111111111111111111111111111111111111111'
const STAKED_YBOLD = '0x23346B04a7f55b8760E5860AA5A77383D63491cD'

describe('buildWithdrawBatch', () => {
  it('builds one atomic approval and yBOLD zap-out batch', () => {
    const amount = 10n ** 18n
    const maxLoss = 50n
    const batch = buildWithdrawBatch({
      routeType: 'YBOLD_ZAPPER_WITHDRAW',
      account: ACCOUNT,
      sourceToken: STAKED_YBOLD,
      amount,
      chainId: 1,
      approvalSpenderAddress: YBOLD_ZAPPER_ADDRESS,
      maxLoss
    })

    expect(batch?.calls).toHaveLength(2)
    expect(
      decodeFunctionData({
        abi: getApproveAbi(STAKED_YBOLD),
        data: batch?.calls[0]?.data ?? '0x'
      })
    ).toMatchObject({ functionName: 'approve', args: [getAddress(YBOLD_ZAPPER_ADDRESS), amount] })
    expect(batch?.calls[1]?.to).toBe(YBOLD_ZAPPER_ADDRESS)
    expect(
      decodeFunctionData({
        abi: yBoldZapperAbi,
        data: batch?.calls[1]?.data ?? '0x'
      })
    ).toMatchObject({ functionName: 'zapOut', args: [amount, ACCOUNT, maxLoss] })
  })
})
