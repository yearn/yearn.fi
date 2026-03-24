import { describe, expect, it } from 'vitest'
import {
  buildTenderlyAdminAccessDeniedResponse,
  isLoopbackHostname,
  isTenderlyAdminRequestAllowed
} from './tenderlyAccess'

describe('isLoopbackHostname', () => {
  it('accepts loopback hostnames', () => {
    expect(isLoopbackHostname('localhost')).toBe(true)
    expect(isLoopbackHostname('127.0.0.1')).toBe(true)
    expect(isLoopbackHostname('::1')).toBe(true)
  })

  it('rejects non-loopback hostnames', () => {
    expect(isLoopbackHostname('preview.example.com')).toBe(false)
    expect(isLoopbackHostname(undefined)).toBe(false)
  })
})

describe('isTenderlyAdminRequestAllowed', () => {
  it('allows direct localhost requests', () => {
    expect(isTenderlyAdminRequestAllowed(new Request('http://localhost:3001/api/tenderly/snapshot'))).toBe(true)
  })

  it('allows proxied localhost requests via x-forwarded-host', () => {
    const req = new Request('https://preview.example.com/api/tenderly/snapshot', {
      headers: {
        'x-forwarded-host': '127.0.0.1:3001'
      }
    })

    expect(isTenderlyAdminRequestAllowed(req)).toBe(true)
  })

  it('rejects remote hosts', async () => {
    const req = new Request('https://preview.example.com/api/tenderly/snapshot')

    expect(isTenderlyAdminRequestAllowed(req)).toBe(false)

    const response = buildTenderlyAdminAccessDeniedResponse(req)
    expect(response?.status).toBe(403)
    await expect(response?.json()).resolves.toEqual({
      error: 'Tenderly admin routes are only available from localhost'
    })
  })
})
