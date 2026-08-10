import { InputTokenAmount } from '@yearn/vault-widget/internal/components/widget/InputTokenAmount'
import { VaultWidgetRuntimeProvider } from '@yearn/vault-widget/runtime'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('wagmi', () => ({
  useAccount: () => ({
    address: '0x0000000000000000000000000000000000000001'
  })
}))

function renderInputTokenAmount(component: ReactElement): string {
  return renderToStaticMarkup(
    <VaultWidgetRuntimeProvider
      value={{
        assets: {
          getTokenLogoUrl: ({ address, chainId, size = 32 }) =>
            `/tokens/${chainId}/${address.toLowerCase()}/logo-${size}.png`
        }
      }}
    >
      {component}
    </VaultWidgetRuntimeProvider>
  )
}

function buildInput(formValue: string) {
  return [
    {
      formValue,
      activity: [false, vi.fn()],
      decimals: 18
    },
    vi.fn(),
    vi.fn()
  ] as never
}

describe('InputTokenAmount', () => {
  it('uses the explicit token logo URI for the selected input token', () => {
    const html = renderInputTokenAmount(
      <InputTokenAmount
        input={buildInput('1')}
        symbol="yvUSD"
        tokenAddress="0x0000000000000000000000000000000000000002"
        tokenChainId={1}
        tokenLogoURI="https://example.com/input-logo.png"
      />
    )

    expect(html).toContain('https://example.com/input-logo.png')
  })

  it('renders the display balance separately from the max-action balance', () => {
    const html = renderInputTokenAmount(
      <InputTokenAmount
        input={buildInput('1')}
        balance={1_000000000000000000n}
        displayBalance={4_000000000000000000n}
        decimals={18}
        symbol="yvUSD"
      />
    )

    expect(html).toContain('Balance: 4.00 yvUSD')
    expect(html).not.toContain('Balance: 1.00 yvUSD')
  })

  it('renders zap output USD from raw quote amounts instead of compact display text', () => {
    const html = renderInputTokenAmount(
      <InputTokenAmount
        input={buildInput('17900')}
        symbol="crvUSD"
        inputTokenUsdPrice={1}
        outputTokenUsdPrice={1.11}
        zapToken={{
          symbol: 'yvUSDC-2',
          address: '0x0000000000000000000000000000000000000003',
          chainId: 1,
          expectedAmount: '16.1K',
          expectedAmountRaw: 16_100000000n,
          expectedAmountDecimals: 6
        }}
      />
    )

    expect(html).toContain('$17,871')
  })
})
