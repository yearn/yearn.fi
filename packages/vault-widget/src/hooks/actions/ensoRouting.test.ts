// @vitest-environment jsdom

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEnsoDeposit } from './useEnsoDeposit'
import { useEnsoWithdraw } from './useEnsoWithdraw'

const { useSolverEnsoMock } = vi.hoisted(() => ({ useSolverEnsoMock: vi.fn() }))

vi.mock('../solvers/useSolverEnso', () => ({
  useSolverEnso: useSolverEnsoMock
}))

vi.mock('../useEnsoOrder', () => ({
  useEnsoOrder: vi.fn(() => ({ prepareEnsoOrder: {} }))
}))

const VAULT = '0x0000000000000000000000000000000000000001'
const TOKEN = '0x0000000000000000000000000000000000000002'
const ACCOUNT = '0x0000000000000000000000000000000000000003'

beforeEach(() => {
  useSolverEnsoMock.mockReturnValue({
    actions: { prepareApprove: {} },
    periphery: {
      prepareApproveEnabled: false,
      expectedOut: { raw: 0n },
      minExpectedOut: { raw: 0n },
      priceImpact: undefined,
      allowance: 0n,
      route: undefined,
      routeHasSwap: false,
      bridgeProtocol: undefined,
      error: undefined,
      isLoadingRoute: false,
      isCrossChain: false,
      routerAddress: undefined,
      approvalSpenderAddress: undefined,
      approvalWarning: undefined,
      refetchAllowance: vi.fn()
    },
    methods: {
      getRoute: vi.fn(),
      getEnsoTransaction: vi.fn(),
      resetRoute: vi.fn()
    }
  })
})

describe('vault Enso routing', () => {
  it('always requests router execution for deposits', () => {
    renderHook(() =>
      useEnsoDeposit({
        vaultAddress: VAULT,
        depositToken: TOKEN,
        amount: 1n,
        account: ACCOUNT,
        chainId: 1,
        decimalsOut: 18,
        enabled: true
      })
    )

    expect(useSolverEnsoMock).toHaveBeenCalledWith(expect.objectContaining({ routingStrategy: 'router' }))
  })

  it('always requests router execution for withdrawals', () => {
    renderHook(() =>
      useEnsoWithdraw({
        vaultAddress: VAULT,
        withdrawToken: TOKEN,
        amount: 1n,
        account: ACCOUNT,
        chainId: 1,
        decimalsOut: 6,
        enabled: true
      })
    )

    expect(useSolverEnsoMock).toHaveBeenCalledWith(expect.objectContaining({ routingStrategy: 'router' }))
  })
})
