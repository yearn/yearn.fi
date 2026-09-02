import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import nextConfig, { YBOLD_ENV_DIRECTORY } from '@ybold/next.config'
import { describe, expect, it } from 'vitest'

const DISABLED_BASE_ACCOUNT_MODULE = resolve(import.meta.dirname, 'lib/disabledBaseAccount.ts')
const requireFromYbold = createRequire(import.meta.url)
const YBOLD_WAGMI_MODULE = dirname(requireFromYbold.resolve('wagmi/package.json'))

describe('yBOLD Next configuration', () => {
  it('loads the shared environment from the workspace root', () => {
    expect(resolve(YBOLD_ENV_DIRECTORY)).toBe(resolve(import.meta.dirname, '../..'))
  })

  it('protects every route from untrusted framing while preserving Safe embedding', async () => {
    const configuredRoutes = await nextConfig.headers?.()

    expect(configuredRoutes).toEqual([
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://app.safe.global"
          }
        ]
      }
    ])
    expect(nextConfig.poweredByHeader).toBe(false)
    expect(nextConfig.transpilePackages).toEqual(['@yearn/vault-widget'])
    expect(nextConfig.turbopack?.resolveAlias?.['@safe-global/safe-apps-sdk']).toBe(
      '../../node_modules/@safe-global/safe-apps-sdk/dist/esm'
    )
    expect(nextConfig.turbopack?.resolveAlias).toMatchObject({
      '@base-org/account': './lib/disabledBaseAccount.ts',
      wagmi: './node_modules/wagmi'
    })
  })

  it('keeps disabled Base Account and Wagmi singleton aliases aligned across both builders', () => {
    const webpack = nextConfig.webpack

    if (!webpack) {
      throw new Error('Expected yBOLD to configure webpack aliases')
    }

    const webpackConfig = webpack(
      {
        resolve: {
          alias: {
            preserved: 'alias'
          }
        }
      },
      {} as never
    )

    expect(webpackConfig.resolve.alias).toMatchObject({
      '@base-org/account': DISABLED_BASE_ACCOUNT_MODULE,
      preserved: 'alias',
      wagmi: YBOLD_WAGMI_MODULE
    })
  })
})
