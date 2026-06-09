import { afterEach, describe, expect, it } from 'vitest'
import {
  buildTenderlyAdminAccessDeniedResponse,
  buildTenderlyAdminCorsPreflightResponse,
  isLoopbackAddress,
  isTenderlyAdminOriginAllowed,
  isTenderlyAdminRequestAllowed,
  withTenderlyAdminCors
} from './tenderlyAccess'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

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

describe('Tenderly admin browser-origin access', () => {
  it('allows only configured local browser origins', () => {
    expect(isTenderlyAdminOriginAllowed(null)).toBe(true)
    expect(isTenderlyAdminOriginAllowed('http://localhost:3000')).toBe(true)
    expect(isTenderlyAdminOriginAllowed('http://127.0.0.1:3000')).toBe(true)
    expect(isTenderlyAdminOriginAllowed('http://localhost:5173')).toBe(false)

    process.env.TENDERLY_ADMIN_ALLOWED_ORIGINS = 'http://localhost:5173'
    expect(isTenderlyAdminOriginAllowed('http://localhost:5173')).toBe(true)
  })

  it('reflects allowlisted origins on admin preflight responses', () => {
    const response = buildTenderlyAdminCorsPreflightResponse(
      new Request('http://localhost:3001/api/tenderly/snapshot', {
        method: 'OPTIONS',
        headers: { Origin: 'http://localhost:3000' }
      })
    )

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS')
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, x-admin-secret')
  })

  it('rejects unallowlisted browser preflights without permissive CORS', () => {
    const response = buildTenderlyAdminCorsPreflightResponse(
      new Request('http://localhost:3001/api/tenderly/snapshot', {
        method: 'OPTIONS',
        headers: { Origin: 'http://evil.localhost:3000' }
      })
    )

    expect(response.status).toBe(403)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('requires a configured admin secret for loopback mutation requests', async () => {
    process.env.TENDERLY_ADMIN_SECRET = 'test-secret'

    const missingSecret = buildTenderlyAdminAccessDeniedResponse(
      '127.0.0.1',
      new Request('http://localhost:3001/api/tenderly/snapshot', { method: 'POST' })
    )
    expect(missingSecret?.status).toBe(401)

    const validSecret = buildTenderlyAdminAccessDeniedResponse(
      '127.0.0.1',
      new Request('http://localhost:3001/api/tenderly/snapshot', {
        method: 'POST',
        headers: { 'x-admin-secret': 'test-secret' }
      })
    )
    expect(validSecret).toBeUndefined()
  })

  it('rejects unallowlisted browser mutation requests before handlers run', () => {
    process.env.TENDERLY_ADMIN_SECRET = 'test-secret'

    const response = buildTenderlyAdminAccessDeniedResponse(
      '127.0.0.1',
      new Request('http://localhost:3001/api/tenderly/snapshot', {
        method: 'POST',
        headers: {
          Origin: 'http://evil.localhost:3000',
          'x-admin-secret': 'test-secret'
        }
      })
    )

    expect(response?.status).toBe(403)
    expect(response?.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('does not add wildcard CORS to Tenderly admin mutation responses', () => {
    const response = withTenderlyAdminCors(
      Response.json(
        { ok: true },
        {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true'
          }
        }
      ),
      new Request('http://localhost:3001/api/tenderly/snapshot', {
        method: 'POST',
        headers: { Origin: 'http://evil.localhost:3000' }
      })
    )

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull()
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS')
  })
})
