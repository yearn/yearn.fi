import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

async function loadInputTokenAmount() {
  return (await import('./InputTokenAmount')).InputTokenAmount
}

vi.mock('wagmi', () => ({
  useAccount: () => ({
    address: '0x0000000000000000000000000000000000000001'
  })
}))

vi.mock('@hooks/usePlausible', () => ({
  usePlausible: () => vi.fn()
}))

vi.mock('@shared/contexts/useWeb3', () => ({
  useWeb3: () => ({
    openLoginModal: vi.fn()
  })
}))

vi.mock('@shared/utils', () => ({
  cl: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' '),
  formatTAmount: ({ value, decimals }: { value: bigint; decimals: number }) => {
    const divisor = 10n ** BigInt(decimals)
    const whole = value / divisor
    const remainder = value % divisor
    if (remainder === 0n) {
      return whole.toString()
    }

    return `${whole.toString()}.${remainder.toString().padStart(decimals, '0').replace(/0+$/, '')}`
  },
  simpleToExact: vi.fn(() => 0n)
}))

vi.mock('@shared/components/TokenLogo', () => ({
  TokenLogo: (props: { src?: string; altSrc?: string }) => <img src={props.src} data-alt-src={props.altSrc} alt="" />
}))

describe('InputTokenAmount', () => {
  it('uses the explicit token logo URI for the selected input token', async () => {
    const InputTokenAmount = await loadInputTokenAmount()
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

  it('renders the display balance separately from the max-action balance', async () => {
    const InputTokenAmount = await loadInputTokenAmount()
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
        balance={1_000000000000000000n}
        displayBalance={4_000000000000000000n}
        decimals={18}
        symbol={'yvUSD'}
      />
    )

    expect(html).toContain('Balance: 4 yvUSD')
  })
})
