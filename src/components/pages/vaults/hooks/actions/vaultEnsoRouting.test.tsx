// @vitest-environment jsdom

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSolverEnso } from '../solvers/useSolverEnso'
import { useEnsoOrder } from '../useEnsoOrder'
import { useEnsoDeposit } from './useEnsoDeposit'
import { useEnsoWithdraw } from './useEnsoWithdraw'

vi.mock('../solvers/useSolverEnso', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../solvers/useSolverEnso')>()),
  useSolverEnso: vi.fn()
}))

vi.mock('../useEnsoOrder', () => ({
  useEnsoOrder: vi.fn()
}))

const useSolverEnsoMock = vi.mocked(useSolverEnso)
const useEnsoOrderMock = vi.mocked(useEnsoOrder)
const ACCOUNT = '0x0000000000000000000000000000000000000001'
const VAULT = '0x0000000000000000000000000000000000000002'
const TOKEN = '0x0000000000000000000000000000000000000003'

function createEnsoFlow(): ReturnType<typeof useSolverEnso> {
  return {
    actions: { prepareApprove: {} },
    periphery: {
      prepareApproveEnabled: false,
      expectedOut: { raw: 0n },
      minExpectedOut: { raw: 0n },
      priceImpact: undefined,
      allowance: 0n,
      isAllowanceSufficient: true,
      route: undefined,
      routeHasSwap: false,
      error: undefined,
      isLoadingRoute: false,
      isLoadingAllowance: false,
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
  } as unknown as ReturnType<typeof useSolverEnso>
}

describe('vault Enso routing policy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSolverEnsoMock.mockReturnValue(createEnsoFlow())
    useEnsoOrderMock.mockReturnValue({ prepareEnsoOrder: {} } as ReturnType<typeof useEnsoOrder>)
  })

  it.each([
    { destinationChainId: undefined, route: 'same-chain' },
    { destinationChainId: 10, route: 'cross-chain' }
  ])('always configures deposit vault $route routes with the router strategy', ({ destinationChainId }) => {
    renderHook(() =>
      useEnsoDeposit({
        vaultAddress: VAULT,
        depositToken: TOKEN,
        amount: 100n,
        account: ACCOUNT,
        chainId: 1,
        destinationChainId,
        decimalsOut: 18,
        enabled: true
      })
    )

    expect(useSolverEnsoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routingStrategy: 'router',
        destinationChainId
      })
    )
    expect(useSolverEnsoMock.mock.calls.at(-1)?.[0]).not.toHaveProperty('isWalletSafe')
  })

  it.each([
    { destinationChainId: undefined, route: 'same-chain' },
    { destinationChainId: 10, route: 'cross-chain' }
  ])('always configures withdraw vault $route routes with the router strategy', ({ destinationChainId }) => {
    renderHook(() =>
      useEnsoWithdraw({
        vaultAddress: VAULT,
        withdrawToken: TOKEN,
        amount: 100n,
        account: ACCOUNT,
        receiver: ACCOUNT,
        chainId: 1,
        destinationChainId,
        decimalsOut: 18,
        enabled: true
      })
    )

    expect(useSolverEnsoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routingStrategy: 'router',
        destinationChainId
      })
    )
    expect(useSolverEnsoMock.mock.calls.at(-1)?.[0]).not.toHaveProperty('isWalletSafe')
  })
})
