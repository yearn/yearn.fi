// @vitest-environment jsdom
import { YvUsdWidget } from '@pages/vaults/components/widget/yvUSD/YvUsdWidget'
import { YVUSD_TRANCHE_DEPLOYMENT } from '@pages/vaults/constants/tranchedProducts'
import type { TKongVaultView } from '@pages/vaults/domain/kongVaultSelectors'
import { WidgetActionType } from '@pages/vaults/types'
import { YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { YEARN_4626_ROUTER } from '@shared/utils/constants'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  unlockedBalance: 10n ** 18n,
  lockedBalance: 2n * 10n ** 18n,
  maxWithdraw: 0n,
  atomic: false,
  safe: false,
  router: '0x0000000000000000000000000000000000000000'
}))
const refreshBalances = vi.hoisted(() => vi.fn())
vi.mock('@shared/contexts/useWeb3', () => ({ useWeb3: () => ({ isWalletSafe: state.safe }) }))
vi.mock('@pages/vaults/hooks/useTokenAllowance', () => ({ useTokenAllowance: () => ({ allowance: 0n }) }))
vi.mock('@shared/hooks/useAppWagmi', () => ({
  useReadContract: () => ({ data: state.maxWithdraw, refetch: refreshBalances }),
  useSimulateContract: (request: unknown) => ({
    isSuccess: true,
    isError: false,
    data: { request, result: 4n * 10n ** 17n }
  })
}))
vi.mock('@yearn/vault-widget/advanced', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@yearn/vault-widget/advanced')>()),
  useAtomicBatchCapability: () => ({ supported: state.atomic, status: state.atomic ? 'supported' : 'unsupported' })
}))
const capturePanel = vi.hoisted(() => vi.fn())

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: '0x1111111111111111111111111111111111111111' })
}))

const asset = {
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as const,
  decimals: 6,
  name: 'USD Coin',
  symbol: 'USDC'
}
const unlockedVault = { address: YVUSD_UNLOCKED_ADDRESS, decimals: 18, token: asset, version: '3.0.4' }
const lockedVault = { ...unlockedVault, address: YVUSD_LOCKED_ADDRESS }

vi.mock('@pages/vaults/hooks/useYvUsdVaults', () => ({
  useYvUsdVaults: () => ({ unlockedVault, lockedVault, assetAddress: asset.address })
}))

vi.mock('@pages/vaults/hooks/useVaultUserData', () => ({
  useVaultUserData: ({ vaultAddress }: { vaultAddress: string }) => {
    const isLocked = vaultAddress === YVUSD_LOCKED_ADDRESS
    return {
      assetToken: isLocked ? { ...asset, address: YVUSD_UNLOCKED_ADDRESS, decimals: 18 } : asset,
      vaultToken: {
        address: vaultAddress,
        decimals: 18,
        balance: { raw: isLocked ? state.lockedBalance : state.unlockedBalance }
      },
      pricePerShare: isLocked ? 11n * 10n ** 17n : 1_200_000n,
      isLoading: false,
      refetch: refreshBalances
    }
  }
}))

vi.mock('@pages/vaults/components/widget/yvUSD/YvUsdDeposit', () => ({ YvUsdDeposit: () => null }))
vi.mock('@pages/vaults/components/widget/yvUSD/YvUsdWithdraw', () => ({
  YvUsdWithdraw: ({ initialVariant }: { initialVariant?: string }) => <p>{`Withdraw ${initialVariant}`}</p>
}))
vi.mock('@pages/vaults/components/widget/migrate', () => ({
  WidgetMigrate: (props: {
    headerActions?: ReactNode
    destinationActions?: ReactNode
    contentAboveButton?: ReactNode
    actionButtonOverride?: ReactNode
    onTransactionOpenChange: (open: boolean) => void
  }) => {
    capturePanel(props)
    return (
      <div>
        {props.headerActions}
        {props.destinationActions}
        {props.contentAboveButton}
        {props.actionButtonOverride}
        <button type="button" onClick={() => props.onTransactionOpenChange(true)}>
          {'Open transaction preview'}
        </button>
        <button type="button" onClick={() => props.onTransactionOpenChange(false)}>
          {'Close transaction preview'}
        </button>
      </div>
    )
  }
}))

function renderWidget(): () => void {
  const widget = () => (
    <YvUsdWidget
      currentVault={
        {
          ...unlockedVault,
          migration: { available: true, contract: state.router }
        } as unknown as TKongVaultView
      }
      chainId={1}
      actions={[WidgetActionType.Migrate, WidgetActionType.Withdraw]}
    />
  )
  const view = render(widget())
  return () => view.rerender(widget())
}

beforeEach(() => {
  state.unlockedBalance = 10n ** 18n
  state.lockedBalance = 2n * 10n ** 18n
  state.maxWithdraw = 0n
  state.atomic = false
  state.safe = false
  state.router = '0x0000000000000000000000000000000000000000'
  refreshBalances.mockReset()
  capturePanel.mockClear()
})
afterEach(cleanup)

