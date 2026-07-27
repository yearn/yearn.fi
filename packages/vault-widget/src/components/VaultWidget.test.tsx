// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import type { CSSProperties, ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VaultWidgetConfig, VaultWidgetExecutionState, VaultWidgetToken } from '../types'
import { getNextVaultActionTabIndex, hasStakingDepositFlow, VaultWidget } from './VaultWidget'

const { useController } = vi.hoisted(() => ({
  useController: vi.fn()
}))

vi.mock('../headless', () => ({
  useVaultWidgetController: useController
}))

const asset: VaultWidgetToken = {
  address: '0x1111111111111111111111111111111111111111',
  chainId: 1,
  decimals: 18,
  symbol: 'ASSET'
}
const positionToken: VaultWidgetToken = {
  address: '0x2222222222222222222222222222222222222222',
  chainId: 1,
  decimals: 18,
  symbol: 'yvASSET'
}
const positionSource = {
  balance: 0n,
  id: 'vault',
  label: 'Vault shares',
  token: positionToken,
  value: 0n
}
const config: VaultWidgetConfig = {
  adapters: [],
  chainId: 1,
  depositTokens: [asset],
  id: 'test-widget',
  modes: ['deposit', 'withdraw'],
  name: 'Test Vault',
  positionToken,
  vaultAddress: positionToken.address,
  withdrawTokens: [asset]
}

function createController(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    account: undefined,
    allowance: 0n,
    amount: '',
    approvalTarget: undefined,
    balance: 0n,
    balanceDecimals: 18,
    balanceFormatted: '0',
    canSubmit: false,
    error: undefined,
    execution: { status: 'idle' },
    infoPositionSources: [positionSource],
    isLoading: false,
    isQuoteLoading: false,
    mode: 'deposit',
    modes: ['deposit', 'withdraw'],
    needsApproval: false,
    overBalance: false,
    plan: undefined,
    positionBalance: 0n,
    positionSources: [positionSource],
    positionValue: 0n,
    positionValueDecimals: 18,
    quote: undefined,
    refresh: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn(),
    resetExecution: vi.fn(),
    selectedPositionSource: positionSource,
    selectedToken: asset,
    setAmount: vi.fn(),
    setMode: vi.fn(),
    setPercentage: vi.fn(),
    setSelectedPositionSource: vi.fn(),
    setSelectedToken: vi.fn(),
    setSettings: vi.fn(),
    settings: {
      autoStake: true,
      maxLossBps: 100,
      slippagePercent: 0.5,
      solver: 'enso'
    },
    submit: vi.fn().mockResolvedValue(undefined),
    tokens: [asset],
    walletType: 'eoa',
    ...overrides
  }
}

function renderWidget(element: ReactElement): ReturnType<typeof render> {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  })
  return render(<QueryClientProvider client={client}>{element}</QueryClientProvider>)
}

