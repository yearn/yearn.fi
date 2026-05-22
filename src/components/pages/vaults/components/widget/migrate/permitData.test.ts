import { hashDomain } from 'viem'
import { describe, expect, it, vi } from 'vitest'
import { buildVerifiedPermitData, createPermitDeadline } from './permitData'

const vaultAddress = '0x0000000000000000000000000000000000000001'
const account = '0x0000000000000000000000000000000000000002'
const spender = '0x0000000000000000000000000000000000000003'
const domainTypes = {
  EIP712Domain: [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'address' }
  ]
} as const

type ClientOptions = {
  nonce?: bigint
  name?: string
  version?: string
  apiVersion?: string
  eip712Version?: string
}

const makeClient = (domainSeparator: `0x${string}`, options: ClientOptions = {}) => ({
  readContract: vi.fn(({ functionName }) => {
    if (functionName === 'nonces') return Promise.resolve(options.nonce ?? 7n)
    if (functionName === 'name') return Promise.resolve(options.name ?? 'Yearn Token')
    if (functionName === 'version') return Promise.resolve(options.version ?? '1')
    if (functionName === 'apiVersion') {
      return options.apiVersion ? Promise.resolve(options.apiVersion) : Promise.reject(new Error('missing'))
    }
    if (functionName === 'EIP712_VERSION') {
      return options.eip712Version ? Promise.resolve(options.eip712Version) : Promise.reject(new Error('missing'))
    }
    if (functionName === 'DOMAIN_SEPARATOR') return Promise.resolve(domainSeparator)
    return Promise.reject(new Error(`unexpected read: ${functionName}`))
  })
})

describe('migration permit data', () => {
  it('refreshes permit deadlines per signing attempt', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-21T00:00:00Z'))
    const first = createPermitDeadline()

    vi.setSystemTime(new Date('2026-05-21T00:01:00Z'))
    const second = createPermitDeadline()

    expect(second).toBe(first + 60n)
    vi.useRealTimers()
  })

  it('rebuilds typed data from current signing inputs', async () => {
    const deadline = 123n
    const domain = { name: 'Yearn Token', version: '1', chainId: 1, verifyingContract: vaultAddress } as const
    const client = makeClient(hashDomain({ domain: { ...domain, chainId: 1n }, types: domainTypes }))

    const data = await buildVerifiedPermitData({
      client: client as any,
      vaultAddress,
      account,
      spender,
      value: 42n,
      chainId: 1,
      deadline
    })

    expect(data?.domain).toEqual(domain)
    expect(data?.message).toEqual({
      owner: account,
      spender,
      value: 42n,
      nonce: 7n,
      deadline
    })
  })

  it('enables permit data when a fallback Yearn Vault domain candidate is verified', async () => {
    const deadline = 123n
    const domain = { name: 'Yearn Vault', version: '3.0.4', chainId: 1, verifyingContract: vaultAddress } as const
    const client = makeClient(hashDomain({ domain: { ...domain, chainId: 1n }, types: domainTypes }), {
      name: 'yvToken Name',
      apiVersion: '3.0.4'
    })

    const data = await buildVerifiedPermitData({
      client: client as any,
      vaultAddress,
      account,
      spender,
      value: 42n,
      chainId: 1,
      deadline
    })

    expect(data?.domain).toEqual(domain)
  })

  it('disables permit data when the token domain separator cannot be verified', async () => {
    const data = await buildVerifiedPermitData({
      client: makeClient(`0x${'00'.repeat(32)}`) as any,
      vaultAddress,
      account,
      spender,
      value: 42n,
      chainId: 1,
      deadline: 123n
    })

    expect(data).toBeUndefined()
  })
})
