// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import type { CSSProperties, ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VaultWidgetConfig, VaultWidgetToken } from '../types'
import { VaultWidget } from './VaultWidget'

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
        copy={{ amount: 'Quantity', connect: 'Link wallet' }}
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
})
