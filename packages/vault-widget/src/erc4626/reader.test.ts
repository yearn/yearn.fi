import { InvalidErc4626VaultError, readErc4626Vault, type TErc4626Client } from '@yearn/vault-widget/erc4626/reader'
import { describe, expect, it, vi } from 'vitest'

const vault = '0x0000000000000000000000000000000000000001'
const asset = '0x0000000000000000000000000000000000000002'
const account = '0x0000000000000000000000000000000000000003'
const SHARES = 10n ** 18n
function fixture(failure?: string) {
  const readContract = vi.fn(
    async ({ address, functionName, args }: { address: string; functionName: string; args?: readonly unknown[] }) => {
      if (failure === functionName) throw new Error('RPC unavailable')
      switch (functionName) {
        case 'asset':
          return asset
        case 'decimals':
          return address === vault ? 18 : 6
        case 'symbol':
          return address === vault ? 'vTOKEN' : 'TOKEN'
        case 'name':
          return address === vault ? 'Independent vault' : 'Unpriced token'
        case 'balanceOf':
          return address === vault ? 10n * SHARES : 99_000_000n
        case 'maxDeposit':
          return 5_000_000n
        case 'maxWithdraw':
          return 3_900_000n
        case 'maxRedeem':
          return 2n * SHARES
        case 'convertToAssets':
          return (BigInt(args![0] as bigint) * 2_000_000n) / SHARES
        case 'previewRedeem':
          return (BigInt(args![0] as bigint) * 1_950_000n) / SHARES
        default:
          throw new Error(`Unexpected method: ${functionName}`)
      }
    }
  )
  return { readContract, getCode: vi.fn(async () => '0x1234'), getBlockNumber: vi.fn(async () => 123n) }
}
const read = (client: ReturnType<typeof fixture>, owner: typeof account | undefined = account) =>
  readErc4626Vault({ client: client as unknown as TErc4626Client, address: vault, chainId: 8453, account: owner })

describe('generic ERC-4626 snapshot', () => {
  it('reads an unlisted vault with unequal decimals, fees and independent liquidity limits without any price or Yearn method', async () => {
    const client = fixture()
    const result = await read(client)
    expect(client.getBlockNumber).toHaveBeenCalledWith({ cacheTime: 0 })
    expect(result.vault).toMatchObject({ contractKind: 'erc4626', decimals: 18, asset: { decimals: 6 } })
    expect(result.vault.forwardAPR).toBeUndefined()
    expect(result.vault.version).toBeUndefined()
    expect(result.user.depositedValue).toBe(20_000_000n)
    expect(result.user.availableToDeposit).toBe(5_000_000n)
    expect(result.user.erc4626).toEqual({
      maxDeposit: 5_000_000n,
      maxWithdraw: 3_900_000n,
      maxRedeem: 2n * SHARES,
      redeemableAssets: 3_900_000n
    })
    expect(result.user.assetToken?.balance.display).toBe('99')
    expect(
      client.readContract.mock.calls.every(([call]) => (call as { blockNumber?: bigint }).blockNumber === 123n)
    ).toBe(true)
  })
  it.each(['decimals', 'balanceOf', 'maxWithdraw', 'previewRedeem', 'convertToAssets'])(
    'preserves a failed %s read instead of returning fabricated zeros',
    async (method) => {
      await expect(read(fixture(method))).rejects.toThrow('RPC unavailable')
    }
  )
  it('allows unavailable presentation metadata without guessing decimals', async () => {
    expect((await read(fixture('name'))).vault.name).toBe('Unnamed token')
  })
  it('rejects addresses with no contract', async () => {
    const client = fixture()
    client.getCode.mockResolvedValue('0x')
    await expect(read(client)).rejects.toBeInstanceOf(InvalidErc4626VaultError)
    expect(client.readContract).not.toHaveBeenCalled()
  })
  it('loads metadata disconnected without reading a wallet balance', async () => {
    const client = fixture()
    const result = await readErc4626Vault({ client: client as unknown as TErc4626Client, address: vault, chainId: 1 })
    expect(result.user.depositedShares).toBe(0n)
    expect(client.readContract.mock.calls.some(([call]) => call.functionName === 'balanceOf')).toBe(false)
  })
})
