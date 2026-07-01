import { IframeAutoConnect } from '@components/IframeAutoConnect'
import { isIframe, isTrustedEmbed } from '@shared/utils/helpers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAccount, useConnect, useDisconnect } from 'wagmi'

vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
  useConnect: vi.fn(),
  useDisconnect: vi.fn()
}))

vi.mock('@shared/hooks/useAsyncTrigger', () => ({
  useAsyncTrigger: vi.fn((effect: () => Promise<void>) => {
    void effect()
    return effect
  })
}))

vi.mock('@shared/utils/helpers', async () => {
  const actual = await vi.importActual<typeof import('@shared/utils/helpers')>('@shared/utils/helpers')

  return {
    ...actual,
    isIframe: vi.fn(),
    isTrustedEmbed: vi.fn()
  }
})

const connectAsync = vi.fn()
const disconnectAsync = vi.fn()
const safeConnector = {
  id: 'safe',
  isAuthorized: vi.fn().mockResolvedValue(false)
}
const originalWindow = globalThis.window

function mockWindow(ancestorOrigins: string[] = []): void {
  ;(globalThis as unknown as { window: { location: { ancestorOrigins: string[] } } }).window = {
    location: { ancestorOrigins }
  }
}

function mockWalletHooks(connector?: { id: string }): void {
  vi.mocked(useAccount).mockReturnValue({ connector } as ReturnType<typeof useAccount>)
  vi.mocked(useConnect).mockReturnValue({
    connectors: [safeConnector],
    connectAsync
  } as unknown as ReturnType<typeof useConnect>)
  vi.mocked(useDisconnect).mockReturnValue({ disconnectAsync } as unknown as ReturnType<typeof useDisconnect>)
}

describe('IframeAutoConnect', () => {
  afterEach(() => {
    vi.clearAllMocks()
    ;(globalThis as unknown as { window: typeof originalWindow }).window = originalWindow
  })

  it('does not connect in an arbitrary iframe when a Safe connector exists', () => {
    mockWindow()
    mockWalletHooks()
    vi.mocked(isIframe).mockReturnValue(true)
    vi.mocked(isTrustedEmbed).mockReturnValue(false)

    IframeAutoConnect({ children: <div>child</div> })

    expect(connectAsync).not.toHaveBeenCalled()
    expect(disconnectAsync).not.toHaveBeenCalled()
  })

  it('connects the Safe connector only in a trusted iframe', async () => {
    mockWindow(['https://app.safe.global'])
    mockWalletHooks()
    vi.mocked(isIframe).mockReturnValue(true)
    vi.mocked(isTrustedEmbed).mockReturnValue(true)

    IframeAutoConnect({ children: <div>child</div> })

    await vi.waitFor(() => expect(connectAsync).toHaveBeenCalledWith({ connector: safeConnector }))
    expect(disconnectAsync).not.toHaveBeenCalled()
  })
})
