import type { TPendingTimelockStrategy } from '@pages/vaults/types/timelockStrategies'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PendingTimelockStrategiesTable } from './PendingTimelockStrategiesTable'

const pendingTimelock: TPendingTimelockStrategy = {
  chainId: 1,
  timelockAddress: '0x88Ba032be87d5EF1fbE87336B7090767F367BF73',
  vaultAddress: '0x696d02Db93291651ED510704c9b286841d506987',
  strategyAddress: '0x908244B6ef0e52911a380a5454aEC0743598Fb20',
  operationId: '0x5dac358a2f25b7148ebb9bca035dc4739fae4092086f4e8f98cc201f7e773a98',
  status: 'ready',
  queuedAt: 1_780_000_000,
  eta: 1_780_509_347,
  delay: 604_800,
  scheduleTxHash: '0xa6e8a54c3ff514951bca921cc38af55278980937816e5d04cd2d88fcf406199c',
  executorLabel: 'yChad',
  strategyName: 'Base Yearn Morpho OG USDC',
  strategySymbol: 'ysUSDC',
  maxDebtRaw: '100000000000000',
  decodedCalls: []
}

function renderPendingTableHtml({
  defaultExpandedOperationId,
  items
}: {
  defaultExpandedOperationId?: `0x${string}`
  items: TPendingTimelockStrategy[]
}): string {
  globalThis.window = {
    location: {
      href: 'http://localhost/',
      hostname: 'localhost'
    }
  } as Window & typeof globalThis

  return renderToStaticMarkup(
    <PendingTimelockStrategiesTable
      chainId={1}
      items={items}
      tokenAddress={'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'}
      tokenDecimals={6}
      tokenSymbol={'USDC'}
      defaultExpandedOperationId={defaultExpandedOperationId}
    />
  )
}

describe('PendingTimelockStrategiesTable', () => {
  it('renders pending-specific column headers', () => {
    const html = renderPendingTableHtml({ items: [pendingTimelock] })

    expect(html).toContain('Strategy')
    expect(html).toContain('Status')
    expect(html).toContain('Max debt')
    expect(html).toContain('yearn--table-head-label-wrapper')
    expect(html).toContain('yearn--table-head-label')
  })

  it('renders the pending strategy status and max debt', () => {
    const html = renderPendingTableHtml({ items: [pendingTimelock] })

    expect(html).toContain('Base Yearn Morpho OG USDC')
    expect(html).toContain('Timelock ready')
    expect(html).toContain('100,000,000 USDC')
    expect(html).not.toContain('0x908244...98Fb20')
  })

  it('renders expanded timelock audit details', () => {
    const html = renderPendingTableHtml({
      defaultExpandedOperationId: pendingTimelock.operationId,
      items: [pendingTimelock]
    })

    expect(html).toContain('This strategy is scheduled to be added to the vault but is still in the timelock')
    expect(html).toContain('Strategy address:')
    expect(html).toContain('0x908244...98Fb20')
    expect(html).toContain('Schedule tx:')
    expect(html).toContain('Operation id:')
    expect(html).toContain('yChad')
  })

  it('does not render zero-hash fallbacks for missing audit hashes', () => {
    const html = renderPendingTableHtml({
      defaultExpandedOperationId: '0x0000000000000000000000000000000000000000000000000000000000000000',
      items: [
        {
          ...pendingTimelock,
          operationId: '0x0000000000000000000000000000000000000000000000000000000000000000',
          scheduleTxHash: '0x0000000000000000000000000000000000000000000000000000000000000000'
        }
      ]
    })

    expect(html).toContain('Unavailable')
    expect(html).not.toContain('0x000000...000000')
  })

  it('renders nothing without pending rows', () => {
    expect(renderPendingTableHtml({ items: [] })).toBe('')
  })
})
