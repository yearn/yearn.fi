import { afterEach, describe, expect, it, vi } from 'vitest'
import { getRequestIp } from './http'
import {
  buildTenderlyAdminAccessDeniedResponse,
  isLoopbackAddress,
  isTenderlyAdminRequestAllowed
} from './tenderlyAccess'

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
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  function requestWithHost(host: string): Request {
    return { headers: new Headers({ host }) } as Request
  }

  it('denies a remote request to a non-Vercel development server', () => {
    vi.stubEnv('VERCEL', '')
    vi.stubEnv('NODE_ENV', 'development')

    const requestIp = getRequestIp(requestWithHost('preview.example.com'))

    expect(requestIp).toBeUndefined()
    expect(buildTenderlyAdminAccessDeniedResponse(requestIp)?.status).toBe(403)
  })

  it.each(['localhost:3000', '127.0.0.1:3000', '[::1]:3000'])('allows local development on %s', (host) => {
    vi.stubEnv('VERCEL', '')
    vi.stubEnv('NODE_ENV', 'development')

    expect(buildTenderlyAdminAccessDeniedResponse(getRequestIp(requestWithHost(host)))).toBeUndefined()
  })
})
