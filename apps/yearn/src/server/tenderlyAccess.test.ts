import { describe, expect, it } from 'vitest'
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
