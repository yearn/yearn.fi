import { describe, expect, it } from 'vitest'
import {
  buildTenderlyStatusJson,
  buildTenderlyStatusMarkdown,
  classifyPublicRpcMode,
  normalizeTenderlyTransactionListResponse,
  normalizeTenderlyVnetListResponse,
  resolveStableNamedPublicRpcName,
  resolveTenderlyStatusIdentity,
  selectMatchingTenderlyVnet
} from './tenderly-vnet-status'

describe('tenderly-vnet-status', () => {
  it('defaults to the webops profile', () => {
    expect(
      resolveTenderlyStatusIdentity(
        {},
        {
          WEBOPS_ACCOUNT_SLUG: 'yearn',
          WEBOPS_PROJECT_SLUG: 'frontend'
        }
      )
    ).toMatchObject({
      profile: 'webops',
      accountSlug: 'yearn',
      projectSlug: 'frontend'
    })
  })

  it('supports explicit personal profile overrides', () => {
    expect(
      resolveTenderlyStatusIdentity(
        { profile: 'personal' },
        {
          PERSONAL_ACCOUNT_SLUG: 'me',
          PERSONAL_PROJECT_SLUG: 'sandbox'
        }
      )
    ).toMatchObject({
      profile: 'personal',
      accountSlug: 'me',
      projectSlug: 'sandbox'
    })
  })

  it('normalizes array and wrapped vnet list responses', () => {
    expect(normalizeTenderlyVnetListResponse([{ slug: 'vnet-a' }])).toHaveLength(1)
    expect(normalizeTenderlyVnetListResponse({ vnets: [{ slug: 'vnet-b' }] })).toHaveLength(1)
    expect(normalizeTenderlyVnetListResponse({ virtual_networks: [{ slug: 'vnet-c' }] })).toHaveLength(1)
  })

  it('normalizes array and wrapped transaction list responses', () => {
    expect(normalizeTenderlyTransactionListResponse([{ tx_hash: '0xabc' }])).toHaveLength(1)
    expect(normalizeTenderlyTransactionListResponse({ transactions: [{ tx_hash: '0xdef' }] })).toHaveLength(1)
    expect(normalizeTenderlyTransactionListResponse({ data: [{ tx_hash: '0xghi' }] })).toHaveLength(1)
  })

  it('matches the active vnet by admin rpc before any weaker fallback', () => {
    expect(
      selectMatchingTenderlyVnet({
        vnets: [
          {
            slug: 'first',
            rpcs: [{ name: 'Admin RPC', url: 'https://admin-a' }]
          },
          {
            slug: 'second',
            rpcs: [{ name: 'Admin RPC', url: 'https://admin-b' }]
          }
        ],
        adminRpcUri: 'https://admin-b',
        publicRpcUri: 'https://public-miss',
        executionChainId: 694201
      })
    ).toMatchObject({
      reason: 'admin-rpc',
      record: { slug: 'second' }
    })
  })

  it('classifies stable named public rpcs correctly without relying on a single profile rpc name', () => {
    expect(
      classifyPublicRpcMode({
        accountSlug: 'yearn',
        projectSlug: 'frontend',
        publicRpcUri: 'https://virtual.rpc.tenderly.co/yearn/frontend/public/yearn-fi-webops-vnet-42161'
      })
    ).toBe('stable named endpoint')

    expect(
      resolveStableNamedPublicRpcName({
        accountSlug: 'yearn',
        projectSlug: 'frontend',
        publicRpcUri: 'https://virtual.rpc.tenderly.co/yearn/frontend/public/yearn-fi-webops-vnet-42161'
      })
    ).toBe('yearn-fi-webops-vnet-42161')

    expect(
      classifyPublicRpcMode({
        accountSlug: 'yearn',
        projectSlug: 'frontend',
        rpcName: 'yearn-fi-webops-vnet',
        publicRpcUri: 'https://virtual.mainnet.eu.rpc.tenderly.co/ephemeral-id'
      })
    ).toBe('dynamic endpoint')
  })

  it('builds sanitized markdown and json reports without admin rpc leakage', () => {
    const report = {
      profile: 'webops' as const,
      accountSlug: 'yearn',
      projectSlug: 'frontend',
      restMetadataAvailable: true,
      recentTransactionCount: 5,
      chainReports: [
        {
          canonicalChainId: 1,
          canonicalChainName: 'Ethereum',
          configuredExecutionChainId: 694201,
          liveExecutionChainId: 694201,
          currentBlockNumber: 24_735_515,
          latestBlockTimestampSeconds: 1_742_000_000,
          latestBlockTimestampLabel: '2025-03-25 17:46:40 UTC',
          latestBlockAgeLabel: '8s',
          publicRpcUri: 'https://virtual.rpc.tenderly.co/yearn/frontend/public/yearn-fi-webops-vnet-1',
          publicRpcMode: 'stable named endpoint' as const,
          publicRpcName: 'yearn-fi-webops-vnet-1',
          hasAdminRpc: true,
          explorerEnabled: false,
          totalTransactionsAvailable: true,
          totalTransactionsCount: 12,
          recentTransactionsAvailable: true,
          recentTransactions: [
            {
              status: 'success',
              functionName: 'deposit',
              createdAtAgeLabel: '8s',
              blockNumber: 24_735_515,
              txHash: '0xb00dc057e50c8926896495cb31717bfa7ab47608673789b4b7b478ec114080cb',
              from: '0x5b0d3243c78fb9d4ac035fb2384ffdf7a9ef6396',
              to: '0xc56413869c6cdf96496f2b1ef801fedbdfa7ddb0'
            }
          ],
          matchedVnet: {
            slug: 'vnet-123',
            displayName: 'Webops VNet 123',
            forkNetworkId: 1,
            forkBlockNumber: 24_735_515
          },
          matchReason: 'admin-rpc' as const
        }
      ]
    }

    const markdown = buildTenderlyStatusMarkdown(report)
    const json = JSON.stringify(buildTenderlyStatusJson(report))

    expect(markdown).toContain('# Tenderly VNet Status')
    expect(markdown).toContain('Profile: webops')
    expect(markdown).toContain('## Ethereum (1)')
    expect(markdown).toContain('ID: vnet-123')
    expect(markdown).toContain('Chain ID: 694201')
    expect(markdown).toContain(
      'Public RPC: https://virtual.rpc.tenderly.co/yearn/frontend/public/yearn-fi-webops-vnet-1'
    )
    expect(markdown).toContain('Public RPC Mode: stable named endpoint (yearn-fi-webops-vnet-1)')
    expect(markdown).toContain('Total Transactions: 12')
    expect(markdown).toContain('Admin RPC: configured')
    expect(markdown).toContain('Most Recent Transactions (1 shown):')
    expect(markdown).toContain('| Age | Status | Block | Method | From | To | Tx Hash |')
    expect(markdown).toContain('deposit')
    expect(markdown).not.toContain('https://admin')
    expect(json).toContain('"slug":"vnet-123"')
    expect(json).toContain('"recentTransactions"')
    expect(json).toContain(
      '"publicRpcUri":"https://virtual.rpc.tenderly.co/yearn/frontend/public/yearn-fi-webops-vnet-1"'
    )
    expect(json).toContain('"totalTransactionsCount":12')
    expect(json).toContain('"publicRpcName":"yearn-fi-webops-vnet-1"')
    expect(json).not.toContain('adminRpc')
  })
})
