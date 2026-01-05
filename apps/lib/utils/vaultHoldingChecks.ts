import { toAddress } from '@lib/utils'
import { ETH_TOKEN_ADDRESS } from '@lib/utils/constants'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { getNativeTokenWrapperContract } from '@vaults-v2/utils'

type TGetBalance = (args: { address: string; chainID: number }) => { raw: bigint; normalized: number }
type TGetPrice = (args: { address: string; chainID: number }) => { normalized: number }

export type TVaultWithMetadata = {
  vault: TYDaemonVault
  hasHoldings: boolean
  hasAvailableBalance: boolean
  isHoldingsVault: boolean
  isMigratableVault: boolean
  isRetiredVault: boolean
}

export type TVaultFlags = {
  hasHoldings: boolean
  isMigratable: boolean
  isRetired: boolean
}

export function checkVaultHasHoldings(
  vault: TYDaemonVault,
  getBalance: TGetBalance,
  getPrice: TGetPrice,
  shouldHideDust: boolean
): boolean {
  const vaultBalance = getBalance({ address: vault.address, chainID: vault.chainID })
  const vaultPrice = getPrice({ address: vault.address, chainID: vault.chainID })

  if (vault.staking.available) {
    const stakingBalance = getBalance({
      address: vault.staking.address,
      chainID: vault.chainID
    })
    const hasValidStakedBalance = stakingBalance.raw > 0n
    const stakedBalanceValue = Number(stakingBalance.normalized) * vaultPrice.normalized
    if (hasValidStakedBalance && !(shouldHideDust && stakedBalanceValue < 0.01)) {
      return true
    }
  }

  const hasValidBalance = vaultBalance.raw > 0n
  const balanceValue = Number(vaultBalance.normalized) * vaultPrice.normalized

  return hasValidBalance && !(shouldHideDust && balanceValue < 0.01)
}

export function checkVaultHasAvailableBalance(vault: TYDaemonVault, getBalance: TGetBalance): boolean {
  const wantBalance = getBalance({ address: vault.token.address, chainID: vault.chainID })
  if (wantBalance.raw > 0n) {
    return true
  }

  const nativeWrapper = getNativeTokenWrapperContract(vault.chainID)
  if (toAddress(vault.token.address) === toAddress(nativeWrapper)) {
    const nativeBalance = getBalance({ address: ETH_TOKEN_ADDRESS, chainID: vault.chainID })
    if (nativeBalance.raw > 0n) {
      return true
    }
  }

  return false
}

export function matchesSearchFilter(vault: TYDaemonVault, search: string): boolean {
  const searchableText = `${vault.name} ${vault.symbol} ${vault.token.name} ${vault.token.symbol} ${vault.address} ${vault.token.address}`

  try {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const searchRegex = new RegExp(escapedSearch, 'i')
    return searchRegex.test(searchableText)
  } catch {
    return searchableText.toLowerCase().includes(search.toLowerCase())
  }
}

export function isV3Vault(vault: TYDaemonVault): boolean {
  return vault.version?.startsWith('3') || vault.version?.startsWith('~3') || false
}

export function isV2Vault(vault: TYDaemonVault): boolean {
  return !isV3Vault(vault)
}

export function getVaultKey(vault: TYDaemonVault): string {
  return `${vault.chainID}_${toAddress(vault.address)}`
}
