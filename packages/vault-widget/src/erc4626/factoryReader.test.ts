import { readErc4626Vault, type TErc4626Client } from '@yearn/vault-widget/erc4626/reader'
import { describe, expect, it, vi } from 'vitest'

const address = '0x1111111111111111111111111111111111111111'
const asset = '0x2222222222222222222222222222222222222222'
const account = '0x3333333333333333333333333333333333333333'
function fixture({ shutdown = false, failure = '' } = {}) {
  const readContract = vi.fn(async (call: { address: string; functionName: string }) => {
    if (call.functionName === failure) throw new Error('RPC unavailable')
    const values: Record<string, unknown> = {
      token: asset,
      decimals: call.address === address ? 18 : 6,
      symbol: 'LP',
      name: 'Factory LP',
      balanceOf: call.address === address ? 10n ** 18n : 9_000_000n,
      pricePerShare: 2_000_000n,
      availableDepositLimit: 3_000_000n,
      emergencyShutdown: shutdown,
      apiVersion: '0.4.6'
    }
    if (!(call.functionName in values)) throw new Error(`Unexpected read: ${call.functionName}`)
    return values[call.functionName]
  })
  return { readContract, getCode: vi.fn(async () => '0x1234'), getBlockNumber: vi.fn(async () => 123n) }
}
const read = (client: ReturnType<typeof fixture>) =>
  readErc4626Vault({
    client: client as unknown as TErc4626Client,
    address,
    chainId: 1,
    account,
    contractKind: 'yearn-v2'
  })
describe('Yearn factory snapshots', () => {
  it('uses the V2 interface and PPS with unequal share/asset decimals at one block', async () => {
    const client = fixture()
    const snapshot = await read(client)
    expect(snapshot.vault).toMatchObject({
      contractKind: 'yearn-v2',
      version: '0.4.6',
      asset: { address: asset, decimals: 6 }
    })
    expect(snapshot.user.depositedValue).toBe(2_000_000n)
    expect(snapshot.user.availableToDeposit).toBe(3_000_000n)
    expect(snapshot.user.yearnV2).toEqual({ maxDeposit: 3_000_000n })
    expect(snapshot.user.erc4626).toBeUndefined()
    expect(
      client.readContract.mock.calls.every(([call]) => (call as { blockNumber?: bigint }).blockNumber === 123n)
    ).toBe(true)
  })
  it('blocks deposits during emergency shutdown', async () => {
    const snapshot = await read(fixture({ shutdown: true }))
    expect(snapshot.user.yearnV2?.maxDeposit).toBe(0n)
    expect(snapshot.user.availableToDeposit).toBe(0n)
  })
  it.each(['token', 'pricePerShare', 'availableDepositLimit', 'balanceOf', 'emergencyShutdown'])(
    'fails closed when %s is unreadable',
    async (failure) => {
      await expect(read(fixture({ failure }))).rejects.toThrow('RPC unavailable')
    }
  )
})
