// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { Providers } from '@ybold/app/providers'
import { useVaultWidgetRuntime } from '@yearn/vault-widget/runtime'
import type { ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ connectorId: 'safepal' }))
function Passthrough({ children }: { children: ReactNode }) {
  return children
}

vi.mock('@rainbow-me/rainbowkit', () => ({ RainbowKitProvider: Passthrough }))
vi.mock('@yearn/wallet-ui/rainbowkit', () => ({ getYearnRainbowTheme: () => ({}) }))
vi.mock('@yearn/wallet-ui', () => ({
  WalletProvider: Passthrough,
  WalletDrawerProvider: Passthrough,
  useWalletDrawer: () => ({ openWalletDrawer: vi.fn(), isConnecting: false })
}))
vi.mock('@ybold/components/WalletActivityProvider', () => ({
  WalletActivityProvider: Passthrough,
  useWalletActivity: () => ({ notifications: {} })
}))
vi.mock('@ybold/lib/analytics', () => ({ initializeAnalytics: vi.fn(), trackAnalytics: vi.fn() }))
vi.mock('@ybold/lib/wagmi', () => ({ wagmiConfig: {} }))
vi.mock('@yearn/vault-widget/wagmi', () => ({ createWagmiVaultWidgetExecutionAdapter: () => ({}) }))
vi.mock('wagmi', () => ({
  useAccount: () => ({ connector: { id: mocks.connectorId }, status: 'connected', chainId: 1 })
}))

function Probe() {
  const runtime = useVaultWidgetRuntime()
  return <output>{runtime.safe.isSafe ? 'Safe execution' : 'Standard execution'}</output>
}

afterEach(cleanup)

it.each(['safepal', 'safeheron', 'io.rabby', 'safe', 'SAFE'])('selects the correct execution path for %s', (id) => {
  mocks.connectorId = id
  render(
    <Providers>
      <Probe />
    </Providers>
  )
  expect(screen.getByRole('status').textContent).toBe(
    id.toLowerCase() === 'safe' ? 'Safe execution' : 'Standard execution'
  )
})
