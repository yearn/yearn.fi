import { WidgetActionType } from '@pages/vaults/types'
import { isYvBtcAddress, YVBTC_CHAIN_ID } from '@pages/vaults/utils/yvBtc'
import type { TKongVaultSnapshot } from '@shared/utils/schemas/kongVaultSnapshotSchema'
import { truncateHex } from '@shared/utils/tools.address'

export const NON_YEARN_ERC4626_WARNING_MESSAGE =
  'This is a non-Yearn ERC-4626 Vault. Please be careful when interacting with it.'

type TVaultOriginInput = Pick<TKongVaultSnapshot, 'chainId' | 'origin' | 'inclusion'> & { address: string }

export function isNonYearnErc4626Vault({ vault }: { vault?: TVaultOriginInput }): boolean {
  if (!vault) {
    return false
  }
  if (vault.inclusion?.isYearn === false) {
    return true
  }
  return vault.origin !== 'yearn' && !(vault.chainId === YVBTC_CHAIN_ID && isYvBtcAddress(vault.address))
}

export function getNonYearnAcknowledgementStorageKey(chainId: number, address: string): string {
  return `yearn.fi/non-yearn-vault-acknowledged@0.0.1/${chainId}/${address.toLowerCase()}`
}

// Every action except Withdraw moves funds into a contract the vault controls, so it waits for the acknowledgement.
export function requiresNonYearnAcknowledgement({
  action,
  isNonYearnVault,
  hasAcknowledged
}: {
  action: WidgetActionType
  isNonYearnVault: boolean
  hasAcknowledged: boolean
}): boolean {
  return isNonYearnVault && !hasAcknowledged && action !== WidgetActionType.Withdraw
}

export function getVaultHeadingName({
  name,
  address,
  isNonYearnVault
}: {
  name: string
  address: string
  isNonYearnVault: boolean
}): string {
  return isNonYearnVault ? `${name} · ${truncateHex(address, 4)}` : name
}
