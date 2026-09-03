import { buildDepositBatch } from '@yearn/vault-widget/internal/components/widget/deposit/safeDepositBatch'
import { yBoldZapperAbi } from '@yearn/vault-widget/internal/contracts/abi/yBoldZapper.abi'
import { getApproveAbi } from '@yearn/vault-widget/internal/utils/approve'
import { BOLD_ADDRESS, YBOLD_ZAPPER_ADDRESS } from '@yearn/vault-widget/internal/utils/yBold'
import { decodeFunctionData, getAddress } from 'viem'
import { describe, expect, it } from 'vitest'

const ACCOUNT = '0x1111111111111111111111111111111111111111'
const VAULT = '0x2222222222222222222222222222222222222222'

describe('buildDepositBatch', () => {
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
