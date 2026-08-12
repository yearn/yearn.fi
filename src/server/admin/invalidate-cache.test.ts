import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  ensureStorage: vi.fn(),
  isStorageEnabled: vi.fn(),
  invalidateVaults: vi.fn(),
  appendLedgerInvalidation: vi.fn(),
  getLedgerRedis: vi.fn(),
  getRedis: vi.fn()
}))

vi.mock('../lib/holdings', () => ({
  ensureHoldingsStorageInitialized: mocks.ensureStorage,
  isHoldingsStorageEnabled: mocks.isStorageEnabled
}))

vi.mock('../lib/holdings/services/cache', () => ({
  invalidateVaults: mocks.invalidateVaults
}))

vi.mock('../lib/holdings/services/ledger/walletInvalidation', () => ({
  appendWalletLedgerInvalidation: mocks.appendLedgerInvalidation
}))

vi.mock('../lib/holdings/storage/ledgerRedis', () => ({
  getHoldingsLedgerRedisClient: mocks.getLedgerRedis
}))

vi.mock('../lib/holdings/storage/redis', () => ({
  getHoldingsRedisClient: mocks.getRedis
}))

import { POST } from './invalidate-cache'

const VAULT = '0x1111111111111111111111111111111111111111'

function request(body: unknown, options?: { baseUrl?: string; secret?: string | null }): Request {
  const secret = options?.secret === undefined ? 'test-secret' : options.secret
  return new Request(`${options?.baseUrl ?? 'http://localhost'}/api/admin/invalidate-cache`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(secret === null ? {} : { 'x-admin-secret': secret })
    },
    body: JSON.stringify(body)
  })
}

describe('admin cache invalidation', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_SECRET', 'test-secret')
    mocks.ensureStorage.mockResolvedValue(undefined)
    mocks.isStorageEnabled.mockReturnValue(true)
    mocks.invalidateVaults.mockResolvedValue(1)
    mocks.getLedgerRedis.mockReturnValue({ marker: 'ledger-redis' })
    mocks.getRedis.mockReturnValue({ marker: 'redis' })
    mocks.appendLedgerInvalidation.mockResolvedValue(7)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('publishes a sequenced ledger invalidation and defaults the historical scan to block zero', async () => {
    const response = await POST(request({ vaults: [{ address: VAULT, chainId: 1 }] }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      invalidated: 1,
      ledgerInvalidationSequence: 7
    })
    expect(mocks.appendLedgerInvalidation).toHaveBeenCalledWith({
      redis: { marker: 'ledger-redis' },
      vaults: [{ address: VAULT, chainId: 1, fromBlock: 0 }]
    })
  })

  it('falls back to the legacy Redis client while ledger mode is disabled', async () => {
    mocks.getLedgerRedis.mockReturnValue(null)

    const response = await POST(request({ vaults: [{ address: VAULT, chainId: 1 }] }))

    expect(response.status).toBe(200)
    expect(mocks.appendLedgerInvalidation).toHaveBeenCalledWith(expect.objectContaining({ redis: { marker: 'redis' } }))
  })

  it('publishes the supplied earliest backfill block', async () => {
    const response = await POST(request({ vaults: [{ address: VAULT, chainId: 1, fromBlock: 12_345 }] }))

    expect(response.status).toBe(200)
    expect(mocks.appendLedgerInvalidation).toHaveBeenCalledWith(
      expect.objectContaining({
        vaults: [{ address: VAULT, chainId: 1, fromBlock: 12_345 }]
      })
    )
  })

  it('rejects an unsafe historical block before touching Redis', async () => {
    const response = await POST(request({ vaults: [{ address: VAULT, chainId: 1, fromBlock: -1 }] }))

    expect(response.status).toBe(400)
    expect(mocks.invalidateVaults).not.toHaveBeenCalled()
    expect(mocks.appendLedgerInvalidation).not.toHaveBeenCalled()
  })

  it('rejects a non-positive chain before touching Redis', async () => {
    const response = await POST(request({ vaults: [{ address: VAULT, chainId: 0 }] }))

    expect(response.status).toBe(400)
    expect(mocks.invalidateVaults).not.toHaveBeenCalled()
    expect(mocks.appendLedgerInvalidation).not.toHaveBeenCalled()
  })

  it('allows a development loopback request without an admin secret', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('ADMIN_SECRET', '')

    const response = await POST(request({ vaults: [{ address: VAULT, chainId: 1 }] }, { secret: null }))

    expect(response.status).toBe(200)
  })

  it('keeps non-loopback development requests protected', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('ADMIN_SECRET', '')

    const response = await POST(
      request({ vaults: [{ address: VAULT, chainId: 1 }] }, { baseUrl: 'https://yearn.example', secret: null })
    )

    expect(response.status).toBe(503)
    expect(mocks.invalidateVaults).not.toHaveBeenCalled()
  })

  it('does not publish the ledger invalidation when legacy invalidation fails', async () => {
    mocks.invalidateVaults.mockResolvedValue(0)

    const response = await POST(request({ vaults: [{ address: VAULT, chainId: 1 }] }))

    expect(response.status).toBe(500)
    expect(mocks.appendLedgerInvalidation).not.toHaveBeenCalled()
  })
})
