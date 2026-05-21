import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchVaultOnChainStateMock = vi.fn()

vi.mock('./_lib/rpc', () => ({
  fetchVaultOnChainState: fetchVaultOnChainStateMock
}))

type TMockResponse = {
  statusCode: number
  headers: Record<string, string>
  body: unknown
  setHeader: (name: string, value: string) => TMockResponse
  status: (code: number) => TMockResponse
  json: (payload: unknown) => TMockResponse
  send: (payload: unknown) => TMockResponse
}

function createMockResponse(): TMockResponse {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name: string, value: string) {
      this.headers[name] = value
      return this
    },
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: unknown) {
      this.body = payload
      return this
    },
    send(payload: unknown) {
      this.body = payload
      return this
    }
  }
}

describe('optimization vault-state route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('marks successful body-driven responses as private no-store', async () => {
    const vault = '0x1111111111111111111111111111111111111111'
    const strategies = ['0x2222222222222222222222222222222222222222']

    fetchVaultOnChainStateMock.mockResolvedValue({
      totalAssets: BigInt(1000),
      strategyDebts: new Map([[strategies[0].toLowerCase(), BigInt(250)]]),
      unallocatedBps: 7500
    })

    const { default: handler } = await import('./vault-state')
    const req = {
      method: 'POST',
      body: {
        vault,
        chainId: 1,
        strategies
      }
    } as any
    const res = createMockResponse()

    await handler(req, res as any)

    expect(fetchVaultOnChainStateMock).toHaveBeenCalledWith(1, vault, strategies)
    expect(res.statusCode).toBe(200)
    expect(res.headers['Cache-Control']).toBe('private, no-store')
    expect(res.body).toEqual({
      totalAssets: '1000',
      strategyDebts: {
        [strategies[0].toLowerCase()]: '250'
      },
      unallocatedBps: 7500
    })
  })
})
