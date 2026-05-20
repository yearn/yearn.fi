import { describe, expect, it } from 'vitest'
import { getEnsoRouteInvariantError, normalizeEnsoRouteResponse, routeHasSwapStep } from './ensoRoute'

const ETHEREUM_ENSO_ROUTER = '0xF75584eF6673aD213a685a1B58Cc0330B8eA22Cf'
const ACCOUNT = '0x0000000000000000000000000000000000000002'

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
            to: ETHEREUM_ENSO_ROUTER,
            data: '0x1234',
            value: '0',
            from: ACCOUNT
          },
          amountOut: '100',
          minAmountOut: '95',
          gas: '123456',
          route: []
        },
        200,
        { chainId: 1, fromAddress: ACCOUNT }
      )
    ).toEqual({
      route: {
        tx: {
          to: ETHEREUM_ENSO_ROUTER,
          data: '0x1234',
          value: '0',
          from: ACCOUNT,
          chainId: 1
        },
        amountOut: '100',
        minAmountOut: '95',
        gas: '123456',
        route: []
      }
    })
  })

  it('rejects route targets that do not match the expected Enso router', () => {
    expect(
      normalizeEnsoRouteResponse(
        {
          tx: {
            to: '0x0000000000000000000000000000000000000001',
            data: '0x1234',
            value: '0',
            from: ACCOUNT,
            chainId: 1
          },
          amountOut: '100',
          minAmountOut: '95',
          gas: '123456',
          route: []
        },
        200,
        { chainId: 1, fromAddress: ACCOUNT }
      )
    ).toEqual({
      error: {
        error: 'Enso route target does not match the expected router',
        message: 'Enso route target does not match the expected router',
        requestId: undefined,
        statusCode: 200
      }
    })
  })

  it('rejects route senders that do not match the request account', () => {
    expect(
      normalizeEnsoRouteResponse(
        {
          tx: {
            to: ETHEREUM_ENSO_ROUTER,
            data: '0x1234',
            value: '0',
            from: '0x0000000000000000000000000000000000000003',
            chainId: 1
          },
          amountOut: '100',
          minAmountOut: '95',
          gas: '123456',
          route: []
        },
        200,
        { chainId: 1, fromAddress: ACCOUNT }
      )
    ).toEqual({
      error: {
        error: 'Enso route sender does not match the connected account',
        message: 'Enso route sender does not match the connected account',
        requestId: undefined,
        statusCode: 200
      }
    })
  })

  it('rejects routes whose tx.chainId does not match the request chain', () => {
    expect(
      normalizeEnsoRouteResponse(
        {
          tx: {
            to: ETHEREUM_ENSO_ROUTER,
            data: '0x1234',
            value: '0',
            from: ACCOUNT,
            chainId: 10
          },
          amountOut: '100',
          minAmountOut: '95',
          gas: '123456',
          route: []
        },
        200,
        { chainId: 1, fromAddress: ACCOUNT }
      )
    ).toEqual({
      error: {
        error: 'Enso route chain does not match the requested chain',
        message: 'Enso route chain does not match the requested chain',
        requestId: undefined,
        statusCode: 200
      }
    })
  })

  it('rejects malformed executable transaction fields', () => {
    expect(
      normalizeEnsoRouteResponse(
        {
          tx: {
            to: ETHEREUM_ENSO_ROUTER,
            data: 'not-hex',
            value: '-1',
            from: ACCOUNT,
            chainId: 1
          },
          amountOut: '100',
          minAmountOut: '95',
          gas: '123456',
          route: []
        },
        200,
        { chainId: 1, fromAddress: ACCOUNT }
      ).error?.message
    ).toBe('Unable to find route')
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

  it('exposes the same invariant check for execution-time validation', () => {
    expect(
      getEnsoRouteInvariantError(
        {
          to: '0x0000000000000000000000000000000000000001',
          data: '0x1234',
          value: '0',
          from: ACCOUNT,
          chainId: 1
        },
        { chainId: 1, fromAddress: ACCOUNT }
      )
    ).toBe('Enso route target does not match the expected router')
  })

  it('revalidates executable transaction fields at execution time', () => {
    expect(
      getEnsoRouteInvariantError(
        {
          to: ETHEREUM_ENSO_ROUTER,
          data: 'not-hex' as any,
          value: '0',
          from: ACCOUNT,
          chainId: 1
        },
        { chainId: 1, fromAddress: ACCOUNT }
      )
    ).toBe('Enso route transaction fields are invalid')
  })
})
