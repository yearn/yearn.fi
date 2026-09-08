import { toAddress, truncateHex } from '@shared/utils/tools.address'
import { zeroAddress } from 'viem'
import { describe, expect, it } from 'vitest'

describe('toAddress', () => {
  const checksummedAddress = '0x52908400098527886E0F7030069857D2E4169EE7'

  it.each([
    checksummedAddress,
    checksummedAddress.toLowerCase(),
    '0x52908400098527886e0F7030069857D2E4169ee7',
    ` \t${checksummedAddress}\n`
  ])('normalizes a valid address to its checksum: %s', (address) => {
    expect(toAddress(address)).toBe(checksummedAddress)
  })

  it.each([
    undefined,
    null,
    '',
    ' \t\n',
    'GENESIS',
    ' GENESIS ',
    'not an address',
    '0x1234',
    `${checksummedAddress}0`,
    checksummedAddress.slice(2),
    `0X${checksummedAddress.slice(2)}`,
    '0x52908400098527886E0F7030069857D2E4169EEG',
    zeroAddress
  ])('preserves the zero-address fallback: %s', (address) => {
    expect(toAddress(address)).toBe(zeroAddress)
  })
})

describe('truncateHex', () => {
  it.each([
    { address: undefined, size: 0, expected: zeroAddress },
    { address: 'invalid', size: 0, expected: zeroAddress },
    { address: zeroAddress, size: 4, expected: '0x00...0000' },
    { address: '0x52908400098527886E0F7030069857D2E4169EE7', size: 4, expected: '0x5290...9EE7' }
  ])('preserves address display: $address / $size', ({ address, size, expected }) => {
    expect(truncateHex(address, size)).toBe(expected)
  })
})
