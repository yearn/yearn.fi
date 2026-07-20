import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { STRATEGY_PANEL_ROW_DESKTOP_LAYOUT } from './strategiesLayout'
import { VaultsListStrategy } from './VaultsListStrategy'

function renderStrategyHtml(props?: Partial<Parameters<typeof VaultsListStrategy>[0]>): string {
  globalThis.window = {
    location: {
      href: 'http://localhost/',
      hostname: 'localhost'
    }
  } as Window & typeof globalThis

  return renderToStaticMarkup(
    <VaultsListStrategy
      details={{
        totalDebt: '0',
        totalLoss: '0',
        totalGain: '0',
        performanceFee: 0,
        lastReport: 0,
        debtRatio: 0
      }}
      status={'unallocated'}
      chainId={1}
      allocation={'$0'}
      totalValueUsd={0}
      name={'Base Yearn Morpho OG USDC'}
      tokenAddress={'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'}
      address={'0x908244B6ef0e52911a380a5454aEC0743598Fb20'}
      variant={'v3'}
      apr={null}
      netApr={null}
      fees={{ management: 0, performance: 0 }}
      {...props}
    />
  )
}

describe('VaultsListStrategy desktop layout', () => {
  it('uses tightened strategy row desktop column classes with balanced desktop title wrapping', () => {
    expect(STRATEGY_PANEL_ROW_DESKTOP_LAYOUT.nameColumnSpanClass).toBe('md:col-span-11')
    expect(STRATEGY_PANEL_ROW_DESKTOP_LAYOUT.valuesColumnSpanClass).toBe('md:col-span-12')
    expect(STRATEGY_PANEL_ROW_DESKTOP_LAYOUT.valuesGridClass).toBe('md:grid-cols-12 md:gap-2')
    expect(STRATEGY_PANEL_ROW_DESKTOP_LAYOUT.valueColumnSpanClass).toBe('md:col-span-4')
    expect(STRATEGY_PANEL_ROW_DESKTOP_LAYOUT.nameLabelDesktopWrapClass).toBe(
      'md:[display:-webkit-box] md:[-webkit-box-orient:vertical] md:[-webkit-line-clamp:2] md:[text-wrap:balance] md:whitespace-normal'
    )
  })

  it('keeps unallocated strategy rows in the existing placeholder state', () => {
    const html = renderStrategyHtml()

    expect(html).toContain('opacity-50')
    expect(html).not.toContain('Timelock ready')
  })

  it('shows APY for inactive strategies', () => {
    const html = renderStrategyHtml({
      status: 'not_active',
      apr: 0.042
    })

    expect(html).toContain('4.20%')
    expect(html).toContain('opacity-70')
    expect(html).not.toContain('opacity-50')
  })
})
