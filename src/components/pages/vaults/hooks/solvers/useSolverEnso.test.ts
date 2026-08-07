// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getEffectiveEnsoRequestSlippage, useSolverEnso } from './useSolverEnso'

const fetchMock = vi.fn()

vi.mock('@shared/hooks/useAppWagmi', () => ({
  useSimulateContract: vi.fn(() => ({}))
}))

vi.mock('../useTokenAllowance', () => ({
  useTokenAllowance: vi.fn(() => ({
    allowance: 0n,
    isLoading: false,
    refetch: vi.fn(async () => undefined)
  }))
}))

const TOKEN_IN = '0x0000000000000000000000000000000000000001'
const TOKEN_OUT = '0x0000000000000000000000000000000000000002'
const ACCOUNT = '0x0000000000000000000000000000000000000003'

beforeEach(() => {
  fetchMock.mockResolvedValue({
    status: 400,
    json: vi.fn(async () => ({ message: 'No route in request serialization test' }))
  })
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('getEffectiveEnsoRequestSlippage', () => {
  it('uses one basis point for a zero-slippage cross-chain request', () => {
    expect(getEffectiveEnsoRequestSlippage(0, true)).toBe(1)
  })

  it('keeps zero slippage for a same-chain request', () => {
    expect(getEffectiveEnsoRequestSlippage(0, false)).toBe(0)
  })

  it('keeps positive requested slippage unchanged', () => {
    expect(getEffectiveEnsoRequestSlippage(37, true)).toBe(37)
    expect(getEffectiveEnsoRequestSlippage(37, false)).toBe(37)
  })
})

describe('useSolverEnso request slippage', () => {
  it.each([
    { label: 'cross-chain calibration', destinationChainId: 8453, requestedSlippage: 0, expectedSlippage: '1' },
    { label: 'same-chain calibration', destinationChainId: 1, requestedSlippage: 0, expectedSlippage: '0' },
    { label: 'protected cross-chain quote', destinationChainId: 8453, requestedSlippage: 37, expectedSlippage: '37' }
  ])('sends $expectedSlippage bps for a $label', async ({
    destinationChainId,
    requestedSlippage,
    expectedSlippage
  }) => {
    const { result } = renderHook(() =>
      useSolverEnso({
        tokenIn: TOKEN_IN,
        tokenOut: TOKEN_OUT,
        amountIn: 1n,
        fromAddress: ACCOUNT,
        chainId: 1,
        destinationChainId,
        slippage: requestedSlippage
      })
    )

    await act(async () => {
      await result.current.methods.getRoute()
    })

    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]), 'http://localhost')
    expect(requestUrl.searchParams.get('slippage')).toBe(expectedSlippage)
  })
})
