import { describe, expect, it } from 'vitest'
import { isSafeConnectorId } from './walletConnectors'

describe('isSafeConnectorId', () => {
  it('matches the actual Safe connector id', () => {
    expect(isSafeConnectorId('safe')).toBe(true)
    expect(isSafeConnectorId('SAFE')).toBe(true)
  })

  it('does not treat wallets with safe in their id as Safe apps', () => {
    expect(isSafeConnectorId('safepal')).toBe(false)
    expect(isSafeConnectorId('safeheron')).toBe(false)
    expect(isSafeConnectorId('rabby')).toBe(false)
    expect(isSafeConnectorId()).toBe(false)
  })
})
