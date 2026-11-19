import { resolveEnsAddress, resolveEnsName } from '@yearn/wallet-ui/ens'
import { namehash, type PublicClient, zeroAddress } from 'viem'
import { describe, expect, it, vi } from 'vitest'

const ADDRESS = '0x5b0D3243c78fB9d4AC035fB2384FFdf7A9eF6396'
const RESOLVER = '0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41'
const reader = (getEnsAddress: ReturnType<typeof vi.fn>, readContract = vi.fn()) =>
  ({ getEnsAddress, readContract }) as unknown as Pick<PublicClient, 'getEnsAddress' | 'readContract'>

describe('ENS entry', () => {
  it('preserves the universal resolver for normal and wildcard names', async () => {
    const direct = vi.fn()
    const result = await resolveEnsAddress(reader(vi.fn().mockResolvedValue(ADDRESS), direct), 'GALLOWAY.eth')
    expect(result).toEqual({ name: 'galloway.eth', address: ADDRESS })
    expect(direct).not.toHaveBeenCalled()
  })
  it('resolves a registered legacy address when the universal resolver says not found', async () => {
    const direct = vi.fn().mockResolvedValueOnce(RESOLVER).mockResolvedValueOnce(ADDRESS)
    expect(await resolveEnsAddress(reader(vi.fn().mockResolvedValue(null), direct), 'galloway.eth')).toEqual({
      name: 'galloway.eth',
      address: ADDRESS
    })
    expect(direct.mock.calls[0]![0]).toMatchObject({ functionName: 'resolver', args: [namehash('galloway.eth')] })
    expect(direct.mock.calls[1]![0]).toMatchObject({
      address: RESOLVER,
      functionName: 'addr',
      args: [namehash('galloway.eth')]
    })
  })
  it('can recover from universal resolver failure using a valid registry record', async () => {
    const direct = vi.fn().mockResolvedValueOnce(RESOLVER).mockResolvedValueOnce(ADDRESS)
    expect(
      (
        await resolveEnsAddress(
          reader(vi.fn().mockRejectedValue(new Error('Universal resolver failed')), direct),
          'galloway.eth'
        )
      ).address
    ).toBe(ADDRESS)
  })
  it('keeps absent records null and never uses registry ownership as an address', async () => {
    const direct = vi.fn().mockResolvedValueOnce(zeroAddress)
    expect(
      (await resolveEnsAddress(reader(vi.fn().mockResolvedValue(null), direct), 'no-record.eth')).address
    ).toBeNull()
    expect(direct).toHaveBeenCalledTimes(1)
    const emptyAddress = vi.fn().mockResolvedValueOnce(RESOLVER).mockResolvedValueOnce(zeroAddress)
    expect(
      (await resolveEnsAddress(reader(vi.fn().mockResolvedValue(null), emptyAddress), 'no-address.eth')).address
    ).toBeNull()
  })
  it('keeps failed lookups distinct from a genuine missing address', async () => {
    await expect(
      resolveEnsAddress(
        reader(vi.fn().mockResolvedValue(null), vi.fn().mockRejectedValue(new Error('RPC unavailable'))),
        'galloway.eth'
      )
    ).rejects.toThrow('RPC unavailable')
    await expect(
      resolveEnsAddress(
        reader(vi.fn().mockRejectedValue(new Error('Universal unavailable')), vi.fn().mockResolvedValue(zeroAddress)),
        'wildcard.eth'
      )
    ).rejects.toThrow('Universal unavailable')
  })
})

describe('ENS wallet labels', () => {
  it('uses the verified universal name without reading the registry', async () => {
    const direct = vi.fn()
    const client = { ...reader(vi.fn(), direct), getEnsName: vi.fn().mockResolvedValue('verified.eth') }

    await expect(resolveEnsName(client, ADDRESS)).resolves.toBe('verified.eth')
    expect(direct).not.toHaveBeenCalled()
  })

  it('recovers a legacy reverse name and verifies it with the forward resolver', async () => {
    const direct = vi
      .fn()
      .mockResolvedValueOnce(RESOLVER)
      .mockResolvedValueOnce('GALLOWAY.eth')
      .mockResolvedValueOnce(RESOLVER)
      .mockResolvedValueOnce(ADDRESS)
    const client = { ...reader(vi.fn().mockResolvedValue(null), direct), getEnsName: vi.fn().mockResolvedValue(null) }

    await expect(resolveEnsName(client, ADDRESS)).resolves.toBe('galloway.eth')
    expect(direct.mock.calls[0]?.[0]).toMatchObject({
      functionName: 'resolver',
      args: [namehash(`${ADDRESS.slice(2).toLowerCase()}.addr.reverse`)]
    })
    expect(direct.mock.calls[1]?.[0]).toMatchObject({ address: RESOLVER, functionName: 'name' })
    expect(direct.mock.calls[3]?.[0]).toMatchObject({ functionName: 'addr', args: [namehash('galloway.eth')] })
  })

  it('keeps the address label when the legacy name points to a different wallet', async () => {
    const direct = vi.fn().mockResolvedValueOnce(RESOLVER).mockResolvedValueOnce('different.eth')
    const client = {
      ...reader(vi.fn().mockResolvedValue('0x1111111111111111111111111111111111111111'), direct),
      getEnsName: vi.fn().mockResolvedValue(null)
    }

    await expect(resolveEnsName(client, ADDRESS)).resolves.toBeNull()
  })
})
