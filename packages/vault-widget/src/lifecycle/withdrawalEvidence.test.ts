import { getUnstakedShares } from '@yearn/vault-widget/lifecycle/withdrawalEvidence'
import { encodeAbiParameters, encodeEventTopics, erc20Abi, type TransactionReceipt } from 'viem'
import { describe, expect, it } from 'vitest'

const owner = '0x1111111111111111111111111111111111111111'
const staking = '0x2222222222222222222222222222222222222222'
const token = '0x3333333333333333333333333333333333333333'
const unrelated = '0x4444444444444444444444444444444444444444'
const transfer = (
  amount: bigint,
  from: `0x${string}` = staking,
  to: `0x${string}` = owner,
  address: `0x${string}` = token
) => ({
  address,
  topics: encodeEventTopics({ abi: erc20Abi, eventName: 'Transfer', args: { from, to } }),
  data: encodeAbiParameters([{ type: 'uint256' }], [amount])
})
const receipt = (logs: unknown[], status = 'success') => ({ status, logs }) as TransactionReceipt

describe('receipt-derived unstaked shares', () => {
  it('uses only shares delivered by this staking contract to the reviewed owner', () => {
    const evidence = receipt([
      transfer(10n),
      transfer(5n),
      transfer(100n, unrelated),
      transfer(200n, staking, unrelated),
      transfer(300n, staking, owner, unrelated)
    ])
    expect(getUnstakedShares(evidence, token, staking, owner)).toBe(15n)
  })
  it.each([receipt([]), receipt([transfer(10n)], 'reverted'), receipt([transfer(10n, unrelated)])])(
    'blocks continuation when attributable shares cannot be established',
    (evidence) => {
      expect(() => getUnstakedShares(evidence, token, staking, owner)).toThrow()
    }
  )
})
