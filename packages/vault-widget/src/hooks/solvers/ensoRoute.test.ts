import { describe, expect, it } from 'vitest'
import { getEnsoBridgeProtocol, getEnsoSettlement, normalizeEnsoRouteResponse } from './ensoRoute'

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

  it('preserves unknown path-safe bridge protocols', () => {
    expect(
      getEnsoBridgeProtocol({
        ...routePayload,
        route: [{ action: 'bridge', protocol: 'unsupported' }]
      })
    ).toBe('unsupported')
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

describe('route-time settlement requirement', () => {
  it('retains unknown protocols and available estimates without inventing stable leg IDs', () => {
    const requirement = getEnsoSettlement(
      {
        ...routePayload,
        route: [{ action: 'bridge', protocol: 'Future-Bridge' }],
        bridgingEstimates: [{ protocol: 'Future-Bridge', estimatedSeconds: 90 }]
      },
      10
    )
    expect(requirement).toMatchObject({
      provider: 'enso',
      protocols: ['future-bridge'],
      destinationChainId: 10,
      estimatedSeconds: 90,
      coverage: 'incomplete',
      legs: [],
      bridgeCount: 1
    })
  })
  it('retains distinct route legs while ambiguous IDs remain incomplete', () => {
    const requirement = getEnsoSettlement(
      {
        ...routePayload,
        route: [
          { id: 'same', action: 'bridge', protocol: 'one' },
          { id: 'same', action: 'bridge', protocol: 'two' }
        ]
      },
      10
    )
    expect(requirement.coverage).toBe('incomplete')
    expect(requirement.legs).toHaveLength(1)
    expect(requirement.bridgeCount).toBe(2)
  })
  it('preserves the destination requirement when metadata is missing or unsafe', () => {
    expect(getEnsoSettlement(undefined, 10)).toMatchObject({
      destinationChainId: 10,
      protocols: [],
      coverage: 'incomplete'
    })
    expect(
      getEnsoSettlement({ ...routePayload, route: [{ action: 'bridge', protocol: '../unsafe' }] }, 10).protocols
    ).toEqual([])
  })
})
