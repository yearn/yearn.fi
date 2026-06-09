import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from './invalidate-cache'

const { invalidateVaultsMock, isHoldingsStorageEnabledMock } = vi.hoisted(() => ({
  invalidateVaultsMock: vi.fn(),
  isHoldingsStorageEnabledMock: vi.fn()
}))

vi.mock('../lib/holdings/services/cache', () => ({
  invalidateVaults: invalidateVaultsMock
}))

vi.mock('../lib/holdings/storage/redis', () => ({
  isHoldingsStorageEnabled: isHoldingsStorageEnabledMock
}))

const ORIGINAL_ENV = { ...process.env }

function createResponse() {
  const headers = new Map<string, string>()
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    ended: false,
    setHeader: vi.fn((key: string, value: string) => {
      headers.set(key, value)
      return res
    }),
    status: vi.fn((statusCode: number) => {
      res.statusCode = statusCode
      return res
    }),
    json: vi.fn((body: unknown) => {
      res.body = body
      return res
    }),
    end: vi.fn(() => {
      res.ended = true
      return res
    }),
    getHeader: (key: string) => headers.get(key)
  }

  return res as typeof res & VercelResponse
}

describe('admin cache invalidation CORS', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...ORIGINAL_ENV, ADMIN_SECRET: 'test-secret' }
    isHoldingsStorageEnabledMock.mockReturnValue(true)
    invalidateVaultsMock.mockResolvedValue(1)
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('reflects allowlisted origins without wildcard CORS', async () => {
    process.env.ADMIN_ALLOWED_ORIGINS = 'https://preview.example'
    const res = createResponse()

    await handler(
      {
        method: 'OPTIONS',
        headers: { origin: 'https://preview.example' }
      } as VercelRequest,
      res
    )

    expect(res.status).toHaveBeenCalledWith(204)
    expect(res.getHeader('Access-Control-Allow-Origin')).toBe('https://preview.example')
    expect(res.getHeader('Vary')).toBe('Origin')
  })

  it('rejects unallowlisted browser origins without CORS headers', async () => {
    const res = createResponse()

    await handler(
      {
        method: 'POST',
        headers: { origin: 'https://evil.example', 'x-admin-secret': 'test-secret' },
        body: {
          vaults: [{ address: '0xBe53A109B494E5c9f97b9Cd39Fe969BE68BF6204', chainId: 1 }]
        }
      } as VercelRequest,
      res
    )

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.body).toEqual({ error: 'Origin not allowed' })
    expect(res.getHeader('Access-Control-Allow-Origin')).toBeUndefined()
    expect(invalidateVaultsMock).not.toHaveBeenCalled()
  })
})
