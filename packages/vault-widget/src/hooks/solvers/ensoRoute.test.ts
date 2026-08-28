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

describe('normalizeEnsoRouteResponse', () => {
  it('accepts a normal Enso router call', () => {
    const normalized = normalizeEnsoRouteResponse(
      {
        ...routePayload,
        tx: { ...routePayload.tx, operationType: 0 },
        route: []
      },
      200
    )

    expect(normalized.error).toBeUndefined()
    expect(normalized.route?.tx.operationType).toBe(0)
  })

  it('rejects a delegate route before exposing its transaction', () => {
    const normalized = normalizeEnsoRouteResponse(
      {
        ...routePayload,
        tx: {
          ...routePayload.tx,
          to: '0xA2F4F9c6Ec598ca8C633024F8851C79CA5f43E48',
          operationType: 1
        },
        route: []
      },
      200
    )

    expect(normalized.route).toBeUndefined()
    expect(normalized.error).toMatchObject({
      error: 'UnsupportedEnsoDelegateRoute',
      message: 'Enso returned an unsupported wallet route. Please retry the quote.'
    })
  })

  it('rejects unknown operation types', () => {
    const normalized = normalizeEnsoRouteResponse(
      {
        ...routePayload,
        tx: { ...routePayload.tx, operationType: 2 },
        route: []
      },
      200
    )

    expect(normalized.route).toBeUndefined()
    expect(normalized.error?.error).toBe('UnsupportedEnsoDelegateRoute')
  })
})
