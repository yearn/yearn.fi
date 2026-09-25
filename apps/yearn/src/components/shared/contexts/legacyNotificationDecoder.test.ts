import { decodeLegacyNotifications } from '@shared/contexts/legacyNotificationDecoder'
import { describe, expect, it } from 'vitest'

const row = {
  id: 7,
  address: '0x1111111111111111111111111111111111111111',
  chainId: 1,
  amount: '1.000000000000000001',
  type: 'deposit',
  status: 'success'
}

describe('legacy history decoding', () => {
  it('retains reported history without inventing receipts, timestamps, hashes or flow identity', () => {
    const decoded = decodeLegacyNotifications([row])[0]
    expect(decoded).toEqual(row)
    expect(decoded.lifecycleRecord).toBeUndefined()
    expect(decoded.txHash).toBeUndefined()
    expect(decoded.createdAt).toBeUndefined()
    expect(row).not.toHaveProperty('version')
  })
  it('preserves native receipt numbers, unknown protocols and extension metadata', () => {
    const historical = { ...row, version: 0, blockNumber: 123n, bridgeProtocol: 'new-provider', extension: 'preserved' }
    expect(decodeLegacyNotifications([historical])).toEqual([historical])
  })
  it.each([
    null,
    {},
    [null],
    [{ ...row, address: undefined }],
    [{ ...row, chainId: -1 }],
    [{ ...row, status: 'invented' }],
    [{ ...row, version: 2 }],
    [{ ...row, txHash: '0xbad' }],
    [{ ...row, createdAt: NaN }],
    [{ ...row, lifecycleRecord: { version: 1 } }]
  ])('rejects unsupported history instead of silently dropping it: %j', (value) => {
    expect(() => decodeLegacyNotifications(value)).toThrow('Original history has been preserved')
  })
  it('rejects a mixed batch rather than presenting incomplete history as complete', () => {
    expect(() => decodeLegacyNotifications([row, { ...row, status: null }])).toThrow()
  })
  it('does not expose stored contents in decoder errors', () => {
    expect(() => decodeLegacyNotifications([{ ...row, amount: { secret: 'private' } }])).toThrow(
      /^Legacy transaction history contains unsupported records\. Original history has been preserved\.$/
    )
  })
})
