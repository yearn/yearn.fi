import { describe, expect, it } from 'vitest'
import { parseCliArgs, parseDecimalAmount, toHexQuantity } from './tenderly'

describe('tenderly script helpers', () => {
  it('parses command-line flags and positionals', () => {
    expect(
      parseCliArgs([
        'fund-native',
        '--wallet',
        '0x1111111111111111111111111111111111111111',
        '--amount',
        '25',
        '--mode',
        'add',
        'extra'
      ])
    ).toEqual({
      command: 'fund-native',
      flags: {
        wallet: '0x1111111111111111111111111111111111111111',
        amount: '25',
        mode: 'add'
      },
      positionals: ['extra']
    })
  })

  it('parses boolean-style flags without values', () => {
    expect(parseCliArgs(['increase-time', '--seconds', '86400', '--mine-block'])).toEqual({
      command: 'increase-time',
      flags: {
        seconds: '86400',
        'mine-block': 'true'
      },
      positionals: []
    })
  })

  it('converts decimal values to bigint token amounts', () => {
    expect(parseDecimalAmount('1.5', 18)).toBe(1500000000000000000n)
    expect(parseDecimalAmount('50000', 6)).toBe(50000000000n)
  })

  it('converts bigint values to JSON-RPC hex quantities', () => {
    expect(toHexQuantity(0n)).toBe('0x0')
    expect(toHexQuantity(255n)).toBe('0xff')
  })
})
