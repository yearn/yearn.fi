import { SUPPORTED_CHAINS } from '@erc4626/lib/chains'
import { parseVaultSelection } from '@erc4626/lib/vaultSelection'
import { describe, expect, it } from 'vitest'

const address = '0x028eC7330ff87667b6dfb0D94b954c820195336c'
describe('vault selection', () => {
  it('preserves the old app’s five supported networks', () =>
    expect(SUPPORTED_CHAINS.map((chain) => chain.id)).toEqual([1, 8453, 42161, 10, 137]))
  it.each(['0', '999', 'abc'])('rejects unsupported chain %s instead of falling back to Ethereum', (chain) =>
    expect(parseVaultSelection(chain, address).error).toBeDefined()
  )
  it.each(['', 'hello', '0x0000000000000000000000000000000000000000'])('rejects unusable vault address %s', (value) =>
    expect(parseVaultSelection('1', value).error).toBeDefined()
  )
  it('normalizes a pasted address and defaults only an omitted chain', () =>
    expect(parseVaultSelection(undefined, ` ${address} `)).toEqual({ ok: true, chainId: 1, address }))
})
