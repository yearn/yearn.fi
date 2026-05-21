import { type Address, encodeAbiParameters, encodeFunctionData, type Hex } from 'viem'
import { describe, expect, it } from 'vitest'
import { getEnsoRouteInvariantError, normalizeEnsoRouteResponse, parseEnsoRouteBigInt, routeHasSwapStep } from './ensoRoute'

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

  it('turns malformed successful route payloads into non-2xx errors', () => {
    expect(normalizeEnsoRouteResponse({ ...validRoutePayload, amountOut: '1e3' }, 200).error).toMatchObject({
      error: 'EnsoRouteError',
      message: 'Unable to find route',
      statusCode: 502
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

const SAFE_ROUTE_SINGLE_ABI = [
  {
    type: 'function',
    name: 'safeRouteSingle',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'tokenIn',
        type: 'tuple',
        components: [
          { name: 'tokenType', type: 'uint8' },
          { name: 'data', type: 'bytes' }
        ]
      },
      {
        name: 'tokenOut',
        type: 'tuple',
        components: [
          { name: 'tokenType', type: 'uint8' },
          { name: 'data', type: 'bytes' }
        ]
      },
      { name: 'receiver', type: 'address' },
      { name: 'data', type: 'bytes' }
    ],
    outputs: [{ name: 'response', type: 'bytes' }]
  }
] as const

const ACCOUNT = '0x0000000000000000000000000000000000000002' as Address
const TOKEN_IN = '0x0000000000000000000000000000000000000003' as Address
const VAULT = '0x0000000000000000000000000000000000000004' as Address
const OTHER = '0x0000000000000000000000000000000000000005' as Address

function tokenData(token: Address, amount: bigint): Hex {
  return encodeAbiParameters(
    [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    [token, amount]
  )
}

function safeRouteSingleCalldata(receiver: Address, minExpectedOut: bigint): Hex {
  return encodeFunctionData({
    abi: SAFE_ROUTE_SINGLE_ABI,
    functionName: 'safeRouteSingle',
    args: [
      { tokenType: 0, data: tokenData(TOKEN_IN, 100n) },
      { tokenType: 0, data: tokenData(VAULT, minExpectedOut) },
      receiver,
      '0x'
    ]
  })
}

describe('getEnsoRouteInvariantError', () => {
  const baseTx = {
    to: '0x0000000000000000000000000000000000000001' as Address,
    data: safeRouteSingleCalldata(ACCOUNT, 95n),
    value: '0',
    from: ACCOUNT,
    chainId: 1
  }

  const baseContext = {
    chainId: 1,
    fromAddress: ACCOUNT,
    tokenIn: TOKEN_IN,
    tokenOut: VAULT,
    receiver: ACCOUNT,
    expectedOut: 100n,
    minExpectedOut: 95n
  }

  it('accepts supported Enso calldata when receiver and min-out match the displayed context', () => {
    expect(getEnsoRouteInvariantError(baseTx, baseContext)).toBeUndefined()
  })

  it('rejects Enso calldata when the decoded receiver differs from the connected account', () => {
    expect(
      getEnsoRouteInvariantError(
        {
          ...baseTx,
          data: safeRouteSingleCalldata(OTHER, 95n)
        },
        baseContext
      )
    ).toBe('Enso route receiver does not match the connected account')
  })

  it('rejects Enso calldata when decoded min-out differs from the displayed minimum', () => {
    expect(
      getEnsoRouteInvariantError(
        {
          ...baseTx,
          data: safeRouteSingleCalldata(ACCOUNT, 94n)
        },
        baseContext
      )
    ).toBe('Enso route minimum output does not match the displayed minimum')
  })

  it('rejects unsupported or malformed Enso calldata', () => {
    expect(
      getEnsoRouteInvariantError(
        {
          ...baseTx,
          data: '0x1234'
        },
        baseContext
      )
    ).toBe('Enso route calldata could not be verified')
  })
})
