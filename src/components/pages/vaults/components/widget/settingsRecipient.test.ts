import type { Address } from 'viem'
import { describe, expect, it } from 'vitest'
import { getSettingsRecipientState } from './settingsRecipient'

const ACCOUNT = '0x0000000000000000000000000000000000000001' as Address
const RECIPIENT = '0x0000000000000000000000000000000000000002' as Address

describe('getSettingsRecipientState', () => {
  it('uses the connected wallet for blank input or the default address', () => {
    expect(getSettingsRecipientState('  ', ACCOUNT)).toEqual({ error: null, recipient: undefined })
    expect(getSettingsRecipientState(ACCOUNT.toLowerCase(), ACCOUNT)).toEqual({
      error: null,
      recipient: undefined
    })
  })

  it('normalizes a valid custom recipient', () => {
    expect(getSettingsRecipientState(RECIPIENT.toLowerCase(), ACCOUNT)).toEqual({
      error: null,
      recipient: RECIPIENT
    })
  })

  it('rejects invalid and zero addresses', () => {
    expect(getSettingsRecipientState('not-an-address', ACCOUNT).error).toBe('Enter a valid nonzero EVM address.')
    expect(getSettingsRecipientState('0x0000000000000000000000000000000000000000', ACCOUNT).error).toBe(
      'Enter a valid nonzero EVM address.'
    )
  })
})
