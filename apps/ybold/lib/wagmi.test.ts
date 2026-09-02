import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  adapterOptions: undefined as unknown,
  appKitOptions: undefined as unknown,
  wagmiConfig: { id: 'adapter-owned-wagmi-config' }
}))

vi.mock('@reown/appkit-adapter-wagmi', () => ({
  WagmiAdapter: class {
    wagmiConfig = mocks.wagmiConfig

    constructor(options: unknown) {
      mocks.adapterOptions = options
    }
  }
}))

vi.mock('@reown/appkit/react', () => ({
  createAppKit: (options: unknown) => {
    mocks.appKitOptions = options
    return { id: 'appkit' }
  }
}))

vi.mock('wagmi', () => ({
  http: (url: string) => ({ type: 'http', url })
}))

describe('yBOLD Wagmi adapter initialization', () => {
  beforeEach(() => {
    mocks.adapterOptions = undefined
    mocks.appKitOptions = undefined
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses one AppKit adapter config for connection and vault execution', async () => {
    vi.stubEnv('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID', '  reown-project  ')
    vi.stubEnv('NEXT_PUBLIC_RPC_URL', '  https://rpc.example  ')

    const wallet = await import('@ybold/lib/wagmi')

    expect(mocks.adapterOptions).toMatchObject({
      customRpcUrls: {
        'eip155:1': [{ url: 'https://rpc.example' }]
      },
      networks: [{ id: 1 }],
      projectId: 'reown-project',
      ssr: true,
      transports: {
        1: { type: 'http', url: 'https://rpc.example' }
      }
    })
    expect(mocks.appKitOptions).toMatchObject({
      adapters: [wallet.wagmiAdapter],
      customRpcUrls: {
        'eip155:1': [{ url: 'https://rpc.example' }]
      },
      enableReconnect: true,
      projectId: 'reown-project'
    })
    expect(wallet.wagmiConfig).toBe(mocks.wagmiConfig)
  })

  it('fails before creating a partial wallet stack without a project ID', async () => {
    vi.stubEnv('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID', ' ')

    await expect(import('@ybold/lib/wagmi')).rejects.toThrow(
      'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is required to initialize Reown AppKit'
    )
    expect(mocks.adapterOptions).toBeUndefined()
    expect(mocks.appKitOptions).toBeUndefined()
  })
})
