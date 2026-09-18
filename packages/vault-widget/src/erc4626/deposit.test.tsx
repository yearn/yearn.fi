// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { useDirectDeposit } from '@yearn/vault-widget/internal/hooks/actions/useDirectDeposit'
import { useReadContract, useSimulateContract } from '@yearn/vault-widget/internal/hooks/useAppWagmi'
import { useTokenAllowance } from '@yearn/vault-widget/internal/hooks/useTokenAllowance'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@yearn/vault-widget/internal/hooks/useAppWagmi', () => ({
  useReadContract: vi.fn(),
  useSimulateContract: vi.fn()
}))
vi.mock('@yearn/vault-widget/internal/hooks/useTokenAllowance', () => ({ useTokenAllowance: vi.fn() }))
const params = {
  vaultAddress: '0x0000000000000000000000000000000000000001',
  assetAddress: '0x0000000000000000000000000000000000000002',
  account: '0x0000000000000000000000000000000000000003',
  chainId: 1,
  decimals: 6,
  amount: 1_000_000n,
  maxDeposit: 2_000_000n,
  enabled: true
} as const
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useTokenAllowance).mockReturnValue({ allowance: 2_000_000n } as never)
  vi.mocked(useReadContract).mockReturnValue({
    data: 499_000_000_000_000_000n,
    isError: false,
    isFetching: false
  } as never)
  vi.mocked(useSimulateContract).mockReturnValue({ isSuccess: true } as never)
})
describe('generic deposits', () => {
  it('submits asset units and shows fee-adjusted shares without any USD input', () => {
    const { result } = renderHook(() => useDirectDeposit(params))
    expect(result.current.periphery.prepareDepositEnabled).toBe(true)
    expect(result.current.periphery.expectedOut).toBe(499_000_000_000_000_000n)
    expect(vi.mocked(useSimulateContract).mock.calls[1][0]).toMatchObject({
      functionName: 'deposit',
      args: [1_000_000n, params.account],
      query: { enabled: true }
    })
  })
  it('approves only the entered asset amount when allowance is missing', () => {
    vi.mocked(useTokenAllowance).mockReturnValue({ allowance: 0n } as never)
    const { result } = renderHook(() => useDirectDeposit(params))
    expect(result.current.periphery.prepareApproveEnabled).toBe(true)
    expect(result.current.periphery.prepareDepositEnabled).toBe(false)
    expect(vi.mocked(useSimulateContract).mock.calls[0][0]).toMatchObject({
      functionName: 'approve',
      args: [params.vaultAddress, params.amount]
    })
  })
  it.each([{ maxDeposit: 0n }, { maxDeposit: 999_999n }, { enabled: false }])(
    'blocks both approval and deposit when capacity or flow is unavailable (case %#)',
    (override) => {
      vi.mocked(useTokenAllowance).mockReturnValue({ allowance: 0n } as never)
      const { result } = renderHook(() => useDirectDeposit({ ...params, ...override }))
      expect(result.current.periphery.prepareApproveEnabled).toBe(false)
      expect(result.current.periphery.prepareDepositEnabled).toBe(false)
    }
  )
  it('does not approve or deposit when the vault would mint zero shares', () => {
    vi.mocked(useReadContract).mockReturnValue({ data: 0n, isError: false, isFetching: false } as never)
    const { result } = renderHook(() => useDirectDeposit(params))
    expect(result.current.periphery.prepareDepositEnabled).toBe(false)
    expect(result.current.periphery.error).toContain('no shares')
  })
  it('blocks a failed preview even if cached shares are present', () => {
    vi.mocked(useReadContract).mockReturnValue({ data: 99n, isError: true, isFetching: false } as never)
    const { result } = renderHook(() => useDirectDeposit(params))
    expect(result.current.periphery.prepareDepositEnabled).toBe(false)
    expect(result.current.periphery.error).toContain('preview')
  })
})
