import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { InputTokenAmount } from './InputTokenAmount'

vi.mock('wagmi', () => ({
  useAccount: () => ({
    address: '0x0000000000000000000000000000000000000001'
  })
}))

vi.mock('@shared/contexts/useWeb3', () => ({
  useWeb3: () => ({
    openLoginModal: vi.fn()
  })
}))

describe('InputTokenAmount', () => {
  it('uses the explicit token logo URI for the selected input token', () => {
    const html = renderToStaticMarkup(
      <InputTokenAmount
        input={
          [
            {
              formValue: '1',
              activity: [false, vi.fn()],
              decimals: 18
            },
            vi.fn(),
            vi.fn()
          ] as never
        }
        symbol={'yvUSD'}
        tokenAddress={'0x0000000000000000000000000000000000000002'}
        tokenChainId={1}
        tokenLogoURI={'https://example.com/input-logo.png'}
      />
    )

    expect(html).toContain('https://example.com/input-logo.png')
  })
})
