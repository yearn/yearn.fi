import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  mockOptions: undefined as unknown
}))

vi.mock('wagmi', () => ({
  createConnector: (connector: unknown) => connector
}))

vi.mock('wagmi/connectors', () => ({
  mock: (options: unknown) => {
    mocks.mockOptions = options
    return () => ({ id: 'mock', name: 'Mock Connector', type: 'mock' })
  }
}))

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_AGENT_WALLET_ADDRESS: undefined,
    PROD: false
  }
}))

describe('agent wallet connector', () => {
  beforeEach(() => {
    mocks.mockOptions = undefined
  })

  it('creates a raw Wagmi connector with the stable development identity', async () => {
    const { AGENT_WALLET_ID, agentWallet } = await import('@/config/agentWallet')
    const connector = agentWallet()
    const configuredConnector = connector({} as never)

    expect(mocks.mockOptions).toEqual({
      accounts: ['0x000000000000000000000000000000000000c0DE'],
      features: {
        defaultConnected: false,
        reconnect: true
      }
    })
    expect(configuredConnector).toMatchObject({
      id: AGENT_WALLET_ID,
      name: 'Agent Wallet',
      type: 'mock'
    })
    expect(configuredConnector.icon).toMatch(/^data:image\/svg\+xml/)
  })
})
