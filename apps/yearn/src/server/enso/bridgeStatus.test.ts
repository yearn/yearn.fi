import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET, normalizeRelayBridgeStatusResponse } from '@/server/enso/bridgeStatus'

const TX_HASH = `0x${'a'.repeat(64)}`
const REQUEST_ID = `0x${'c'.repeat(64)}`

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

  it('proxies non-Relay source transactions to Enso with the configured API key', async () => {
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

    const response = await GET(request({ protocol: 'ccip', chainId: '1', txHash: TX_HASH }))

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.enso.finance/api/v1/ccip/bridge/check?chainId=1&txHash=${TX_HASH}`,
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

  it('passes through a recoverable manual-execution status', async () => {
    vi.stubEnv('ENSO_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ status: 'ready_for_manual_execution' })))

    const response = await GET(request({ protocol: 'stargate', chainId: '1', txHash: TX_HASH }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ status: 'ready_for_manual_execution' })
  })

  it('uses Relay delivery status instead of a stale Enso pending snapshot', async () => {
    vi.stubEnv('ENSO_API_KEY', 'test-key')
    const destinationTxHash = `0x${'b'.repeat(64)}`
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          requests: [{ id: REQUEST_ID }]
        })
      )
      .mockResolvedValueOnce(
        Response.json({ status: 'success', destinationChainId: 747474, txHashes: [destinationTxHash] })
      )
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(request({ protocol: 'relay', chainId: '8453', txHash: TX_HASH }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      status: 'delivered',
      bridgeRequestId: REQUEST_ID,
      sourceChainId: 8453,
      sourceTxHash: TX_HASH,
      destinationChainId: 747474,
      destinationTxHash
    })
    expect(fetchMock).toHaveBeenNthCalledWith(1, `https://api.relay.link/requests/v2?hash=${TX_HASH}`, {
      cache: 'force-cache',
      next: { revalidate: 10 }
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, `https://api.relay.link/intents/status/v3?requestId=${REQUEST_ID}`, {
      cache: 'force-cache',
      next: { revalidate: 10 }
    })
  })

  it('recovers a missing source hash from a persisted Relay request ID', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ status: 'pending', destinationChainId: 747474, inTxHashes: [TX_HASH] }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET(request({ protocol: 'relay', chainId: '8453', requestId: REQUEST_ID }))

    await expect(response.json()).resolves.toMatchObject({
      status: 'inflight',
      bridgeRequestId: REQUEST_ID,
      sourceTxHash: TX_HASH
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.relay.link/intents/status/v3?requestId=${REQUEST_ID}`,
      expect.any(Object)
    )
  })

  it('keeps the Enso response when Relay has no matching request', async () => {
    vi.stubEnv('ENSO_API_KEY', 'test-key')
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ requests: [] }))
        .mockResolvedValueOnce(Response.json({ status: 'unknown' }))
    )

    const response = await GET(request({ protocol: 'relay', chainId: '8453', txHash: TX_HASH }))

    await expect(response.json()).resolves.toEqual({ status: 'unknown' })
  })
})

describe('Relay bridge status normalization', () => {
  it('maps failed Relay requests without exposing placeholder failure text', () => {
    expect(
      normalizeRelayBridgeStatusResponse(
        { status: 'failure', failReason: 'N/A', txHashes: [] },
        8453,
        TX_HASH,
        REQUEST_ID
      )
    ).toEqual({
      status: 'failed',
      bridgeRequestId: REQUEST_ID,
      sourceChainId: 8453,
      sourceTxHash: TX_HASH,
      error: 'Relay transfer failed.'
    })
  })

  it('maps active Relay settlement statuses to inflight', () => {
    for (const status of ['depositing', 'pending', 'submitted', 'delayed']) {
      expect(normalizeRelayBridgeStatusResponse({ status }, 8453, TX_HASH, REQUEST_ID)?.status).toBe('inflight')
    }
  })
})
