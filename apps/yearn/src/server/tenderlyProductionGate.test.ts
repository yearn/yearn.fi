import type { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { config, proxy, shouldBlockTenderlyApiRequestInProduction } from '../../proxy'

describe('Tenderly production middleware gate', () => {
  it('matches all Tenderly API routes', () => {
    expect(config.matcher).toBe('/api/tenderly/:path*')
  })

  it('blocks Tenderly API routes in Vercel production', () => {
    expect(
      shouldBlockTenderlyApiRequestInProduction({
        pathname: '/api/tenderly/status',
        vercelEnv: 'production'
      })
    ).toBe(true)
    expect(
      shouldBlockTenderlyApiRequestInProduction({
        pathname: '/api/tenderly/fund',
        vercelEnv: 'production'
      })
    ).toBe(true)
  })

  it('returns 404 for Tenderly API routes before handlers run in Vercel production', () => {
    const previousVercelEnv = process.env.VERCEL_ENV
    process.env.VERCEL_ENV = 'production'

    try {
      const response = proxy({ nextUrl: { pathname: '/api/tenderly/status' } } as NextRequest)
      expect(response.status).toBe(404)
    } finally {
      if (previousVercelEnv === undefined) {
        delete process.env.VERCEL_ENV
      } else {
        process.env.VERCEL_ENV = previousVercelEnv
      }
    }
  })

  it('does not block Tenderly API routes outside production', () => {
    expect(
      shouldBlockTenderlyApiRequestInProduction({
        pathname: '/api/tenderly/status',
        vercelEnv: 'preview'
      })
    ).toBe(false)
    expect(
      shouldBlockTenderlyApiRequestInProduction({
        pathname: '/api/tenderly/status',
        vercelEnv: 'development'
      })
    ).toBe(false)
    expect(
      shouldBlockTenderlyApiRequestInProduction({
        pathname: '/api/tenderly/status',
        vercelEnv: undefined
      })
    ).toBe(false)
  })

  it('does not block adjacent route names', () => {
    expect(
      shouldBlockTenderlyApiRequestInProduction({
        pathname: '/api/tenderly-status',
        vercelEnv: 'production'
      })
    ).toBe(false)
  })
})
