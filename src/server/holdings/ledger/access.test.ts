import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getLedgerAdminAccessError } from '@/server/holdings/ledger/access'

const accessState = vi.hoisted(() => ({
  mode: 'shadow',
  storageEnabled: true
}))

vi.mock('@/server/lib/holdings/config', () => ({
  holdingsConfig: {
    get ledgerMode() {
      return accessState.mode
    }
  }
}))

vi.mock('@/server/lib/holdings/storage/ledgerRedis', () => ({
  isHoldingsLedgerStorageEnabled: () => accessState.storageEnabled
}))

function createRequest(secret?: string, baseUrl = 'https://yearn.fi'): Request {
  return new Request(`${baseUrl}/api/holdings/ledger/status`, {
    headers: secret ? { 'x-admin-secret': secret } : undefined
  })
}

describe('holdings ledger admin access', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_SECRET', 'test-admin-secret')
    vi.stubEnv('ENVIO_GRAPHQL_URL', 'https://envio.example/graphql')
    accessState.mode = 'shadow'
    accessState.storageEnabled = true
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('authenticates before revealing mode or storage availability', async () => {
    accessState.mode = 'off'
    accessState.storageEnabled = false

    const response = getLedgerAdminAccessError(createRequest('wrong-secret'))

    expect(response?.status).toBe(401)
    await expect(response?.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('fails closed when the endpoint secret is not configured', async () => {
    vi.stubEnv('ADMIN_SECRET', '')

    const response = getLedgerAdminAccessError(createRequest())

    expect(response?.status).toBe(503)
    await expect(response?.json()).resolves.toEqual({ error: 'Ledger admin endpoint not configured' })
  })

  it('requires an enabled mode, storage, and source after successful authentication', async () => {
    accessState.mode = 'off'
    const disabled = getLedgerAdminAccessError(createRequest('test-admin-secret'))
    expect(disabled?.status).toBe(503)

    accessState.mode = 'shadow'
    accessState.storageEnabled = false
    const noStorage = getLedgerAdminAccessError(createRequest('test-admin-secret'))
    expect(noStorage?.status).toBe(503)

    accessState.storageEnabled = true
    vi.stubEnv('ENVIO_GRAPHQL_URL', '')
    const noSource = getLedgerAdminAccessError(createRequest('test-admin-secret'), { requiresEnvio: true })
    expect(noSource?.status).toBe(503)
  })

  it('allows a fully configured authenticated request', () => {
    expect(getLedgerAdminAccessError(createRequest('test-admin-secret'), { requiresEnvio: true })).toBeNull()
  })

  it.each([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://[::1]:3000'
  ])('allows development loopback requests without an admin secret at %s', (baseUrl) => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('ADMIN_SECRET', '')

    expect(getLedgerAdminAccessError(createRequest(undefined, baseUrl), { requiresEnvio: true })).toBeNull()
  })

  it('keeps non-loopback development requests protected', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('ADMIN_SECRET', '')

    const response = getLedgerAdminAccessError(createRequest())

    expect(response?.status).toBe(503)
    await expect(response?.json()).resolves.toEqual({ error: 'Ledger admin endpoint not configured' })
  })

  it('keeps loopback requests protected outside development', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ADMIN_SECRET', '')

    const response = getLedgerAdminAccessError(createRequest(undefined, 'http://localhost:3000'))

    expect(response?.status).toBe(503)
    await expect(response?.json()).resolves.toEqual({ error: 'Ledger admin endpoint not configured' })
  })
})
