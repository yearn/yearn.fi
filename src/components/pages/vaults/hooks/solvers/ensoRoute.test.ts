import { describe, expect, it } from 'vitest'
import { normalizeEnsoRouteResponse, parseEnsoRouteBigInt, routeHasSwapStep } from './ensoRoute'

describe('normalizeEnsoRouteResponse', () => {
  const validRoutePayload = {
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

  it('keeps valid Enso route payloads as routes', () => {
    expect(normalizeEnsoRouteResponse(validRoutePayload, 200)).toEqual({
      route: validRoutePayload
    })
  })

  it.each([
    '0',
    '1',
    '100000000000000000000000000000000000000'
  ])('accepts canonical non-negative integer quote fields: %s', (value) => {
    const routePayload = {
      ...validRoutePayload,
      amountOut: value,
      minAmountOut: value,
      gas: value
    }

    expect(normalizeEnsoRouteResponse(routePayload, 200)).toEqual({
      route: routePayload
    })
  })

  it.each([
    '',
    ' ',
    ' 1',
    '1 ',
    '-1',
    '1.1',
    '1e3',
    '0x10',
    'NaN',
    'abc'
  ])('rejects malformed amountOut values: %s', (amountOut) => {
    expect(normalizeEnsoRouteResponse({ ...validRoutePayload, amountOut }, 200).route).toBeUndefined()
  })

  it.each([
    '',
    ' ',
    ' 1',
    '1 ',
    '-1',
    '1.1',
    '1e3',
    '0x10',
    'NaN',
    'abc'
  ])('rejects malformed minAmountOut values: %s', (minAmountOut) => {
    expect(normalizeEnsoRouteResponse({ ...validRoutePayload, minAmountOut }, 200).route).toBeUndefined()
  })

  it.each([
    '',
    ' ',
    ' 1',
    '1 ',
    '-1',
    '1.1',
    '1e3',
    '0x10',
    'NaN',
    'abc'
  ])('rejects malformed gas values: %s', (gas) => {
    expect(normalizeEnsoRouteResponse({ ...validRoutePayload, gas }, 200).route).toBeUndefined()
  })

  it('returns undefined instead of throwing when parsing malformed route integers defensively', () => {
    expect(parseEnsoRouteBigInt('123')).toBe(123n)
    expect(parseEnsoRouteBigInt('1e3')).toBeUndefined()
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
