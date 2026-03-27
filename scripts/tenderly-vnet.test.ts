import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildSanitizedVnetJson,
  buildTenderlyApiErrorMessage,
  buildTenderlyEnvFragment,
  buildVnetConsoleSummary,
  resolveExplorerUriFromResponse,
  resolveTenderlyCredentials,
  sanitizeConsoleText,
  validateWritableOutputPath,
  writeOutputFile
} from './tenderly-vnet'

const connectionDetails = {
  adminRpc: 'https://admin.rpc/secret-path',
  publicRpc: 'https://dynamic.public.rpc/ephemeral-path',
  predictablePublicRpc: 'https://predictable.public.rpc/stable-path',
  explorerUri: 'https://explorer.tenderly.public/virtual-mainnet'
}

const response = {
  slug: 'vnet-123',
  display_name: 'Personal VNet 123',
  id: 'vnet-id-123',
  rpcs: [
    { name: 'Admin RPC', url: connectionDetails.adminRpc },
    { name: 'Public RPC', url: connectionDetails.publicRpc }
  ]
}

describe('tenderly-vnet console safety', () => {
  it('prefers webops account and project slugs over legacy and personal env vars', () => {
    expect(
      resolveTenderlyCredentials(
        { profile: 'webops' },
        {
          WEBOPS_TENDERLY_API_KEY: 'webops-key',
          WEBOPS_ACCOUNT_SLUG: 'webops-account',
          WEBOPS_PROJECT_SLUG: 'webops-project',
          TENDERLY_ACCOUNT_SLUG: 'legacy-account',
          TENDERLY_PROJECT_SLUG: 'legacy-project',
          PERSONAL_ACCOUNT_SLUG: 'personal-account',
          PERSONAL_PROJECT_SLUG: 'personal-project'
        }
      )
    ).toMatchObject({
      apiKey: 'webops-key',
      accountSlug: 'webops-account',
      projectSlug: 'webops-project',
      profile: 'webops'
    })
  })

  it('falls back to legacy webops slug env vars when WEBOPS slugs are unset', () => {
    expect(
      resolveTenderlyCredentials(
        { profile: 'webops' },
        {
          WEBOPS_TENDERLY_API_KEY: 'webops-key',
          TENDERLY_ACCOUNT_SLUG: 'legacy-account',
          TENDERLY_PROJECT_SLUG: 'legacy-project'
        }
      )
    ).toMatchObject({
      accountSlug: 'legacy-account',
      projectSlug: 'legacy-project'
    })
  })

  it('redacts URLs in console text', () => {
    expect(sanitizeConsoleText('failed at https://admin.rpc/secret-path')).toBe('failed at [redacted-url]')
  })

  it('builds an env fragment with the preferred public RPC without printing it elsewhere', () => {
    const envFragment = buildTenderlyEnvFragment({
      canonicalChainId: 1,
      executionChainId: 694201,
      details: connectionDetails
    })

    expect(envFragment).toContain('VITE_TENDERLY_MODE=true')
    expect(envFragment).toContain('VITE_TENDERLY_CHAIN_ID_FOR_1=694201')
    expect(envFragment).toContain('VITE_TENDERLY_RPC_URI_FOR_1=https://predictable.public.rpc/stable-path')
    expect(envFragment).toContain('TENDERLY_ADMIN_RPC_URI_FOR_1=https://admin.rpc/secret-path')
    expect(envFragment).toContain('VITE_TENDERLY_EXPLORER_URI_FOR_1=https://explorer.tenderly.public/virtual-mainnet')
  })

  it('extracts explorer urls from explorer-specific response fields without mistaking public rpc urls for explorers', () => {
    expect(
      resolveExplorerUriFromResponse({
        public_rpc_url: 'https://rpc.tenderly.example/ignored',
        explorer_page: {
          public_url: 'https://explorer.tenderly.public/virtual-mainnet'
        }
      })
    ).toBe('https://explorer.tenderly.public/virtual-mainnet')
  })

  it('omits sensitive RPC values from the default console summary', () => {
    const summary = buildVnetConsoleSummary({
      profile: 'personal',
      requestedSlug: 'vnet-123',
      displayName: 'Personal VNet 123',
      chainId: 694201,
      networkId: 1,
      response,
      details: connectionDetails
    }).join('\n')

    expect(summary).toContain('Created Tenderly Virtual TestNet')
    expect(summary).toContain('Sensitive RPC values were returned but not printed.')
    expect(summary).not.toContain(connectionDetails.adminRpc)
    expect(summary).not.toContain(connectionDetails.publicRpc)
    expect(summary).not.toContain(connectionDetails.predictablePublicRpc)
  })

  it('includes only file paths when sensitive artifacts are written to disk', () => {
    const summary = buildVnetConsoleSummary({
      profile: 'webops',
      requestedSlug: 'vnet-123',
      displayName: 'Webops VNet 123',
      chainId: 694201,
      networkId: 1,
      response,
      details: connectionDetails,
      envFilePath: '/tmp/tenderly-vnet.env',
      responseFilePath: '/tmp/tenderly-vnet.json'
    }).join('\n')

    expect(summary).toContain('/tmp/tenderly-vnet.env')
    expect(summary).toContain('/tmp/tenderly-vnet.json')
    expect(summary).not.toContain('Sensitive RPC values were returned but not printed.')
    expect(summary).not.toContain(connectionDetails.adminRpc)
  })

  it('prints a sanitized JSON summary without RPC URLs', () => {
    const sanitized = buildSanitizedVnetJson({
      profile: 'personal',
      requestedSlug: 'vnet-123',
      displayName: 'Personal VNet 123',
      chainId: 694201,
      networkId: 1,
      response,
      details: connectionDetails
    })

    const serialized = JSON.stringify(sanitized)

    expect(serialized).toContain('"has_admin_rpc":true')
    expect(serialized).toContain('"has_public_rpc":true')
    expect(serialized).not.toContain('"rpcs"')
    expect(serialized).not.toContain(connectionDetails.adminRpc)
    expect(serialized).not.toContain(connectionDetails.publicRpc)
    expect(serialized).not.toContain(connectionDetails.predictablePublicRpc)
  })

  it('sanitizes API error messages instead of echoing raw response data', () => {
    const message = buildTenderlyApiErrorMessage({
      status: 404,
      parsedBody: {
        message: 'Request failed for https://admin.rpc/secret-path',
        details: 'hidden'
      }
    })

    expect(message).toContain('Tenderly API request failed (404)')
    expect(message).toContain('[redacted-url]')
    expect(message).toContain('Hint: check --account and --project slugs.')
    expect(message).not.toContain(connectionDetails.adminRpc)
    expect(message).not.toContain('Response:')
  })

  it('fails local output validation before writing to an unwritable location', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'tenderly-vnet-'))
    const lockedDir = join(tempDir, 'locked')
    mkdirSync(lockedDir, { recursive: true })
    chmodSync(lockedDir, 0o500)

    try {
      expect(() => validateWritableOutputPath(join(lockedDir, 'vnet.env'))).toThrow('Cannot write output file')
    } finally {
      chmodSync(lockedDir, 0o700)
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('writes secret output files with 0600 permissions', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'tenderly-vnet-'))
    const outputFile = join(tempDir, 'vnet.env')

    try {
      validateWritableOutputPath(outputFile)
      writeOutputFile(outputFile, 'secret=value\n')

      expect(readFileSync(outputFile, 'utf8')).toBe('secret=value\n')
      expect(statSync(outputFile).mode & 0o777).toBe(0o600)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