describe('VaultWidget', () => {
  beforeEach(() => {
    useController.mockReset()
    useController.mockReturnValue(createController())
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
  })

  it('supports copy, component slots, and host theme tokens', () => {
    function Header({ name }: { name: string }): ReactElement {
      return <h2>Embedded {name}</h2>
    }
    function ConnectButton({ label, onClick }: { label: string; onClick: () => void }): ReactElement {
      return (
        <button type="button" onClick={onClick}>
          Custom {label}
        </button>
      )
    }
    function Details(): ReactElement {
      return <p>Host details</p>
    }
    const onConnectWallet = vi.fn()

    renderWidget(
      <VaultWidget
        chainId={1}
        config={config}
        copy={{
          amount: 'Quantity',
          autoStake: 'Compound automatically',
          connect: 'Link wallet',
          slippage: 'Route tolerance'
        }}
        onConnectWallet={onConnectWallet}
        slots={{ ConnectButton, Details, Header }}
        style={{ '--yv-widget-primary': 'oklch(0.62 0.2 255)' } as CSSProperties}
        vaultAddress={config.vaultAddress}
        viewport="desktop"
      />
    )

    expect(screen.getByRole('region', { name: 'Test Vault vault actions' }).getAttribute('data-viewport')).toBe(
      'desktop'
    )
    expect(screen.getByRole('region').getAttribute('style')).toContain('--yv-widget-primary')
    expect(screen.getByRole('heading', { name: 'Embedded Test Vault' })).toBeTruthy()
    expect(screen.getByLabelText('Quantity of ASSET')).toBeTruthy()
    expect(screen.getByText('Host details')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Custom Link wallet' }))
    expect(onConnectWallet).toHaveBeenCalledOnce()

    fireEvent.click(screen.getAllByRole('button', { name: 'Transaction Settings' })[0]!)
    expect(screen.getByText('Route tolerance')).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'Compound automatically' })).toBeTruthy()
  })

  it('maps accessible tab interaction to controlled mode changes', () => {
    const setMode = vi.fn()
    useController.mockReturnValue(createController({ setMode }))

    renderWidget(<VaultWidget chainId={1} config={config} vaultAddress={config.vaultAddress} />)

    const deposit = screen.getByRole('tab', { name: 'Deposit' })
    const withdraw = screen.getByRole('tab', { name: 'Withdraw' })
    expect(deposit.getAttribute('aria-selected')).toBe('true')
    expect(withdraw.getAttribute('aria-selected')).toBe('false')
    fireEvent.click(withdraw)
    expect(setMode).toHaveBeenCalledWith('withdraw')
    expect(deposit.getAttribute('tabindex')).toBe('0')
    expect(withdraw.getAttribute('tabindex')).toBe('-1')
    expect(deposit.getAttribute('aria-controls')).toBe(screen.getByRole('tabpanel').id)
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(deposit.id)
  })

  it('supports roving keyboard focus across every action tab', () => {
    const setMode = vi.fn()
    useController.mockReturnValue(
      createController({
        modes: ['deposit', 'withdraw', 'info'],
        setMode
      })
    )

    renderWidget(<VaultWidget chainId={1} config={config} vaultAddress={config.vaultAddress} />)

    const deposit = screen.getByRole('tab', { name: 'Deposit' })
    const withdraw = screen.getByRole('tab', { name: 'Withdraw' })
    const info = screen.getByRole('tab', { name: 'My Info' })

    withdraw.focus()
    fireEvent.keyDown(withdraw, { key: 'ArrowRight' })
    expect(setMode).toHaveBeenLastCalledWith('info')
    expect(document.activeElement).toBe(info)

    fireEvent.keyDown(info, { key: 'Home' })
    expect(setMode).toHaveBeenLastCalledWith('deposit')
    expect(document.activeElement).toBe(deposit)

    fireEvent.keyDown(deposit, { key: 'ArrowLeft' })
    expect(setMode).toHaveBeenLastCalledWith('info')
    expect(document.activeElement).toBe(info)
  })

  it('allows a headless host to replace the My Info workflow panel', () => {
    useController.mockReturnValue(
      createController({
        mode: 'info',
        modes: ['deposit', 'withdraw', 'info']
      })
    )

    renderWidget(
      <VaultWidget
        chainId={1}
        config={config}
        headerActions={<button type="button">Choose variant</button>}
        renderPanel={(mode) => <p>Host {mode} panel</p>}
        vaultAddress={config.vaultAddress}
      />
    )

    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(
      screen.getByRole('tab', { name: 'My Info' }).id
    )
    expect(screen.getByText('Host info panel')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Choose variant' })).toBeTruthy()
  })

  it('closes settings with Escape and restores focus to the opening control', () => {
    const onSettingsOpenChange = vi.fn()
    renderWidget(
      <VaultWidget
        chainId={1}
        config={config}
        onSettingsOpenChange={onSettingsOpenChange}
        vaultAddress={config.vaultAddress}
        viewport="mobile"
      />
    )
    const settingsButton = screen.getAllByRole('button', { name: 'Transaction Settings' })[0]!

    fireEvent.click(settingsButton)
    expect(onSettingsOpenChange).toHaveBeenCalledWith(true)
    expect(screen.getByRole('heading', { name: 'Transaction Settings' })).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onSettingsOpenChange).toHaveBeenCalledWith(false)
    expect(document.activeElement).toBe(settingsButton)
  })

  it('contains token selection in the widget and restores focus after closing', () => {
    renderWidget(<VaultWidget chainId={1} config={config} vaultAddress={config.vaultAddress} />)
    const tokenButton = screen.getByRole('button', { name: 'ASSET' })

    fireEvent.click(tokenButton)
    expect(screen.getByRole('dialog', { name: 'Select deposit token' })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Search tokens' }))

    fireEvent.click(screen.getByRole('button', { name: 'Close token selector' }))
    expect(screen.queryByRole('dialog', { name: 'Select deposit token' })).toBeNull()
    expect(document.activeElement).toBe(tokenButton)
  })

  it('uses the full balance, shows sentence-case deposit details, and restores the auto-stake warning', () => {
    const setPercentage = vi.fn()
    const setSettings = vi.fn()
    const stakingConfig: VaultWidgetConfig = {
      ...config,
      infoPositionSources: [{ ...positionSource, id: 'staked' }],
      display: {
        approvalSpenderName: { deposit: 'Test Zap' },
        estimatedApr: 0.05,
        positionLabel: 'Staked shares'
      }
    }
    useController.mockReturnValue(
      createController({
        account: '0x3333333333333333333333333333333333333333',
        allowance: 0n,
        amount: '7.58',
        approvalTarget: {
          spender: '0x4444444444444444444444444444444444444444',
          token: asset
        },
        balance: 7_580_000_000_000_000_000n,
        quote: {
          adapterId: 'deposit-and-stake',
          amountIn: 7_580_000_000_000_000_000n,
          assetValue: 7_580_000_000_000_000_000n,
          expectedOut: 6_990_000_000_000_000_000n,
          minExpectedOut: 6_990_000_000_000_000_000n,
          positionAmount: 6_990_000_000_000_000_000n,
          transaction: {
            chainId: 1,
            data: '0x1234',
            to: '0x4444444444444444444444444444444444444444'
          }
        },
        setPercentage,
        setSettings,
        settings: {
          autoStake: false,
          maxLossBps: 100,
          slippagePercent: 0.5,
          solver: 'enso'
        }
      })
    )

    renderWidget(<VaultWidget chainId={1} config={stakingConfig} vaultAddress={stakingConfig.vaultAddress} />)

    expect(screen.getByText('You will deposit')).toBeTruthy()
    expect(screen.getByText('You will receive')).toBeTruthy()
    expect(screen.getByText('Vault share value')).toBeTruthy()
    expect(screen.getByText('Est. annual return')).toBeTruthy()
    expect(screen.getByText('Existing approval (Test Zap)')).toBeTruthy()
    expect(screen.queryByText('You Will Deposit')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Use full ASSET balance' }))
    expect(setPercentage).toHaveBeenCalledWith(100)

    expect(hasStakingDepositFlow(stakingConfig)).toBe(true)
    expect(screen.getByText('Automatic staking off.')).toBeTruthy()
    fireEvent.click(screen.getByRole('switch', { name: 'Turn on automatic staking' }))
    expect(setSettings).toHaveBeenCalledWith(expect.objectContaining({ autoStake: true }))
  })

  it('uses the full position balance and sentence-case labels when withdrawing', () => {
    const setPercentage = vi.fn()
    useController.mockReturnValue(
      createController({
        account: '0x3333333333333333333333333333333333333333',
        amount: '2',
        balance: 2_000_000_000_000_000_000n,
        mode: 'withdraw',
        quote: {
          adapterId: 'direct',
          amountIn: 2_000_000_000_000_000_000n,
          expectedOut: 2_000_000_000_000_000_000n,
          minExpectedOut: 2_000_000_000_000_000_000n,
          positionAmount: 2_000_000_000_000_000_000n,
          transaction: {
            chainId: 1,
            data: '0x1234',
            to: '0x4444444444444444444444444444444444444444'
          }
        },
        setPercentage
      })
    )

    renderWidget(<VaultWidget chainId={1} config={config} vaultAddress={config.vaultAddress} />)

    expect(screen.getByText('You will redeem')).toBeTruthy()
    expect(screen.getByText('You will receive')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Use full ASSET balance' }))
    expect(setPercentage).toHaveBeenCalledWith(100)
  })

  it.each<{
    description: string
    execution: VaultWidgetExecutionState
    title: string
  }>([
    {
      description: 'Deposit assets (1/2)',
      execution: {
        status: 'confirming',
        step: { id: 'deposit', kind: 'execute', label: 'Deposit assets' },
        stepCount: 2,
        stepIndex: 0
      },
      title: 'Confirm in your wallet'
    },
    {
      description: 'Execution may happen separately after the required Safe confirmations are collected.',
      execution: {
        status: 'pending',
        step: { id: 'safe', kind: 'safe-proposal', label: 'Propose deposit' },
        stepCount: 1,
        stepIndex: 0,
        proposalId: '0x1234'
      },
      title: 'Transaction submitted'
    },
    {
      description: 'Waiting for destination-chain completion.',
      execution: {
        status: 'submitted',
        step: { id: 'bridge', kind: 'wait-cross-chain', label: 'Complete bridge' },
        stepCount: 2,
        stepIndex: 1,
        hash: '0x1111111111111111111111111111111111111111111111111111111111111111'
      },
      title: 'Cross-chain transaction submitted'
    }
  ])('renders the $title execution state as a widget-bounded dialog', ({ description, execution, title }) => {
    useController.mockReturnValue(
      createController({
        account: '0x3333333333333333333333333333333333333333',
        execution
      })
    )

    renderWidget(<VaultWidget chainId={1} config={config} vaultAddress={config.vaultAddress} />)

    const dialog = screen.getByRole('dialog', { name: title })
    expect(dialog.closest('.yv-widget')).toBe(screen.getByRole('region'))
    expect(dialog.textContent).toContain(description)
    expect(screen.getByRole('button', { hidden: true, name: 'Deposit' }).hasAttribute('disabled')).toBe(true)
  })
})

describe('getNextVaultActionTabIndex', () => {
  it('wraps arrows and supports tablist boundaries', () => {
    expect(getNextVaultActionTabIndex('ArrowRight', 2, 3)).toBe(0)
    expect(getNextVaultActionTabIndex('ArrowLeft', 0, 3)).toBe(2)
    expect(getNextVaultActionTabIndex('Home', 2, 3)).toBe(0)
    expect(getNextVaultActionTabIndex('End', 0, 3)).toBe(2)
    expect(getNextVaultActionTabIndex('Enter', 0, 3)).toBeUndefined()
  })
})
