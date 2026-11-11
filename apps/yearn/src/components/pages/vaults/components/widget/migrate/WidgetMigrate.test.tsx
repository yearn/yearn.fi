// @vitest-environment jsdom
import { WidgetMigrate } from '@pages/vaults/components/widget/migrate'
import type { VaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import { YEARN_4626_ROUTER } from '@shared/utils/constants'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { TransactionStep } from '@yearn/vault-widget/advanced'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const captureOverlay = vi.hoisted(() => vi.fn())
const captureFlow = vi.hoisted(() => vi.fn())
const state = vi.hoisted(() => ({ checking: false, error: undefined as string | undefined }))
vi.mock('@hooks/usePlausible', () => ({ usePlausible: () => vi.fn() }))
vi.mock('wagmi', () => ({
  useAccount: () => ({ address: '0x1111111111111111111111111111111111111111' })
}))
vi.mock('@shared/contexts/useWallet', () => ({ useWalletTokens: () => ({ getToken: () => undefined }) }))
vi.mock('@shared/contexts/useWeb3', () => ({ useWeb3: () => ({ openLoginModal: vi.fn() }) }))
vi.mock('@shared/hooks/useAppWagmi', () => ({ usePublicClient: () => undefined }))
vi.mock('@shared/hooks/useYearnSpotPrices', () => ({
  useYearnSpotPrices: () => ({ getPrice: () => ({ normalized: 1 }) })
}))
vi.mock('@shared/components/TokenLogoV2', () => ({ TokenLogoV2: () => null }))
vi.mock('@yearn/vault-widget/advanced', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@yearn/vault-widget/advanced')>()),
  TransactionOverlay: (props: unknown) => {
    captureOverlay(props)
    return null
  }
}))
vi.mock('@pages/vaults/components/widget/migrate/useMigrateFlow', () => ({
  useMigrateFlow: (props: unknown) => {
    captureFlow(props)
    const prepare = { isSuccess: true, isLoading: false, isError: false }
    return {
      actions: { prepareApprove: prepare, prepareMigrate: prepare, prepareMulticall: prepare },
      periphery: {
        routeType: 'approve',
        isAllowanceSufficient: false,
        isCheckingPermit: state.checking,
        prepareApproveEnabled: true,
        prepareMigrateEnabled: false,
        prepareMulticallEnabled: false,
        error: state.error
      }
    }
  }
}))

const props = {
  vaultAddress: '0x1111111111111111111111111111111111111111' as const,
  assetAddress: '0x2222222222222222222222222222222222222222' as const,
  migrationTarget: '0x3333333333333333333333333333333333333333' as const,
  migrationContract: YEARN_4626_ROUTER,
  chainId: 1,
  vaultSymbol: 'yvUSD',
  vaultVersion: '3.0.4',
  vaultUserData: {
    vaultToken: { balance: { raw: 1n }, decimals: 18 },
    assetToken: { decimals: 6 },
    pricePerShare: 1_000_000n,
    isLoading: false,
    refetch: vi.fn()
  } as unknown as VaultUserData
}
const unlockStep = {
  id: 'unlock',
  label: 'Unlock',
  prepare: { isSuccess: true, isError: false, data: { request: {} } },
  completesFlow: false
} as TransactionStep

beforeEach(() => {
  captureOverlay.mockClear()
  captureFlow.mockClear()
  state.checking = false
  state.error = undefined
})
afterEach(cleanup)

describe('migration transaction handoff', () => {
  it('shows the total and ready amounts in the same locked token', () => {
    const lockedData = {
      ...props.vaultUserData,
      vaultToken: { balance: { raw: 4_437_947n }, decimals: 6, symbol: 'Locked yvUSD' }
    } as VaultUserData
    render(
      <WidgetMigrate
        {...props}
        displayVaultUserData={lockedData}
        balanceLabel="Total Balance"
        readyBalance={916_677n}
      />
    )
    expect(screen.getByText('Total Balance')).toBeTruthy()
    expect(screen.getByText('4.44 Locked yvUSD')).toBeTruthy()
    expect(screen.getByText('Ready to migrate')).toBeTruthy()
    expect(screen.getByText('0.917 Locked yvUSD')).toBeTruthy()
  })

  it('opens on Unlock and keeps the same overlay ready to auto-continue into approval', () => {
    // A previous migration simulation must not replace the active Unlock action.
    state.error = 'An earlier simulation failed'
    const onOpenChange = vi.fn()
    const onStepSuccess = vi.fn()
    const onComplete = vi.fn()
    const view = render(
      <WidgetMigrate
        {...props}
        transactionStepOverride={unlockStep}
        actionLabelOverride="Unlock & Migrate"
        onTransactionOpenChange={onOpenChange}
        onTransactionStepSuccess={onStepSuccess}
        handleMigrateSuccess={onComplete}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Unlock & Migrate' }))
    expect(onOpenChange).toHaveBeenCalledWith(true)
    expect(captureFlow.mock.lastCall?.[0].enabled).toBe(false)
    expect(captureOverlay.mock.lastCall?.[0]).toMatchObject({
      isOpen: true,
      step: { id: 'unlock' },
      isLastStep: false,
      autoContinueToNextStep: true,
      autoContinueStepIds: expect.arrayContaining(['unlock', 'approve', 'permit']),
      onStepSuccess
    })
    expect(onComplete).not.toHaveBeenCalled()

    state.error = undefined
    state.checking = true
    view.rerender(<WidgetMigrate {...props} />)
    expect(captureOverlay.mock.lastCall?.[0]).toMatchObject({
      isOpen: true,
      step: { id: 'approve', isEnabled: false },
      isLastStep: false
    })
    state.checking = false
    view.rerender(<WidgetMigrate {...props} />)
    expect(captureOverlay.mock.lastCall?.[0]).toMatchObject({
      isOpen: true,
      step: { id: 'approve', isEnabled: true }
    })
    expect(captureFlow.mock.lastCall?.[0].enabled).toBe(true)
  })

  it('blocks Unlock when no migration router is configured', () => {
    render(
      <WidgetMigrate
        {...props}
        migrationContract="0x0000000000000000000000000000000000000000"
        transactionStepOverride={unlockStep}
        actionLabelOverride="Unlock & Migrate"
      />
    )
    expect((screen.getByRole('button', { name: 'Unlock & Migrate' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
