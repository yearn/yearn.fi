import { afterEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/server/admin/invalidate-cache'

vi.mock('@/server/lib/holdings', () => ({
  isHoldingsStorageEnabled: () => false
}))

function request(secret?: string): Request {
  return new Request('https://yearn.fi/api/admin/invalidate-cache', {
    method: 'POST',
    headers: secret === undefined ? {} : { 'x-admin-secret': secret },
    body: JSON.stringify({ vaults: [] })
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('admin invalidate-cache auth', () => {
  it('returns 503 when no admin secret is configured', async () => {
    vi.stubEnv('ADMIN_SECRET', '')

    expect((await POST(request('anything'))).status).toBe(503)
  })

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['wrong', 'not-the-secret'],
    ['prefix', 'expected-secre'],
    ['longer', 'expected-secret-and-more']
  ])('rejects a %s secret', async (_label, secret) => {
    vi.stubEnv('ADMIN_SECRET', 'expected-secret')

    expect((await POST(request(secret))).status).toBe(401)
  })

  it('accepts the matching secret', async () => {
    vi.stubEnv('ADMIN_SECRET', 'expected-secret')

    // Past the auth gate, the mocked storage check is the next thing to respond.
    expect((await POST(request('expected-secret'))).status).toBe(503)
  })
})
