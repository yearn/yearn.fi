// @vitest-environment jsdom

import type { TransactionStep } from '@pages/vaults/components/widget/shared/TransactionOverlay'
import { ETH_TOKEN_ADDRESS, toNormalizedBN } from '@shared/utils'
import { act, render, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SwapPage from './index'

const ACCOUNT = '0x1111111111111111111111111111111111111111' as const
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as const
const ROUTER = '0x2222222222222222222222222222222222222222' as const
const TX_HASH = `0x${'a'.repeat(64)}` as const

type TTransactionOverlayProps = {
  step?: TransactionStep
  onStepSuccess?: (label: string) => void
  onBeforeSuccess?: (label: string) => Promise<void>
  onAllComplete?: () => void
}

const mocks = vi.hoisted(() => ({
  routerReplace: vi.fn(),
  onRefresh: vi.fn(async (_tokens?: unknown[]) => ({})),
  setInputValue: vi.fn(),
  refetchAllowance: vi.fn(async () => undefined),
  getRoute: vi.fn(async () => undefined),
  resetRoute: vi.fn(),
  searchParams: '',
  transactionOverlayProps: undefined as TTransactionOverlayProps | undefined,
  solverAllowsExecution: false,
  minExpectedOut: 4_900_000_000_000_000n,
  ensoOrder: {
    receiptSuccess: false,
    txHash: undefined as `0x${string}` | undefined
  }
}))

const prepareApprove = {
  data: { request: { chainId: 1 } },
  error: null,
  isError: false,
  isLoading: false,
  isSuccess: true,
  isFetching: false,
  status: 'success',
  refetch: vi.fn(async () => undefined)
} as never

const prepareSwap = {
  data: { request: { chainId: 1 } },
  error: null,
  isError: false,
  isLoading: false,
  isSuccess: true,
  isFetching: false,
  status: 'success',
  refetch: vi.fn(async () => undefined)
} as never

function token(address: `0x${string}`, chainID: number, symbol: string, decimals: number, raw: bigint) {
  return {
    address,
    chainID,
    symbol,
    name: symbol,
    decimals,
    value: 10,
    balance: toNormalizedBN(raw, decimals)
  }
}

const usdcToken = token(USDC, 1, 'USDC', 6, 100_000_000n)
const ethToken = token(ETH_TOKEN_ADDRESS, 1, 'ETH', 18, 2_000_000_000_000_000_000n)

vi.mock('next/navigation', () => ({
  usePathname: () => '/swap',
  useRouter: () => ({ replace: mocks.routerReplace }),
  useSearchParams: () => new URLSearchParams(mocks.searchParams)
}))

vi.mock('@shared/contexts/useWeb3', () => ({
  useWeb3: () => ({ address: ACCOUNT, openLoginModal: vi.fn() })
}))

vi.mock('@shared/contexts/useWallet', () => ({
  useWalletActions: () => ({ onRefresh: mocks.onRefresh }),
  useWalletTokens: () => ({
    balances: { 1: { [USDC]: usdcToken, [ETH_TOKEN_ADDRESS]: ethToken } },
    getToken: ({ address, chainID }: { address: `0x${string}`; chainID: number }) =>
      address.toLowerCase() === USDC.toLowerCase()
        ? token(USDC, chainID, 'USDC', 6, 100_000_000n)
        : token(address, chainID, 'ETH', 18, 2_000_000_000_000_000_000n)
  })
}))

vi.mock('@shared/contexts/useYearn', () => ({
  useYearn: () => ({ allVaults: {}, isLoadingVaultList: false, zapSlippage: 1 })
}))

vi.mock('@shared/contexts/WithTokenList', () => ({
  useTokenList: () => ({
    getToken: ({ address, chainID }: { address: `0x${string}`; chainID: number }) =>
      address.toLowerCase() === USDC.toLowerCase()
        ? token(USDC, chainID, 'USDC', 6, 0n)
        : token(address, chainID, 'ETH', 18, 0n)
  })
}))

vi.mock('@shared/hooks/useYearnSpotPrices', () => ({
  useYearnSpotPrices: () => ({ getPrice: () => toNormalizedBN(1_000_000n, 6) })
}))

vi.mock('@pages/vaults/hooks/useTokens', () => ({
  fetchTokenData: vi.fn(async () => []),
  useTokens: () => ({ tokens: [], isLoading: false, refetch: vi.fn() })
}))

vi.mock('@pages/vaults/hooks/useDebouncedInput', () => ({
  useDebouncedInput: () => [
    {
      bn: 10_000_000n,
      debouncedBn: 10_000_000n,
      debouncedSimple: 10,
      isDebouncing: false
    },
    '',
    mocks.setInputValue
  ]
}))

vi.mock('@pages/vaults/hooks/useEnsoEnabled', () => ({ useEnsoEnabled: () => true }))

vi.mock('@pages/vaults/hooks/solvers/useSolverEnso', () => ({
  useSolverEnso: () => ({
    actions: { prepareApprove },
    methods: { getRoute: mocks.getRoute, resetRoute: mocks.resetRoute },
    periphery: {
      allowance: mocks.solverAllowsExecution ? 10_000_000n : 0n,
      approvalWarning: undefined,
      error: undefined,
      expectedOut: toNormalizedBN(5_000_000_000_000_000n, 18),
      minExpectedOut: toNormalizedBN(mocks.minExpectedOut, 18),
      isAllowanceSufficient: mocks.solverAllowsExecution,
      isLoadingAllowance: false,
      isLoadingRoute: false,
      needsAllowanceResetBeforeApproval: false,
      prepareApproveEnabled: true,
      priceImpact: 10,
      refetchAllowance: mocks.refetchAllowance,
      route: {
        tx: {
          chainId: 1,
          data: '0x',
          from: ACCOUNT,
          to: ROUTER,
          value: '0'
        }
      },
      routerAddress: ROUTER
    }
  })
}))

vi.mock('@pages/vaults/hooks/useEnsoOrder', () => ({
  useEnsoOrder: () => ({ prepareEnsoOrder: prepareSwap, ...mocks.ensoOrder })
}))

vi.mock('@pages/vaults/components/widget/shared/useProtectedEnsoQuoteState', () => ({
  useProtectedEnsoQuoteState: (params: { display: { expectedOut: bigint; minExpectedOut: bigint }; tx?: unknown }) => ({
    display: params.display,
    executableTx: params.tx,
    estimatedPriceImpactPercentage: 0.1,
    hasUnpricedQuoteError: false,
    isDisplayLoading: false,
    isPreparing: false,
    priceImpactInfo: { isAboveTolerance: false, isBlocking: false },
    worstCaseRouteImpactPercentage: 0.2
  })
}))

vi.mock('@pages/vaults/components/widget/shared/TransactionOverlay', () => ({
  TransactionOverlay: (props: TTransactionOverlayProps) => {
    mocks.transactionOverlayProps = props
    return <div data-testid="transaction-overlay" />
  }
}))

vi.mock('@pages/vaults/components/widget/InputTokenAmount', () => ({
  InputTokenAmount: () => <div data-testid="input-token" />
}))
vi.mock('@pages/vaults/components/widget/SettingsPanel', () => ({ SettingsPanel: () => null }))
vi.mock('@pages/vaults/components/widget/deposit/ApprovalOverlay', () => ({ ApprovalOverlay: () => null }))
vi.mock('@pages/vaults/components/widget/deposit/ApprovalResetWarning', () => ({
  ApprovalResetWarning: () => null
}))
vi.mock('@pages/vaults/components/widget/shared/PriceImpactWarning', () => ({ PriceImpactWarning: () => null }))
vi.mock('@pages/vaults/components/widget/shared/TokenSelectorOverlay', () => ({ TokenSelectorOverlay: () => null }))
vi.mock('@shared/components/TokenLogoV2', () => ({ TokenLogoV2: () => null }))
vi.mock('@shared/components/Button', () => ({
  Button: ({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}))
vi.mock('./SwapVaultDetails', () => ({ SwapVaultAnnualReturnRow: () => null, SwapVaultWorthRow: () => null }))
vi.mock('./SwapWalletPanel', () => ({ SwapWalletPanel: () => <div data-testid="wallet-panel" /> }))
vi.mock('wagmi', () => ({ useConfig: () => ({}) }))

describe('SwapPage orchestration', () => {
  beforeEach(() => {
    mocks.routerReplace.mockClear()
    mocks.onRefresh.mockClear()
    mocks.setInputValue.mockClear()
    mocks.refetchAllowance.mockClear()
    mocks.getRoute.mockClear()
    mocks.resetRoute.mockClear()
    mocks.searchParams = ''
    mocks.transactionOverlayProps = undefined
    mocks.solverAllowsExecution = false
    mocks.minExpectedOut = 4_900_000_000_000_000n
    mocks.ensoOrder.receiptSuccess = false
    mocks.ensoOrder.txHash = undefined
  })

  it('canonicalizes the route and advances approval into a refreshable swap step', async () => {
    const view = render(<SwapPage />)

    await waitFor(() => expect(mocks.routerReplace).toHaveBeenCalled())
    expect(mocks.transactionOverlayProps?.step?.label).toBe('Approve')
    expect(mocks.transactionOverlayProps?.step?.completesFlow).toBe(false)

    act(() => {
      mocks.transactionOverlayProps?.onStepSuccess?.('Approve')
    })
    expect(mocks.refetchAllowance).toHaveBeenCalledTimes(1)

    mocks.solverAllowsExecution = true
    view.rerender(<SwapPage />)

    expect(mocks.transactionOverlayProps?.step?.label).toBe('Swap')
    expect(mocks.transactionOverlayProps?.step?.notification?.toAmountType).toBe('expected')
    expect(mocks.transactionOverlayProps?.step?.successMessage).toContain('Expected output:')

    await act(async () => {
      await mocks.transactionOverlayProps?.onBeforeSuccess?.('Swap')
    })
    expect(mocks.onRefresh).toHaveBeenCalledWith([
      expect.objectContaining({ address: USDC, chainID: 1 }),
      expect.objectContaining({ address: ETH_TOKEN_ADDRESS, chainID: 1 })
    ])

    act(() => {
      mocks.transactionOverlayProps?.onAllComplete?.()
    })
    expect(mocks.setInputValue).toHaveBeenCalledWith('')
  })

  it('refreshes only the original source asset after a cross-chain source receipt', async () => {
    mocks.searchParams = `fromChain=1&from=${USDC}&toChain=10&to=${ETH_TOKEN_ADDRESS}`
    mocks.solverAllowsExecution = true
    mocks.ensoOrder.txHash = TX_HASH

    const view = render(<SwapPage />)

    expect(mocks.transactionOverlayProps?.onBeforeSuccess).toBeUndefined()
    expect(mocks.onRefresh).not.toHaveBeenCalled()

    mocks.searchParams = ''
    view.rerender(<SwapPage />)
    mocks.ensoOrder.receiptSuccess = true
    view.rerender(<SwapPage />)

    await waitFor(() =>
      expect(mocks.onRefresh).toHaveBeenCalledWith([expect.objectContaining({ address: USDC, chainID: 1 })])
    )
    expect(mocks.onRefresh.mock.calls[0]?.[0]).toHaveLength(1)
  })

  it('does not expose an executable swap step when the route has no minimum output', () => {
    mocks.solverAllowsExecution = true
    mocks.minExpectedOut = 0n

    const view = render(<SwapPage />)

    expect(mocks.transactionOverlayProps?.step?.label).toBe('Swap')
    expect(mocks.transactionOverlayProps?.step?.isEnabled).toBe(false)
    expect(view.getByText('This route has no enforceable minimum output, so execution is blocked.')).toBeTruthy()
    expect(view.getByRole('button', { name: 'Route unavailable' }).hasAttribute('disabled')).toBe(true)
  })
})
