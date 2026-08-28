// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getEffectiveEnsoRequestSlippage, useSolverEnso } from './useSolverEnso'

const fetchMock = vi.fn()

vi.mock('@yearn/vault-widget/internal/hooks/useAppWagmi', () => ({
  useSimulateContract: vi.fn(() => ({}))
}))

vi.mock('../useTokenAllowance', () => ({
  useTokenAllowance: vi.fn(() => ({ allowance: 0n, isLoading: false, refetch: vi.fn(async () => undefined) }))
}))

const TOKEN_IN = '0x0000000000000000000000000000000000000001'
const TOKEN_OUT = '0x0000000000000000000000000000000000000002'
const ACCOUNT = '0x0000000000000000000000000000000000000003'

function createQueryWrapper(): ({ children }: { children: ReactNode }) => ReactElement {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children)
}

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
  ])(
    'sends $expectedSlippage bps for a $label',
    async ({ destinationChainId, requestedSlippage, expectedSlippage }) => {
      const { result } = renderHook(
        () =>
          useSolverEnso({
            tokenIn: TOKEN_IN,
            tokenOut: TOKEN_OUT,
            amountIn: 1n,
            fromAddress: ACCOUNT,
            chainId: 1,
            destinationChainId,
            slippage: requestedSlippage,
            quotePurpose: requestedSlippage === 0 ? 'calibration' : 'execution'
          }),
        { wrapper: createQueryWrapper() }
      )

      await act(async () => {
        await result.current.methods.getRoute()
      })

      const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]), 'http://localhost')
      expect(requestUrl.searchParams.get('slippage')).toBe(expectedSlippage)
    }
  )

  it('keeps calibration and execution quotes separate at the same effective slippage', async () => {
    const { rerender } = renderHook(
      ({ purpose, requestedSlippage }: { purpose: 'calibration' | 'execution'; requestedSlippage: number }) =>
        useSolverEnso({
          tokenIn: TOKEN_IN,
          tokenOut: TOKEN_OUT,
          amountIn: 1n,
          fromAddress: ACCOUNT,
          chainId: 1,
          destinationChainId: 8453,
          slippage: requestedSlippage,
          quotePurpose: purpose
        }),
      {
        initialProps: { purpose: 'calibration', requestedSlippage: 0 } as {
          purpose: 'calibration' | 'execution'
          requestedSlippage: number
        },
        wrapper: createQueryWrapper()
      }
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    rerender({ purpose: 'execution', requestedSlippage: 1 })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    expect(
      fetchMock.mock.calls.map(([url]) => new URL(String(url), 'http://localhost').searchParams.get('slippage'))
    ).toEqual(['1', '1'])
  })
})
