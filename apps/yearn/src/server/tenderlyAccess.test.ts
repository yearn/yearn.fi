import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getRequestIp, isLoopbackAddress } from './http'
import { POST as fundPOST } from './tenderly/fund'
import { POST as increaseTimePOST } from './tenderly/increase-time'
import { POST as revertPOST } from './tenderly/revert'
import { POST as snapshotPOST } from './tenderly/snapshot'
import { buildTenderlyAdminAccessDeniedResponse, isTenderlyAdminRequestAllowed } from './tenderlyAccess'

describe('isLoopbackAddress', () => {
  it('accepts loopback addresses', () => {
    expect(isLoopbackAddress('localhost')).toBe(true)
    expect(isLoopbackAddress('127.0.0.1')).toBe(true)
    expect(isLoopbackAddress('127.0.0.2')).toBe(true)
    expect(isLoopbackAddress('::1')).toBe(true)
    expect(isLoopbackAddress('::ffff:127.0.0.1')).toBe(true)
  })

  it('rejects non-loopback addresses', () => {
    expect(isLoopbackAddress('10.0.0.8')).toBe(false)
    expect(isLoopbackAddress(undefined)).toBe(false)
  })
})

describe('isTenderlyAdminRequestAllowed', () => {
  it('allows loopback client addresses', () => {
    expect(isTenderlyAdminRequestAllowed('127.0.0.1')).toBe(true)
    expect(isTenderlyAdminRequestAllowed('::1')).toBe(true)
    expect(isTenderlyAdminRequestAllowed('::ffff:127.0.0.1')).toBe(true)
  })

  it('rejects remote client addresses', async () => {
    expect(isTenderlyAdminRequestAllowed('10.0.0.8')).toBe(false)

    const response = buildTenderlyAdminAccessDeniedResponse('10.0.0.8')
    expect(response?.status).toBe(403)
    await expect(response?.json()).resolves.toEqual({
      error: 'Tenderly admin routes are only available from localhost'
    })
  })
})

describe('Tenderly admin gate with getRequestIp', () => {
  beforeEach(() => {
    vi.stubEnv('__NEXT_PRIVATE_ORIGIN', 'http://127.0.0.1:3000')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  function requestWithHost(host: string, forwardedFor?: string): Request {
    return new Request(`http://${host}/api/tenderly/fund`, {
      method: 'POST',
      headers: { host, ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}) },
      body: '{}'
    })
  }

  it('denies a remote request to a non-Vercel development server', () => {
    vi.stubEnv('VERCEL', '')
    vi.stubEnv('NODE_ENV', 'development')

    const requestIp = getRequestIp(requestWithHost('preview.example.com', '127.0.0.1'))

    expect(requestIp).toBeUndefined()
    expect(buildTenderlyAdminAccessDeniedResponse(requestIp)?.status).toBe(403)
  })

  it.each([
    ['localhost:3000', '::1'],
    ['127.0.0.1:3000', '127.0.0.1'],
    ['[::1]:3000', '::ffff:127.0.0.1']
  ])('allows local development on %s from socket %s', (host, socketIp) => {
    vi.stubEnv('VERCEL', '')
    vi.stubEnv('NODE_ENV', 'development')

    expect(buildTenderlyAdminAccessDeniedResponse(getRequestIp(requestWithHost(host, socketIp)))).toBeUndefined()
  })

  it.each([
    ['fund', fundPOST],
    ['increase-time', increaseTimePOST],
    ['revert', revertPOST],
    ['snapshot', snapshotPOST]
  ])('denies a proxied remote %s request that carries a loopback Host', async (_route, POST) => {
    vi.stubEnv('VERCEL', '')
    vi.stubEnv('NODE_ENV', 'development')

    const spoofed = await POST(requestWithHost('localhost:3000', '127.0.0.1, 203.0.113.5'))
    const proxied = await POST(requestWithHost('localhost:3000', '203.0.113.5'))

    expect(spoofed.status).toBe(403)
    expect(proxied.status).toBe(403)
  })

  it.each([
    ['fund', fundPOST],
    ['increase-time', increaseTimePOST],
    ['revert', revertPOST],
    ['snapshot', snapshotPOST]
  ])('denies a remote %s request forwarded through one, two or three proxies', async (_route, POST) => {
    vi.stubEnv('VERCEL', '')
    vi.stubEnv('NODE_ENV', 'development')

    const statuses = await Promise.all(
      ['203.0.113.5', '203.0.113.5, 127.0.0.1', '203.0.113.5, 127.0.0.1, ::1', '127.0.0.1, 203.0.113.5, ::1'].map(
        async (forwardedFor) => (await POST(requestWithHost('localhost:3000', forwardedFor))).status
      )
    )

    expect(statuses).toEqual([403, 403, 403, 403])
  })

  it.each([
    ['fund', fundPOST],
    ['increase-time', increaseTimePOST],
    ['revert', revertPOST],
    ['snapshot', snapshotPOST]
  ])('denies a spoofed lone loopback %s request unless the dev server is bound to loopback', async (_route, POST) => {
    vi.stubEnv('VERCEL', '')
    vi.stubEnv('NODE_ENV', 'development')

    const statuses = await Promise.all(
      ['http://localhost:3000', 'http://192.168.1.5:3000', ''].map(async (origin) => {
        vi.stubEnv('__NEXT_PRIVATE_ORIGIN', origin)
        return (await POST(requestWithHost('localhost:3000', '127.0.0.1'))).status
      })
    )

    expect(statuses).toEqual([403, 403, 403])
  })

  it.each([
    ['fund', fundPOST],
    ['increase-time', increaseTimePOST],
    ['revert', revertPOST],
    ['snapshot', snapshotPOST]
  ])('denies a %s request on Vercel that only spoofs X-Forwarded-For', async (_route, POST) => {
    vi.stubEnv('VERCEL', '1')
    vi.stubEnv('NODE_ENV', 'development')

    const spoofed = requestWithHost('localhost:3000', '127.0.0.1')
    const remote = requestWithHost('localhost:3000', '127.0.0.1')
    remote.headers.set('x-vercel-forwarded-for', '203.0.113.5')

    expect(getRequestIp(spoofed)).toBeUndefined()
    expect(getRequestIp(remote)).toBe('203.0.113.5')
    expect((await POST(spoofed)).status).toBe(403)
    expect((await POST(remote)).status).toBe(403)
  })
})
