// @vitest-environment jsdom

import { useWeb3, Web3ContextApp } from '@shared/contexts/useWeb3'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  account: {
    address: undefined as `0x${string}` | undefined,
    chain: { id: 1 },
    connector: { id: 'io.rabby', name: 'Rabby' },
    isConnected: false,
    isConnecting: false
  },
  drawer: {
    isConnecting: false,
    openWalletDrawer: vi.fn(),
    closeWalletDrawer: vi.fn()
  },
  disconnect: vi.fn(),
  track: vi.fn(),
  connectAsync: vi.fn(),
  connectors: []
}))

vi.mock('@hooks/usePlausible', () => ({ usePlausible: () => mocks.track }))
vi.mock('@yearn/wallet-ui', () => ({ useWalletDrawer: () => mocks.drawer }))
vi.mock('@yearn/wallet-ui/useWalletDisconnect', () => ({
  useWalletDisconnect: () => ({ disconnect: mocks.disconnect })
}))
vi.mock('wagmi', () => ({
  useAccount: () => mocks.account,
  useConnect: () => ({ connectors: mocks.connectors, connectAsync: mocks.connectAsync }),
  useEnsName: () => ({ data: 'example.eth', isLoading: false })
}))
vi.mock('@shared/utils', () => ({
  fetchClusterName: vi.fn(),
  getClusterImageUrl: vi.fn(),
  isAddress: (address: string | undefined) => Boolean(address),
  isSafeConnectorId: (id: string) => id === 'safe'
}))
vi.mock('@shared/utils/helpers', () => ({ isIframe: () => false }))
vi.mock('@shared/utils/tools.address', () => ({ toAddress: (address: string) => address }))
vi.mock('@/config/agentWallet', () => ({ AGENT_WALLET_ID: 'agent', shouldAutoConnectAgentWallet: () => false }))
vi.mock('@/config/tenderly', () => ({
  resolveConnectedCanonicalChainId: (chainId: number) => chainId,
  resolveExecutionChainId: (chainId: number) => chainId
}))

function Probe() {
  const { isUserConnecting, openLoginModal, onDesactivate } = useWeb3()
  return (
    <>
      <button type="button" onClick={openLoginModal}>
        {isUserConnecting ? 'Connecting…' : 'Connect wallet'}
      </button>
      <button type="button" onClick={onDesactivate}>
        Disconnect
      </button>
    </>
  )
}

function Subject() {
  return (
    <StrictMode>
      <Web3ContextApp>
        <Probe />
      </Web3ContextApp>
    </StrictMode>
  )
}

function connectAccount(): void {
  mocks.account.isConnected = true
  mocks.account.isConnecting = false
  mocks.account.address = '0x1111111111111111111111111111111111111111'
}

describe('wallet connection integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.account.address = undefined
    mocks.account.isConnected = false
    mocks.account.isConnecting = false
    mocks.account.chain = { id: 1 }
    mocks.drawer.isConnecting = false
  })
  afterEach(cleanup)

  it('opens immediately and clears our pending label when the picker attempt ends', () => {
    const view = render(<Subject />)
    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }))
    expect(mocks.drawer.openWalletDrawer).toHaveBeenCalledOnce()
    expect(mocks.track).not.toHaveBeenCalled()

    mocks.account.isConnecting = true
    mocks.drawer.isConnecting = true
    view.rerender(<Subject />)
    expect(screen.getByRole('button', { name: 'Connecting…' })).toBeTruthy()

    // Closing QR or rejecting an extension can leave the transport promise pending.
    mocks.drawer.isConnecting = false
    view.rerender(<Subject />)
    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }))
    expect(mocks.drawer.openWalletDrawer).toHaveBeenCalledTimes(2)
    expect(mocks.track).not.toHaveBeenCalled()
  })

  it('leaves picker connection tracking to the shared drawer and ignores reconnect', () => {
    const view = render(<Subject />)
    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }))
    connectAccount()
    view.rerender(<Subject />)
    view.rerender(<Subject />)
    expect(mocks.track).not.toHaveBeenCalled()

    mocks.account.isConnected = false
    view.rerender(<Subject />)
    connectAccount()
    view.rerender(<Subject />)
    expect(mocks.track).not.toHaveBeenCalled()
  })

  it('does not track restored connections and clears requested tracking when disconnected', () => {
    connectAccount()
    const view = render(<Subject />)
    expect(mocks.track).not.toHaveBeenCalled()
    mocks.account.isConnected = false
    view.rerender(<Subject />)
    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }))
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }))
    expect(mocks.drawer.closeWalletDrawer).toHaveBeenCalledOnce()
    expect(mocks.disconnect).toHaveBeenCalledOnce()
    connectAccount()
    view.rerender(<Subject />)
    expect(mocks.track.mock.calls).toEqual([['disconnect_wallet', { props: { chainID: '1' } }]])
  })
})
