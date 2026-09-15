import { describe, expect, it } from 'vitest'
import { resolveEnsoWithdrawInputAmount } from './ensoWithdrawAmount'

const REQUIRED_YBOLD_SHARES = 10_168_306_000_000_000_000_000n
const REQUIRED_YSYBOLD_SHARES = 9_299_143_930_971_368_556_523n

describe('resolveEnsoWithdrawInputAmount', () => {
  it('uses previewWithdraw shares for a partial withdrawal from an ERC4626 staking wrapper', () => {
    expect(
      resolveEnsoWithdrawInputAmount({
        requiredVaultShares: REQUIRED_YBOLD_SHARES,
        isStakingWithdrawal: true,
        isMaxWithdraw: false,
        stakingRedeemableShares: 9_299_163_876_199_989_934_889n,
        previewWithdrawShares: REQUIRED_YSYBOLD_SHARES,
        previewFailed: false,
        allowOneToOneFallback: false
      })
    ).toBe(REQUIRED_YSYBOLD_SHARES)
  })

  it('uses the exact redeemable staking share balance for a max withdrawal', () => {
    const maxRedeemShares = 9_299_163_876_199_989_934_889n
    expect(
      resolveEnsoWithdrawInputAmount({
        requiredVaultShares: REQUIRED_YBOLD_SHARES,
        isStakingWithdrawal: true,
        isMaxWithdraw: true,
        stakingRedeemableShares: maxRedeemShares,
        previewFailed: false,
        allowOneToOneFallback: false
      })
    ).toBe(maxRedeemShares)
  })

  it('preserves vault-share amounts when the withdrawal source is not staking', () => {
    expect(
      resolveEnsoWithdrawInputAmount({
        requiredVaultShares: REQUIRED_YBOLD_SHARES,
        isStakingWithdrawal: false,
        isMaxWithdraw: false,
        stakingRedeemableShares: 0n,
        previewFailed: false,
        allowOneToOneFallback: false
      })
    ).toBe(REQUIRED_YBOLD_SHARES)
  })

  it('falls back to one-to-one only for legacy staking adapters', () => {
    expect(
      resolveEnsoWithdrawInputAmount({
        requiredVaultShares: REQUIRED_YBOLD_SHARES,
        isStakingWithdrawal: true,
        isMaxWithdraw: false,
        stakingRedeemableShares: 0n,
        previewFailed: true,
        allowOneToOneFallback: true
      })
    ).toBe(REQUIRED_YBOLD_SHARES)
  })

  it('fails closed while a mapped staking share preview is unavailable', () => {
    expect(
      resolveEnsoWithdrawInputAmount({
        requiredVaultShares: REQUIRED_YBOLD_SHARES,
        isStakingWithdrawal: true,
        isMaxWithdraw: false,
        stakingRedeemableShares: 0n,
        previewFailed: true,
        allowOneToOneFallback: false
      })
    ).toBe(0n)
  })
})
