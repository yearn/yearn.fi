import type { TDict } from '@shared/types'
import { toAddress } from '@shared/utils'
import type { TKongVaultListItem } from '@shared/utils/schemas/kongVaultListSchema'
import { type Address, isAddressEqual, zeroAddress } from 'viem'
import type { TSwapSelection } from './swapParams'

type TSwapVaultPolicyEntry = {
  address: Address
  chainId: number
  isHidden: boolean
  isRetired: boolean
  stakingAddress?: Address
}

export type TSwapSelectionPolicy = {
  isAllowed: boolean
  isReady: boolean
  message?: string
}

export function buildSwapVaultPolicyEntries(allVaults: TDict<TKongVaultListItem>): TSwapVaultPolicyEntry[] {
  return Object.values(allVaults).map((vault) => ({
    address: toAddress(vault.address),
    chainId: vault.chainId,
    isHidden: vault.isHidden,
    isRetired: vault.isRetired,
    stakingAddress:
      vault.staking?.address && !isAddressEqual(vault.staking.address, zeroAddress)
        ? toAddress(vault.staking.address)
        : undefined
  }))
}

export function getSwapSelectionPolicy({
  entries,
  isLoading,
  selection
}: {
  entries: TSwapVaultPolicyEntry[]
  isLoading: boolean
  selection: TSwapSelection
}): TSwapSelectionPolicy {
  if (isLoading) {
    return { isAllowed: false, isReady: false }
  }

  const findEntry = (chainId: number, address: Address): TSwapVaultPolicyEntry | undefined =>
    entries.find(
      (entry) =>
        entry.chainId === chainId &&
        (isAddressEqual(entry.address, address) ||
          Boolean(entry.stakingAddress && isAddressEqual(entry.stakingAddress, address)))
    )
  const fromEntry = findEntry(selection.fromChainId, selection.fromToken)
  const toEntry = findEntry(selection.toChainId, selection.toToken)

  if (fromEntry?.isHidden || toEntry?.isHidden) {
    return {
      isAllowed: false,
      isReady: true,
      message: 'Hidden vault tokens cannot be swapped.'
    }
  }

  if (toEntry?.isRetired) {
    return {
      isAllowed: false,
      isReady: true,
      message: 'Retired vault tokens can only be selected as the asset you pay.'
    }
  }

  return { isAllowed: true, isReady: true }
}
