import { describe, expect, it } from 'vitest'
import { getEnsoBridgeProtocol, normalizeEnsoRouteResponse } from './ensoRoute'

const routePayload = {
  tx: {
    to: '0x0000000000000000000000000000000000000001' as const,
    data: '0x1234' as const,
    value: '0',
    from: '0x0000000000000000000000000000000000000002' as const,
    chainId: 1
  },
  amountOut: '100',
  minAmountOut: '95',
  gas: '123456'
}

describe('getEnsoBridgeProtocol', () => {
  it('extracts a supported bridge protocol from normalized route metadata', () => {
    const normalized = normalizeEnsoRouteResponse(
      {
        ...routePayload,
        route: [
          { action: 'swap', protocol: 'enso' },
          { action: 'bridge', protocol: 'Relay' }
        ]
      },
      200
    )

    expect(getEnsoBridgeProtocol(normalized.route)).toBe('relay')
  })

  it('does not persist unsupported bridge protocols', () => {
    expect(
      getEnsoBridgeProtocol({
        ...routePayload,
        route: [{ action: 'bridge', protocol: 'unsupported' }]
      })
    ).toBeUndefined()
  })
})