describe('Legacy yvUSD migration selections', () => {
  it('updates the migration destination and its three explanations', () => {
    renderWidget()
    expect(capturePanel.mock.lastCall?.[0].migrationTarget).toBe(YVUSD_TRANCHE_DEPLOYMENT.tranches.fixed)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('5% Target APY')).toBeTruthy()
    expect(capturePanel.mock.lastCall?.[0].migrationTargetLogoURI).toMatch(/ytranche\/yvusd-senior\.png$/)

    fireEvent.click(screen.getByRole('button', { name: 'Junior' }))
    expect(capturePanel.mock.lastCall?.[0].migrationTarget).toBe(YVUSD_TRANCHE_DEPLOYMENT.tranches.levered)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('Higher risk, higher yield')).toBeTruthy()
    expect(screen.getByText('No target APY')).toBeTruthy()
    expect(screen.getByText('No lockups or cooldown')).toBeTruthy()
    expect(capturePanel.mock.lastCall?.[0].migrationTargetLogoURI).toMatch(/ytranche\/yvusd-junior\.png$/)
    expect(screen.queryByText('5% Target APY')).toBeNull()
  })

  it('opens the selected tranche explanation with documentation and live data links', () => {
    renderWidget()
    fireEvent.click(screen.getByRole('button', { name: 'Junior' }))
    fireEvent.click(screen.getByRole('button', { name: 'more info' }))
    expect(screen.getByRole('heading', { name: 'Junior vault info' })).toBeTruthy()
    expect(screen.getByText('Risk and protection')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Documentation' }).getAttribute('href')).toBe(
      'https://github.com/yearn/ytranche#readme'
    )
    expect(screen.getByRole('link', { name: 'Live data' }).getAttribute('href')).toBe(
      'https://ytranche-git-separate-ui-w84aprils-projects.vercel.app/institutions'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(screen.queryByRole('heading', { name: 'Junior vault info' })).toBeNull()
  })

  it('shows the selected locked balance and opens locked withdrawals without losing the destination', () => {
    renderWidget()
    fireEvent.click(screen.getByRole('button', { name: 'Junior' }))
    fireEvent.click(screen.getByRole('button', { name: 'Locked' }))
    const lockedPanel = capturePanel.mock.lastCall?.[0]
    expect(lockedPanel.vaultAddress).toBe(YVUSD_UNLOCKED_ADDRESS)
    expect(lockedPanel.displayVaultUserData.vaultToken.balance.raw).toBe(state.lockedBalance)
    expect(lockedPanel.displayVaultUserData.pricePerShare).toBe(1_320_000n)
    expect(lockedPanel.displayVaultUserData.assetToken.address).toBe(asset.address)
    expect(lockedPanel.disableFlow).toBe(true)
    expect(lockedPanel.readyBalance).toBeUndefined()

    fireEvent.click(screen.getByRole('button', { name: 'Unlock' }))
    expect(screen.getByText('Withdraw locked')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Migrate' }))
    expect(capturePanel.mock.lastCall?.[0].migrationTarget).toBe(YVUSD_TRANCHE_DEPLOYMENT.tranches.levered)
    expect(capturePanel.mock.lastCall?.[0].vaultAddress).toBe(YVUSD_UNLOCKED_ADDRESS)
    expect(capturePanel.mock.lastCall?.[0].disableFlow).toBe(false)
  })

  it('starts on locked capital when the wallet has only locked shares', () => {
    state.unlockedBalance = 0n
    renderWidget()
    expect(screen.getByRole('button', { name: 'Locked' }).getAttribute('aria-pressed')).toBe('true')
    expect(capturePanel.mock.lastCall?.[0].displayVaultUserData.vaultToken.address).toBe(YVUSD_LOCKED_ADDRESS)
    expect(capturePanel.mock.lastCall?.[0].disableFlow).toBe(true)
  })

  it('continues from a confirmed unlock and preserves only the newly unlocked amount on interruption', async () => {
    state.maxWithdraw = 5n * 10n ** 17n
    state.router = YEARN_4626_ROUTER
    renderWidget()
    fireEvent.click(screen.getByRole('button', { name: 'Junior' }))
    fireEvent.click(screen.getByRole('button', { name: 'Locked' }))
    expect(capturePanel.mock.lastCall?.[0].actionLabelOverride).toBe('Unlock & Migrate')
    expect(capturePanel.mock.lastCall?.[0].balanceLabel).toBe('Total Balance')
    expect(capturePanel.mock.lastCall?.[0].readyBalance).toBe(4n * 10n ** 17n)
    expect(capturePanel.mock.lastCall?.[0].displayVaultUserData.vaultToken.balance.raw).toBe(state.lockedBalance)
    expect(capturePanel.mock.lastCall?.[0].transactionStepOverride.id).toBe('unlock')
    expect(capturePanel.mock.lastCall?.[0].transactionStepOverride.completesFlow).toBe(false)
    expect(capturePanel.mock.lastCall?.[0].transactionStepOverride.prepare.data.request.args).toEqual([
      state.maxWithdraw,
      '0x1111111111111111111111111111111111111111',
      '0x1111111111111111111111111111111111111111',
      0n
    ])

    act(() => capturePanel.mock.lastCall?.[0].onTransactionOpenChange(true))
    state.maxWithdraw = 0n
    state.unlockedBalance += 5n * 10n ** 17n
    await act(async () => {
      await capturePanel.mock.lastCall?.[0].onTransactionStepSuccess('unlock')
    })
    expect(capturePanel.mock.lastCall?.[0].transactionStepOverride).toBeUndefined()
    expect(capturePanel.mock.lastCall?.[0].migrationBalanceOverride).toBe(5n * 10n ** 17n)
    expect(capturePanel.mock.lastCall?.[0].disableFlow).toBe(false)

    act(() => capturePanel.mock.lastCall?.[0].onTransactionOpenChange(false))
    expect(screen.getByRole('button', { name: 'Unlocked' }).getAttribute('aria-pressed')).toBe('true')
    expect(capturePanel.mock.lastCall?.[0].actionLabelOverride).toBe('Finish Migration')
    expect(capturePanel.mock.lastCall?.[0].migrationBalanceOverride).toBe(5n * 10n ** 17n)
    expect(capturePanel.mock.lastCall?.[0].migrationTarget).toBe(YVUSD_TRANCHE_DEPLOYMENT.tranches.levered)
  })

  it('keeps confirmed unlocked funds recoverable if refreshing the next step fails', async () => {
    state.maxWithdraw = 5n * 10n ** 17n
    state.router = YEARN_4626_ROUTER
    renderWidget()
    fireEvent.click(screen.getByRole('button', { name: 'Locked' }))
    act(() => capturePanel.mock.lastCall?.[0].onTransactionOpenChange(true))
    refreshBalances.mockRejectedValueOnce(new Error('Refresh unavailable'))
    await act(async () => {
      await expect(capturePanel.mock.lastCall?.[0].onTransactionStepSuccess('unlock')).rejects.toThrow(
        'Refresh unavailable'
      )
    })
    act(() => capturePanel.mock.lastCall?.[0].onTransactionOpenChange(false))
    expect(screen.getByRole('button', { name: 'Unlocked' }).getAttribute('aria-pressed')).toBe('true')
    expect(capturePanel.mock.lastCall?.[0].transactionStepOverride).toBeUndefined()
    expect(capturePanel.mock.lastCall?.[0].migrationBalanceOverride).toBe(5n * 10n ** 17n)
    expect(capturePanel.mock.lastCall?.[0].actionLabelOverride).toBe('Finish Migration')
  })

  it.each(['atomic wallet', 'Safe'])('uses one batch for a %s', (wallet) => {
    state.maxWithdraw = 5n * 10n ** 17n
    state.router = YEARN_4626_ROUTER
    state.atomic = wallet === 'atomic wallet'
    state.safe = wallet === 'Safe'
    renderWidget()
    fireEvent.click(screen.getByRole('button', { name: 'Locked' }))
    const step = capturePanel.mock.lastCall?.[0].transactionStepOverride
    expect(step.id).toBe('unlock-migrate')
    expect(step.completesFlow).toBe(true)
    expect(step.batch.calls).toHaveLength(3)
    expect(step.batch.calls.map((call: { to: string }) => call.to)).toEqual([
      YVUSD_LOCKED_ADDRESS,
      YVUSD_UNLOCKED_ADDRESS,
      YEARN_4626_ROUTER
    ])
  })

  it('does not enable an unlock transaction when the migration router is not configured', () => {
    state.maxWithdraw = 5n * 10n ** 17n
    renderWidget()
    fireEvent.click(screen.getByRole('button', { name: 'Locked' }))
    expect(capturePanel.mock.lastCall?.[0].actionLabelOverride).toBe('Unlock & Migrate')
    expect(capturePanel.mock.lastCall?.[0].transactionStepOverride.isEnabled).toBe(false)
  })

  it('keeps the default Unlocked tab mounted when a successful migration empties its balance', async () => {
    state.router = YEARN_4626_ROUTER
    const refresh = renderWidget()
    fireEvent.click(screen.getByRole('button', { name: 'Open transaction preview' }))
    const closePreview = screen.getByRole('button', { name: 'Close transaction preview' })

    await act(async () => {
      capturePanel.mock.lastCall?.[0].handleMigrateSuccess()
      state.unlockedBalance = 0n
      refresh()
    })

    expect(screen.getByRole('button', { name: 'Unlocked' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Close transaction preview' })).toBe(closePreview)
    fireEvent.click(closePreview)
    ;['Locked', 'Unlocked', 'Senior', 'Junior'].forEach((name) => {
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(false)
    })
  })

  it('locks both selectors while the transaction preview is open', () => {
    renderWidget()
    fireEvent.click(screen.getByRole('button', { name: 'Open transaction preview' }))
    ;['Locked', 'Unlocked', 'Senior', 'Junior'].forEach((name) => {
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Close transaction preview' }))
    expect((screen.getByRole('button', { name: 'Junior' }) as HTMLButtonElement).disabled).toBe(false)
  })
})
