import { type Address, getAddress, isAddress, isAddressEqual, zeroAddress } from 'viem'

export type TSettingsRecipientState = {
  error: string | null
  recipient: Address | undefined
}

export function getSettingsRecipientState(value: string, defaultRecipient?: Address): TSettingsRecipientState {
  const normalizedValue = value.trim()
  if (!normalizedValue) {
    return { error: null, recipient: undefined }
  }

  if (!isAddress(normalizedValue)) {
    return { error: 'Enter a valid nonzero EVM address.', recipient: undefined }
  }

  const recipient = getAddress(normalizedValue)
  if (isAddressEqual(recipient, zeroAddress)) {
    return { error: 'Enter a valid nonzero EVM address.', recipient: undefined }
  }

  return {
    error: null,
    recipient: defaultRecipient && isAddressEqual(recipient, defaultRecipient) ? undefined : recipient
  }
}
