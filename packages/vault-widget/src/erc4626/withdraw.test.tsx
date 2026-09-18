// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { useErc4626WithdrawQuote } from '@yearn/vault-widget/erc4626/useErc4626WithdrawQuote'
import { useDirectWithdraw } from '@yearn/vault-widget/internal/hooks/actions/useDirectWithdraw'
import { useReadContract, useSimulateContract } from '@yearn/vault-widget/internal/hooks/useAppWagmi'
import { getContractTransactionRequest } from '@yearn/vault-widget/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@yearn/vault-widget/internal/hooks/useAppWagmi', () => ({
  useReadContract: vi.fn(),
  useSimulateContract: vi.fn()
}))
const address = '0x0000000000000000000000000000000000000001'
const account = '0x0000000000000000000000000000000000000002'
const limits = { maxDeposit: 9n, maxWithdraw: 3_900_000n, maxRedeem: 2n * 10n ** 18n, redeemableAssets: 3_900_000n }
const readMock = vi.mocked(useReadContract)
const simulate = vi.mocked(useSimulateContract)
beforeEach(() => {
  vi.clearAllMocks()
  readMock.mockReturnValue({ data: 777n, isError: false, isPending: false, isFetching: false } as never)
  simulate.mockImplementation(
    (request) =>
      ({
        data: { request },
        isSuccess: true,
        isError: false,
        isLoading: false,
        isFetching: false,
        status: 'success'
      }) as never
  )
})
describe('generic withdrawal preparation', () => {
  it('uses previewWithdraw fee-inclusive shares for a partial asset withdrawal even with no PPS', () => {
    const { result } = renderHook(() => {
      const preview = useErc4626WithdrawQuote({ address, chainId: 1, amount: 100n, limits, enabled: true })
      return useDirectWithdraw({
        vaultAddress: address,
        amount: 100n,
        account,
        chainId: 1,
        enabled: true,
        pricePerShare: 0n,
        vaultDecimals: 18,
        useErc4626: true,
        standardQuote: preview.quote
      })
    })
    expect(readMock.mock.calls[0][0]).toMatchObject({ functionName: 'previewWithdraw', args: [100n] })
    expect(getContractTransactionRequest(result.current.actions.prepareWithdraw)).toMatchObject({
      functionName: 'withdraw',
      args: [100n, account, account]
    })
    expect(result.current.periphery.expectedOut).toBe(100n)
  })
  it('redeems the contract-capped shares for MAX instead of all wallet shares', () => {
    readMock.mockReturnValue({ data: 3_900_000n, isError: false, isPending: false, isFetching: false } as never)
    const { result } = renderHook(() => {
      const preview = useErc4626WithdrawQuote({
        address,
        chainId: 1,
        amount: limits.maxWithdraw,
        limits,
        enabled: true
      })
      return useDirectWithdraw({
        vaultAddress: address,
        amount: limits.maxWithdraw,
        maxShares: limits.maxRedeem,
        redeemAll: preview.quote?.redeem,
        account,
        chainId: 1,
        enabled: true,
        pricePerShare: 0n,
        vaultDecimals: 18,
        useErc4626: true,
        standardQuote: preview.quote
      })
    })
    expect(getContractTransactionRequest(result.current.actions.prepareWithdraw)).toMatchObject({
      functionName: 'redeem',
      args: [limits.maxRedeem, account, account]
    })
    expect(result.current.periphery.expectedOut).toBe(3_900_000n)
  })
  it('uses withdraw when maxRedeem proceeds differ from the asset limit', () => {
    renderHook(() =>
      useErc4626WithdrawQuote({
        address,
        chainId: 1,
        amount: 2_000_000n,
        limits: { ...limits, maxWithdraw: 2_000_000n },
        enabled: true
      })
    )
    expect(readMock.mock.calls[0][0]).toMatchObject({ functionName: 'previewWithdraw', args: [2_000_000n] })
  })
  it.each([0n, 4_000_000n])('does not produce a usable quote for out-of-range input %s', (amount) => {
    const { result } = renderHook(() => useErc4626WithdrawQuote({ address, chainId: 1, amount, limits, enabled: true }))
    expect(result.current.quote).toBeUndefined()
    expect(readMock.mock.calls[0][0].query?.enabled).toBe(false)
  })
  it('drops cached data when the preview fails', () => {
    readMock.mockReturnValue({ data: 777n, isError: true } as never)
    const { result } = renderHook(() =>
      useErc4626WithdrawQuote({ address, chainId: 1, amount: 100n, limits, enabled: true })
    )
    expect(result.current.quote).toBeUndefined()
    expect(result.current.error).toContain('Unable to preview')
  })
  it('preserves Yearn V2 share-denominated withdrawals', () => {
    const { result } = renderHook(() =>
      useDirectWithdraw({
        vaultAddress: address,
        amount: 100n,
        account,
        chainId: 1,
        enabled: true,
        pricePerShare: 2n,
        vaultDecimals: 0,
        useErc4626: false
      })
    )
    expect(getContractTransactionRequest(result.current.actions.prepareWithdraw)).toMatchObject({
      functionName: 'withdraw',
      args: [50n, account]
    })
  })
})
