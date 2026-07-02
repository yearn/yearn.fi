import { describe, expect, it } from 'vitest'
import { buildMerklRewardsHeaders, buildMerklRewardsUrl, getMerklApiKey, validateMerklRewardsParams } from './rewards'

const USER_ADDRESS = '0x1111111111111111111111111111111111111111'

describe('Merkl rewards API helpers', () => {
  it('builds the Merkl rewards upstream URL', () => {
    expect(buildMerklRewardsUrl({ userAddress: USER_ADDRESS, chainId: '747474' })).toBe(
      'https://api.merkl.xyz/v4/users/0x1111111111111111111111111111111111111111/rewards?chainId=747474'
    )
  })

  it('sends the API key in the header expected by Merkl', () => {
    expect(buildMerklRewardsHeaders(' test-key ')).toEqual({
      Accept: 'application/json',
      'X-API-Key': 'test-key'
    })
  })

  it('validates reward query params', () => {
    expect(validateMerklRewardsParams(USER_ADDRESS, '747474')).toEqual({
      ok: true,
      params: {
        userAddress: USER_ADDRESS,
        chainId: '747474'
      }
    })
    expect(validateMerklRewardsParams('not-an-address', '747474')).toEqual({
      ok: false,
      status: 400,
      error: 'Invalid userAddress'
    })
    expect(validateMerklRewardsParams(USER_ADDRESS, 'katana')).toEqual({
      ok: false,
      status: 400,
      error: 'Invalid chainId'
    })
  })

  it('reads MERKL_API_KEY as a server-only key', () => {
    expect(getMerklApiKey({ MERKL_API_KEY: ' test-key ' })).toBe('test-key')
  })
})
