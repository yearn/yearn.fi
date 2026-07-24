import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEnsoBridgeStatusHandler } from './index'

const txHash = `0x${'1'.repeat(64)}`

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createEnsoBridgeStatusHandler', () => {
  it('proxies a validated bridge status request to its protocol endpoint', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ status: 'pending' }))
    vi.stubGlobal('fetch', fetcher)
    const handler = createEnsoBridgeStatusHandler({
      apiBaseUrl: 'https://api.example.test',
      apiKey: 'secret'
    })

    const response = await handler(
      new Request(`https://yearn.test/api/enso/bridge-status?protocol=ccip&chainId=1&txHash=${txHash}`)
    )

    expect(response.status).toBe(200)
    const [input, init] = fetcher.mock.calls[0]!
    expect(input.toString()).toBe(`https://api.example.test/api/v1/ccip/bridge/check?chainId=1&txHash=${txHash}`)
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer secret' })
  })

  it('rejects unsupported protocols before proxying', async () => {
    const fetcher = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetcher)
    const handler = createEnsoBridgeStatusHandler({ apiKey: 'secret' })

    const response = await handler(
      new Request(`https://yearn.test/api/enso/bridge-status?protocol=other&chainId=1&txHash=${txHash}`)
    )

    expect(response.status).toBe(400)
    expect(fetcher).not.toHaveBeenCalled()
  })
})
