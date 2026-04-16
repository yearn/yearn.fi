import { describe, expect, it } from 'vitest'
import { normalizeEnsoRouteResponse, routeHasSwapStep } from './ensoRoute'

describe('normalizeEnsoRouteResponse', () => {
  it('keeps valid Enso route payloads as routes', () => {
    const routePayload = {
      tx: {
        to: '0x0000000000000000000000000000000000000001',
        data: '0x1234',
        value: '0',
        from: '0x0000000000000000000000000000000000000002',
        chainId: 1
      },
      amountOut: '100',
      minAmountOut: '95',
      gas: '123456',
      route: []
    }

    expect(normalizeEnsoRouteResponse(routePayload, 200)).toEqual({
      route: routePayload
    })
  })

  it('fills tx.chainId from the request context when Enso omits it in a 200 response', () => {
    expect(
      normalizeEnsoRouteResponse(
        {
          tx: {
            to: '0x0000000000000000000000000000000000000001',
            data: '0x1234',
            value: '0',
            from: '0x0000000000000000000000000000000000000002'
          },
          amountOut: '100',
          minAmountOut: '95',
          gas: '123456',
          route: []
        },
        200,
        1
      )
    ).toEqual({
      route: {
        tx: {
          to: '0x0000000000000000000000000000000000000001',
          data: '0x1234',
          value: '0',
          from: '0x0000000000000000000000000000000000000002',
          chainId: 1
        },
        amountOut: '100',
        minAmountOut: '95',
        gas: '123456',
        route: []
      }
    })
  })

  it('treats 422 simulation failures without an error field as route errors', () => {
    expect(
      normalizeEnsoRouteResponse(
        {
          message: 'Could not quote shortcuts for route tokenIn -> tokenOut on network 1',
          description: '1 shortcut(s) were built but all failed simulation',
          requestId: 'test-request-id'
        },
        422
      )
    ).toEqual({
      error: {
        error: 'Could not quote shortcuts for route tokenIn -> tokenOut on network 1',
        message: '1 shortcut(s) were built but all failed simulation',
        requestId: 'test-request-id',
        statusCode: 422
      }
    })
  })

  it('flattens array-shaped Enso validation errors into readable strings', () => {
    expect(
      normalizeEnsoRouteResponse(
        {
          message: ['slippage must be a number string'],
          requestId: 'test-request-id'
        },
        400
      )
    ).toEqual({
      error: {
        error: 'slippage must be a number string',
        message: 'slippage must be a number string',
        requestId: 'test-request-id',
        statusCode: 400
      }
    })
  })

  it('detects swap actions from route steps', () => {
    const normalized = normalizeEnsoRouteResponse(
      {
        tx: {
          to: '0x0000000000000000000000000000000000000001',
          data: '0x1234',
          value: '0',
          from: '0x0000000000000000000000000000000000000002',
          chainId: 1
        },
        amountOut: '100',
        minAmountOut: '95',
        gas: '123456',
        route: [{ action: 'deposit' }, { action: 'swap' }]
      },
      200
    )

    expect(routeHasSwapStep(normalized.route)).toBe(true)
  })

  it('does not flag pure routing steps as swaps', () => {
    const normalized = normalizeEnsoRouteResponse(
      {
        tx: {
          to: '0x0000000000000000000000000000000000000001',
          data: '0x1234',
          value: '0',
          from: '0x0000000000000000000000000000000000000002',
          chainId: 1
        },
        amountOut: '100',
        minAmountOut: '100',
        gas: '123456',
        route: [{ action: 'redeem' }, { action: 'deposit' }]
      },
      200
    )

    expect(routeHasSwapStep(normalized.route)).toBe(false)
  })
})
