import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/server/enso/bridgeStatus'

const TX_HASH = `0x${'a'.repeat(64)}`

function request(query: Record<string, string>): Request {
  return new Request(`https://yearn.fi/api/enso/bridge-status?${new URLSearchParams(query)}`)
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('Enso bridge status proxy', () => {
  it('rejects protocols outside the documented allowlist', async () => {
    const response = await GET(request({ protocol: 'across', chainId: '1', txHash: TX_HASH }))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Unsupported bridge protocol' })
  })

  it('validates the source chain and transaction hash', async () => {
    expect((await GET(request({ protocol: 'relay', chainId: '0', txHash: TX_HASH }))).status).toBe(400)
    expect((await GET(request({ protocol: 'relay', chainId: '1', txHash: '0x1234' }))).status).toBe(400)
  })

  it('proxies the source transaction to Enso with the configured API key', async () => {
    vi.stubEnv('ENSO_API_KEY', 'test-key')
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        status: 'delivered',
        sourceChainId: 1,
        sourceTxHash: TX_HASH,
        destinationChainId: 8453,
        destinationTxHash: `0x${'b'.repeat(64)}`
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(request({ protocol: 'relay', chainId: '1', txHash: TX_HASH }))

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.enso.finance/api/v1/relay/bridge/check?chainId=1&txHash=${TX_HASH}`,
      {
        headers: { Authorization: 'Bearer test-key' },
        cache: 'force-cache',
        next: { revalidate: 10 }
      }
    )
  })

  it('rejects an unrecognized upstream status', async () => {
    vi.stubEnv('ENSO_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ status: 'complete' })))

    expect((await GET(request({ protocol: 'ccip', chainId: '1', txHash: TX_HASH }))).status).toBe(502)
  })
})
