// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { useDirectDeposit } from '@yearn/vault-widget/internal/hooks/actions/useDirectDeposit'
import { useDirectWithdraw } from '@yearn/vault-widget/internal/hooks/actions/useDirectWithdraw'
import { getContractTransactionRequest } from '@yearn/vault-widget/types'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ read: vi.fn(), simulate: vi.fn() }))
vi.mock('@yearn/vault-widget/internal/hooks/useAppWagmi', () => ({
  useReadContract: mocks.read,
  useSimulateContract: mocks.simulate
}))
vi.mock('../useTokenAllowance', () => ({ useTokenAllowance: () => ({ allowance: 100_000_000n, refetch: vi.fn() }) }))
const vaultAddress = '0x1111111111111111111111111111111111111111'
const assetAddress = '0x2222222222222222222222222222222222222222'
const account = '0x3333333333333333333333333333333333333333'
beforeEach(() => {
  vi.clearAllMocks()
  mocks.read.mockReturnValue({ data: 4n, isError: false, isFetching: false })
  mocks.simulate.mockImplementation((options) => ({
    data: options.query.enabled ? { request: { functionName: options.functionName, args: options.args } } : undefined,
    isSuccess: options.query.enabled
  }))
})
it('quotes factory deposits from PPS, respects capacity, and prepares the shared deposit call', () => {
  const { result, rerender } = renderHook(
    ({ amount }) =>
      useDirectDeposit({
        vaultAddress,
        assetAddress,
        account,
        chainId: 1,
        decimals: 6,
        vaultDecimals: 18,
        enabled: true,
        amount,
        maxDeposit: 10_000_000n,
        yearnV2PricePerShare: 2_000_000n
      }),
    { initialProps: { amount: 4_000_000n } }
  )
  expect(result.current.periphery.expectedOut).toBe(2n * 10n ** 18n)
  expect(getContractTransactionRequest(result.current.actions.prepareDeposit)).toMatchObject({
    functionName: 'deposit',
    args: [4_000_000n, account]
  })
  expect(mocks.read.mock.calls[0][0].query.enabled).toBe(false)
  rerender({ amount: 11_000_000n })
  expect(result.current.periphery.prepareDepositEnabled).toBe(false)
})
it('withdraws factory shares using the two-argument V2 call, including MAX', () => {
  const { result, rerender } = renderHook(
    ({ redeemAll }) =>
      useDirectWithdraw({
        vaultAddress,
        account,
        chainId: 1,
        vaultDecimals: 18,
        amount: 3_000_001n,
        pricePerShare: 2_000_000n,
        maxShares: 5n * 10n ** 18n,
        enabled: true,
        useErc4626: false,
        redeemAll
      }),
    { initialProps: { redeemAll: false } }
  )
  expect(getContractTransactionRequest(result.current.actions.prepareWithdraw)).toMatchObject({
    functionName: 'withdraw',
    args: [1_500_000_500_000_000_000n, account]
  })
  rerender({ redeemAll: true })
  expect(getContractTransactionRequest(result.current.actions.prepareWithdraw)).toMatchObject({
    functionName: 'withdraw',
    args: [5n * 10n ** 18n, account]
  })
  expect(result.current.periphery.expectedOut).toBe(10_000_000n)
})
