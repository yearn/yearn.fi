import { describe, expect, it } from 'vitest'
import {
  buildWithdrawTransactionStep,
  getWithdrawCtaLabel,
  getWithdrawTransactionName,
  isWithdrawCtaDisabled,
  isWithdrawLastStep
} from './withdrawStepHelpers'

const mockPrepare = { isSuccess: true, data: { request: {} } } as any

describe('withdrawStepHelpers', () => {
  it('returns transaction names for route types', () => {
    expect(getWithdrawTransactionName('DIRECT_WITHDRAW', false)).toBe('Withdraw')
    expect(getWithdrawTransactionName('DIRECT_UNSTAKE', false)).toBe('Unstake')
    expect(getWithdrawTransactionName('DIRECT_UNSTAKE_WITHDRAW', false)).toBe('Unstake & Withdraw')
    expect(getWithdrawTransactionName('KATANA_NATIVE_BRIDGE', false)).toBe('Withdraw and Bridge')
    expect(getWithdrawTransactionName('ENSO', true)).toBe('Fetching quote')
  })

  it('builds approval step when approval is required', () => {
    const step = buildWithdrawTransactionStep({
      needsApproval: true,
      approvePrepare: mockPrepare,
      activeWithdrawPrepare: mockPrepare,
      fallbackStep: 'unstake',
      routeType: 'ENSO',
      isCrossChain: false,
      formattedApprovalAmount: '1.23',
      formattedRequiredShares: '1.23',
      formattedWithdrawAmount: '1.23',
      approvalTokenSymbol: 'yvUSDC',
      withdrawNotificationParams: undefined
    })

    expect(step?.label).toBe('Approve')
    expect(step?.confirmMessage).toContain('Approving 1.23 yvUSDC')
  })

  it('builds unstake and withdraw fallback steps', () => {
    const unstakeStep = buildWithdrawTransactionStep({
      needsApproval: false,
      activeWithdrawPrepare: mockPrepare,
      directUnstakePrepare: mockPrepare,
      directWithdrawPrepare: mockPrepare,
      fallbackStep: 'unstake',
      routeType: 'DIRECT_UNSTAKE_WITHDRAW',
      isCrossChain: false,
      formattedApprovalAmount: '1.00',
      formattedRequiredShares: '2.00',
      formattedWithdrawAmount: '3.00',
      stakingTokenSymbol: 'st-yvUSDC',
      assetTokenSymbol: 'USDC',
      withdrawNotificationParams: undefined
    })

    const withdrawStep = buildWithdrawTransactionStep({
      needsApproval: false,
      activeWithdrawPrepare: mockPrepare,
      directUnstakePrepare: mockPrepare,
      directWithdrawPrepare: mockPrepare,
      fallbackStep: 'withdraw',
      routeType: 'DIRECT_UNSTAKE_WITHDRAW',
      isCrossChain: false,
      formattedApprovalAmount: '1.00',
      formattedRequiredShares: '2.00',
      formattedWithdrawAmount: '3.00',
      stakingTokenSymbol: 'st-yvUSDC',
      assetTokenSymbol: 'USDC',
      withdrawNotificationParams: undefined
    })

    expect(unstakeStep?.label).toBe('Unstake')
    expect(withdrawStep?.label).toBe('Withdraw')
  })

  it('builds cross-chain success messaging for regular routes', () => {
    const step = buildWithdrawTransactionStep({
      needsApproval: false,
      activeWithdrawPrepare: mockPrepare,
      fallbackStep: 'unstake',
      routeType: 'ENSO',
      isCrossChain: true,
      formattedApprovalAmount: '1.00',
      formattedRequiredShares: '2.00',
      formattedWithdrawAmount: '3.00',
      assetTokenSymbol: 'USDC',
      withdrawNotificationParams: undefined
    })

    expect(step?.successTitle).toBe('Transaction Submitted')
  })

  it('builds Katana native bridge fallback steps', () => {
    const withdrawStep = buildWithdrawTransactionStep({
      needsApproval: false,
      activeWithdrawPrepare: mockPrepare,
      directWithdrawPrepare: mockPrepare,
      fallbackStep: 'withdraw',
      routeType: 'KATANA_NATIVE_BRIDGE',
      isCrossChain: true,
      formattedApprovalAmount: '1.00',
      formattedRequiredShares: '2.00',
      formattedWithdrawAmount: '3.00',
      assetTokenSymbol: 'vbUSDC',
      bridgeDestinationSymbol: 'USDC',
      withdrawNotificationParams: undefined,
      bridgeNotificationParams: undefined
    })

    const bridgeStep = buildWithdrawTransactionStep({
      needsApproval: false,
      activeWithdrawPrepare: mockPrepare,
      fallbackStep: 'bridge',
      routeType: 'KATANA_NATIVE_BRIDGE',
      isCrossChain: true,
      formattedApprovalAmount: '1.00',
      formattedRequiredShares: '2.00',
      formattedWithdrawAmount: '3.00',
      assetTokenSymbol: 'vbUSDC',
      bridgeDestinationSymbol: 'USDC',
      withdrawNotificationParams: undefined,
      bridgeNotificationParams: undefined
    })

    expect(withdrawStep?.label).toBe('Withdraw')
    expect(withdrawStep?.successMessage).toContain('Preparing your bridge')
    expect(bridgeStep?.label).toBe('Bridge')
    expect(bridgeStep?.successTitle).toBe('Bridge submitted')
  })

  it('computes last step state correctly', () => {
    expect(
      isWithdrawLastStep({
        currentStep: undefined,
        needsApproval: false,
        routeType: 'ENSO'
      })
    ).toBe(true)

    expect(
      isWithdrawLastStep({
        currentStep: {
          prepare: mockPrepare,
          label: 'Approve',
          confirmMessage: '',
          successTitle: '',
          successMessage: ''
        },
        needsApproval: true,
        routeType: 'ENSO'
      })
    ).toBe(false)

    expect(
      isWithdrawLastStep({
        currentStep: {
          prepare: mockPrepare,
          label: 'Unstake',
          confirmMessage: '',
          successTitle: '',
          successMessage: ''
        },
        needsApproval: false,
        routeType: 'DIRECT_UNSTAKE_WITHDRAW'
      })
    ).toBe(false)

    expect(
      isWithdrawLastStep({
        currentStep: {
          prepare: mockPrepare,
          label: 'Withdraw',
          confirmMessage: '',
          successTitle: '',
          successMessage: ''
        },
        needsApproval: false,
        routeType: 'DIRECT_UNSTAKE_WITHDRAW'
      })
    ).toBe(true)

    expect(
      isWithdrawLastStep({
        currentStep: {
          prepare: mockPrepare,
          label: 'Withdraw',
          confirmMessage: '',
          successTitle: '',
          successMessage: ''
        },
        needsApproval: false,
        routeType: 'KATANA_NATIVE_BRIDGE'
      })
    ).toBe(false)

    expect(
      isWithdrawLastStep({
        currentStep: {
          prepare: mockPrepare,
          label: 'Bridge',
          confirmMessage: '',
          successTitle: '',
          successMessage: ''
        },
        needsApproval: false,
        routeType: 'KATANA_NATIVE_BRIDGE'
      })
    ).toBe(true)
  })

  it('computes CTA disabled state and label', () => {
    expect(
      isWithdrawCtaDisabled({
        hasError: false,
        withdrawAmountRaw: 1n,
        isFetchingQuote: false,
        isDebouncing: false,
        showApprove: true,
        isAllowanceSufficient: false,
        prepareApproveEnabled: false,
        prepareWithdrawEnabled: true
      })
    ).toBe(true)

    expect(
      isWithdrawCtaDisabled({
        hasError: false,
        withdrawAmountRaw: 1n,
        isFetchingQuote: false,
        isDebouncing: false,
        showApprove: false,
        isAllowanceSufficient: true,
        prepareApproveEnabled: false,
        prepareWithdrawEnabled: true
      })
    ).toBe(false)

    expect(
      getWithdrawCtaLabel({
        isFetchingQuote: false,
        showApprove: true,
        isAllowanceSufficient: false,
        transactionName: 'Withdraw'
      })
    ).toBe('Approve & Withdraw')
  })
})
