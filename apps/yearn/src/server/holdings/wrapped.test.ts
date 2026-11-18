import type { TWrapped } from '@yearn/wrapped-contract'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/server/holdings/wrapped'

const mocks = vi.hoisted(() => ({ getWrapped: vi.fn() }))
vi.mock('@/server/lib/holdings/services/wrapped', () => ({ getWrapped: mocks.getWrapped }))
const ADDRESS = '0x1111111111111111111111111111111111111111'
const payload: TWrapped = {
  version: 2,
  address: ADDRESS,
  generatedAt: '2026-11-17T00:00:00.000Z',
  source: 'yearn-holdings',
  period: { year: 2026, start: '2026-01-01', end: '2026-11-16', partial: true },
  coverage: { isComplete: false, issues: ['Missing index coverage'], chains: [] },
  firstActivity: 1767225600,
  return: { pct: null, isComplete: false, baselineDate: null, points: [] },
  vaults: [],
  activity: { deposits: 0, withdrawals: 0, transfers: 0, monthly: [], hours: Array.from({ length: 24 }, () => 0) }
}
const request = (query = `address=${ADDRESS}`) => new Request(`https://yearn.test/api/holdings/wrapped?${query}`)
afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('main holdings Wrapped route', () => {
  it('validates addresses and rejects ambiguous years before building', async () => {
    vi.stubEnv('ENVIO_GRAPHQL_URL', 'https://envio.test')
    expect((await GET(request('address=invalid'))).status).toBe(400)
    expect((await GET(request(`address=${ADDRESS}&year=2025`))).status).toBe(400)
    expect((await GET(request(`address=${ADDRESS}&year=2026&year=2025`))).status).toBe(400)
    expect(mocks.getWrapped).not.toHaveBeenCalled()
  })
  it('distinguishes unconfigured service from an empty wallet', async () => {
    vi.stubEnv('ENVIO_GRAPHQL_URL', '')
    expect((await GET(request())).status).toBe(503)
    vi.stubEnv('ENVIO_GRAPHQL_URL', 'https://envio.test')
    mocks.getWrapped.mockResolvedValue({ ...payload, firstActivity: null })
    expect((await GET(request())).status).toBe(404)
  })
  it('serves an honest incomplete story and preserves private/no-store headers', async () => {
    vi.stubEnv('ENVIO_GRAPHQL_URL', 'https://envio.test')
    mocks.getWrapped.mockResolvedValue(payload)
    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toContain('private, no-store')
    expect((await response.json()).return.pct).toBeNull()
  })
  it('returns retryable upstream failure rather than manufacturing an empty recap', async () => {
    vi.stubEnv('ENVIO_GRAPHQL_URL', 'https://envio.test')
    mocks.getWrapped.mockRejectedValue(new Error('Provider failure'))
    const response = await GET(request())
    expect(response.status).toBe(502)
    expect(await response.json()).not.toHaveProperty('vaults')
  })
})
