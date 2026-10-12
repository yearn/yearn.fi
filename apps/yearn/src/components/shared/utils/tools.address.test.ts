import { toAddress, truncateHex } from '@shared/utils/tools.address'
import { isZeroAddress } from '@shared/utils/tools.is'
import { zeroAddress } from 'viem'
import { describe, expect, it } from 'vitest'

const checksummed = '0x52908400098527886E0F7030069857D2E4169EE7'

describe('address normalization', () => {
  it.each([checksummed, checksummed.toLowerCase(), ` ${checksummed}\n`])('preserves EIP-55 output for %s', (input) => {
    expect(toAddress(input)).toBe(checksummed)
    expect(isZeroAddress(input)).toBe(false)
  })

  it.each([
    undefined,
    null,
    '',
    ' ',
    'GENESIS',
    '0x1234',
    'invalid',
    `0x${'z'.repeat(40)}`,
    `0X${checksummed.slice(2)}`
  ])('preserves the existing zero-address fallback for %s', (input) => {
    expect(toAddress(input)).toBe(zeroAddress)
    expect(isZeroAddress(input ?? undefined)).toBe(true)
  })

  it('preserves zero-address and abbreviated display behavior', () => {
    expect(toAddress(zeroAddress)).toBe(zeroAddress)
    expect(toAddress(` ${zeroAddress} `)).toBe(zeroAddress)
    expect(isZeroAddress(zeroAddress)).toBe(true)
    expect(truncateHex(checksummed, 4)).toBe('0x5290...9EE7')
    expect(truncateHex(undefined, 4)).toBe('0x00...0000')
  })
})
