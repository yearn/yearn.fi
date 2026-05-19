import { describe, expect, it } from 'vitest'
import {
  buildTenderlyAdminAccessDeniedResponse,
  isLoopbackAddress,
  isLoopbackOrigin,
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
  const allowedRequest = {
    adminSecret: 'secret',
    providedSecret: 'secret',
    requestIpAddress: '127.0.0.1',
    requestOrigin: 'http://localhost:3000'
  }

  it('allows loopback requests with the configured admin secret', () => {
    expect(isTenderlyAdminRequestAllowed(allowedRequest)).toBe(true)
    expect(
      isTenderlyAdminRequestAllowed({
        ...allowedRequest,
        requestIpAddress: '::1'
      })
    ).toBe(true)
    expect(
      isTenderlyAdminRequestAllowed({
        ...allowedRequest,
        requestIpAddress: '::ffff:127.0.0.1'
      })
    ).toBe(true)
  })

  it('rejects requests without the configured admin secret', () => {
    expect(isTenderlyAdminRequestAllowed({ ...allowedRequest, adminSecret: '' })).toBe(false)
    expect(isTenderlyAdminRequestAllowed({ ...allowedRequest, providedSecret: 'wrong' })).toBe(false)
  })

  it('rejects non-loopback clients and origins', () => {
    expect(isTenderlyAdminRequestAllowed({ ...allowedRequest, requestIpAddress: '10.0.0.8' })).toBe(false)
    expect(isTenderlyAdminRequestAllowed({ ...allowedRequest, requestOrigin: 'https://example.com' })).toBe(false)
  })

  it('reports the reason a Tenderly admin request was denied', async () => {
    const remoteClientResponse = buildTenderlyAdminAccessDeniedResponse({
      ...allowedRequest,
      requestIpAddress: '10.0.0.8'
    })
    expect(remoteClientResponse?.status).toBe(403)
    await expect(remoteClientResponse?.json()).resolves.toEqual({
      error: 'Tenderly admin routes are only available from localhost'
    })

    const remoteOriginResponse = buildTenderlyAdminAccessDeniedResponse({
      ...allowedRequest,
      requestOrigin: 'https://example.com'
    })
    expect(remoteOriginResponse?.status).toBe(403)
    await expect(remoteOriginResponse?.json()).resolves.toEqual({
      error: 'Tenderly admin requests must come from a localhost origin'
    })

    const missingSecretResponse = buildTenderlyAdminAccessDeniedResponse({ ...allowedRequest, adminSecret: '' })
    expect(missingSecretResponse?.status).toBe(503)
    await expect(missingSecretResponse?.json()).resolves.toEqual({
      error: 'Tenderly admin routes require TENDERLY_ADMIN_SECRET'
    })

    const badSecretResponse = buildTenderlyAdminAccessDeniedResponse({ ...allowedRequest, providedSecret: 'wrong' })
    expect(badSecretResponse?.status).toBe(401)
    await expect(badSecretResponse?.json()).resolves.toEqual({
      error: 'Unauthorized'
    })
  })
})

describe('isLoopbackOrigin', () => {
  it('accepts localhost origins and non-browser requests without an origin', () => {
    expect(isLoopbackOrigin(undefined)).toBe(true)
    expect(isLoopbackOrigin('')).toBe(true)
    expect(isLoopbackOrigin('http://localhost:3000')).toBe(true)
    expect(isLoopbackOrigin('http://127.0.0.1:3000')).toBe(true)
    expect(isLoopbackOrigin('http://[::1]:3000')).toBe(true)
  })

  it('accepts same-origin private preview requests', () => {
    expect(isLoopbackOrigin('https://preview.example:8458', 'preview.example:8458')).toBe(true)
  })

  it('rejects remote or invalid origins', async () => {
    expect(isLoopbackOrigin('https://example.com')).toBe(false)
    expect(isLoopbackOrigin('not a url')).toBe(false)

    const response = buildTenderlyAdminAccessDeniedResponse({
      adminSecret: 'secret',
      providedSecret: 'secret',
      requestIpAddress: '127.0.0.1',
      requestOrigin: 'https://example.com'
    })
    expect(response?.status).toBe(403)
    await expect(response?.json()).resolves.toEqual({
      error: 'Tenderly admin requests must come from a localhost origin'
    })
  })
})
