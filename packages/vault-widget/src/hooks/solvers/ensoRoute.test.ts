import { decodeFunctionData, encodeAbiParameters, encodeFunctionData, parseAbi } from 'viem'
import { describe, expect, it } from 'vitest'
import {
  bindEnsoRouteToRequest,
  type EnsoRouteResponse,
  getEnsoBridgeProtocol,
  normalizeEnsoRouteResponse
} from './ensoRoute'

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

const ENSO_ROUTER_TEST_ABI = parseAbi([
  'struct Token { uint8 tokenType; bytes data; }',
  'function routeSingle(Token tokenIn, bytes data) payable returns (bytes)',
  'function safeRouteSingle(Token tokenIn, Token tokenOut, address receiver, bytes data) payable returns (bytes)'
])
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const VAULT = '0x028eC7330ff87667b6dfb0D94b954c820195336c'
const NATIVE = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
const SENDER = '0x1111111111111111111111111111111111111111'
const SHORTCUT = '0xdeadbeef'

function erc20Token(token: `0x${string}`, amount: bigint) {
  return { tokenType: 1, data: encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [token, amount]) }
}

function nativeToken(amount: bigint) {
  return { tokenType: 0, data: encodeAbiParameters([{ type: 'uint256' }], [amount]) }
}

function ensoRoute(tokenIn: { tokenType: number; data: `0x${string}` }, overrides: Record<string, string> = {}) {
  return {
    ...routePayload,
    route: [],
    minAmountOut: '870',
    tx: {
      ...routePayload.tx,
      from: SENDER,
      value: '0',
      data: encodeFunctionData({ abi: ENSO_ROUTER_TEST_ABI, functionName: 'routeSingle', args: [tokenIn, SHORTCUT] }),
      ...overrides
    }
  } as EnsoRouteResponse
}

const usdcRequest = {
  fromAddress: SENDER,
  receiver: SENDER,
  tokenIn: USDC,
  tokenOut: VAULT,
  amountIn: 1_000_000n,
  isCrossChain: false
} as const

describe('bindEnsoRouteToRequest', () => {
  it('rewraps a matching same-chain route so the router enforces minAmountOut for the receiver', () => {
    const { route, error } = bindEnsoRouteToRequest(ensoRoute(erc20Token(USDC, 1_000_000n)), usdcRequest)

    expect(error).toBeUndefined()
    expect(decodeFunctionData({ abi: ENSO_ROUTER_TEST_ABI, data: route?.tx.data as `0x${string}` })).toEqual({
      functionName: 'safeRouteSingle',
      args: [erc20Token(USDC, 1_000_000n), erc20Token(VAULT, 870n), SENDER, SHORTCUT]
    })
  })

  it('binds a native withdrawal to a native minimum out', () => {
    const { route } = bindEnsoRouteToRequest(ensoRoute(erc20Token(VAULT, 5n)), {
      ...usdcRequest,
      tokenIn: VAULT,
      tokenOut: NATIVE,
      amountIn: 5n
    })

    expect(decodeFunctionData({ abi: ENSO_ROUTER_TEST_ABI, data: route?.tx.data as `0x${string}` }).args?.[1]).toEqual(
      nativeToken(870n)
    )
  })

  it('accepts a native deposit only when tx.value equals amountIn', () => {
    const request = { ...usdcRequest, tokenIn: NATIVE, amountIn: 10n ** 15n } as const

    expect(
      bindEnsoRouteToRequest(ensoRoute(nativeToken(10n ** 15n), { value: '1000000000000000' }), request).route
    ).toBeDefined()
    expect(
      bindEnsoRouteToRequest(ensoRoute(nativeToken(10n ** 15n), { value: '2000000000000000' }), request).error?.error
    ).toBe('UnexpectedEnsoRoute')
  })

  it.each([
    ['an ERC-20 route with ETH value', ensoRoute(erc20Token(USDC, 1_000_000n), { value: '1' })],
    ['a different input amount', ensoRoute(erc20Token(USDC, 2_000_000n))],
    ['a different input token', ensoRoute(erc20Token(VAULT, 1_000_000n))],
    ['a different sender', ensoRoute(erc20Token(USDC, 1_000_000n), { from: VAULT })],
    ['calldata that is not routeSingle', ensoRoute(erc20Token(USDC, 1_000_000n), { data: '0x1234' })]
  ])('rejects %s', (_label, candidate) => {
    const { route, error } = bindEnsoRouteToRequest(candidate, usdcRequest)

    expect(route).toBeUndefined()
    expect(error?.error).toBe('UnexpectedEnsoRoute')
  })

  it('validates but does not rewrap a cross-chain route', () => {
    const candidate = ensoRoute(erc20Token(USDC, 1_000_000n))

    expect(bindEnsoRouteToRequest(candidate, { ...usdcRequest, isCrossChain: true }).route).toBe(candidate)
    expect(
      bindEnsoRouteToRequest(ensoRoute(erc20Token(USDC, 1n)), { ...usdcRequest, isCrossChain: true }).error?.error
    ).toBe('UnexpectedEnsoRoute')
  })
})
