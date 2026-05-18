import {
  getVaultAddress,
  getVaultChainID,
  getVaultName,
  getVaultStaking,
  getVaultToken,
  getVaultYieldSplitter,
  type TKongVault,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import { getCanonicalHoldingsVaultAddress } from '@pages/vaults/domain/normalizeVault'
import type { TDict } from '@shared/types'
import type { TAddress } from '@shared/types/address'
import type { TNormalizedBN } from '@shared/types/mixed'
import { isZeroAddress, toAddress } from '@shared/utils'

type TBalanceGetter = (params: { address: TAddress; chainID: number }) => TNormalizedBN

export type TYieldSplitterModeOption = {
  id: string
  vaultAddress: `0x${string}`
  label: string
  shortLabel: string
  description: string
  isNative: boolean
  vault: TKongVaultInput
}

export type TYieldSplitterHoldingsSummary = {
  label: string
  tooltip: string
  preferredVaultAddress?: `0x${string}`
}

function getYieldModeSortKey(vault: TKongVaultInput): string {
  const yieldSplitter = getVaultYieldSplitter(vault)
  return (
    yieldSplitter?.wantVaultSymbol ||
    yieldSplitter?.wantVaultName ||
    getVaultName(vault) ||
    getVaultAddress(vault)
  ).toLowerCase()
}

export function getYieldSplitterSourceVaultAddress(vault: TKongVaultInput | undefined): `0x${string}` | undefined {
  if (!vault) {
    return undefined
  }
  return getVaultYieldSplitter(vault)?.sourceVaultAddress
}

export function getYieldSplitterVariantVaults(
  sourceVaultAddress: TAddress | undefined,
  allVaults: TDict<TKongVault>
): TKongVault[] {
  if (!sourceVaultAddress) {
    return []
  }

  const normalizedSourceVaultAddress = toAddress(sourceVaultAddress)
  const sourceVault = allVaults[normalizedSourceVaultAddress]
  const sourceVaultChainID = sourceVault ? getVaultChainID(sourceVault) : undefined

  return Object.values(allVaults)
    .filter((vault) => {
      const yieldSplitter = getVaultYieldSplitter(vault)
      if (!yieldSplitter?.enabled) {
        return false
      }

      return (
        (sourceVaultChainID === undefined || getVaultChainID(vault) === sourceVaultChainID) &&
        toAddress(yieldSplitter.sourceVaultAddress) === normalizedSourceVaultAddress
      )
    })
    .sort((left, right) => getYieldModeSortKey(left).localeCompare(getYieldModeSortKey(right)))
}

export function getSourceVaultYieldModeOptions(
  sourceVault: TKongVaultInput | undefined,
  allVaults: TDict<TKongVault>
): TYieldSplitterModeOption[] {
  if (!sourceVault) {
    return []
  }

  const sourceVaultAddress = getVaultAddress(sourceVault)
  const nativeSymbol =
    getVaultYieldSplitter(sourceVault)?.depositAssetSymbol || getVaultToken(sourceVault).symbol || 'native'
  const nativeName = getVaultYieldSplitter(sourceVault)?.depositAssetName || getVaultName(sourceVault)
  const variantVaults = getYieldSplitterVariantVaults(sourceVaultAddress, allVaults)

  return [
    {
      id: 'native',
      vaultAddress: sourceVaultAddress,
      label: `Compound ${nativeSymbol}`,
      shortLabel: 'Native',
      description: `Deposit into ${nativeName} and compound yield natively.`,
      isNative: true,
      vault: sourceVault
    },
    ...variantVaults.map((variantVault) => {
      const yieldSplitter = getVaultYieldSplitter(variantVault)
      const wantLabel = yieldSplitter?.wantVaultSymbol || yieldSplitter?.wantVaultName || getVaultName(variantVault)
      return {
        id: toAddress(getVaultAddress(variantVault)),
        vaultAddress: toAddress(getVaultAddress(variantVault)),
        label: `Earn ${wantLabel}`,
        shortLabel: wantLabel,
        description:
          yieldSplitter?.uiDescription ||
          `Deposit into ${getVaultName(sourceVault)} and route yield into ${wantLabel}.`,
        isNative: false,
        vault: variantVault
      }
    })
  ]
}

function hasHeldBalanceForVault(vault: TKongVaultInput, getBalance: TBalanceGetter): boolean {
  const chainID = getVaultChainID(vault)
  const directBalance = getBalance({ address: getVaultAddress(vault), chainID })
  if (directBalance.raw > 0n) {
    return true
  }

  const staking = getVaultStaking(vault)
  if (isZeroAddress(staking.address)) {
    return false
  }

  return getBalance({ address: staking.address, chainID }).raw > 0n
}

export function getHeldYieldSplitterModeSummary(
  sourceVault: TKongVaultInput | undefined,
  allVaults: TDict<TKongVault>,
  getBalance: TBalanceGetter
): TYieldSplitterHoldingsSummary | null {
  if (!sourceVault) {
    return null
  }

  const heldVariants = getYieldSplitterVariantVaults(getVaultAddress(sourceVault), allVaults).filter((variantVault) =>
    hasHeldBalanceForVault(variantVault, getBalance)
  )

  if (heldVariants.length === 0) {
    return null
  }

  const heldLabels = heldVariants.map((variantVault) => {
    const yieldSplitter = getVaultYieldSplitter(variantVault)
    return yieldSplitter?.wantVaultSymbol || yieldSplitter?.wantVaultName || getVaultName(variantVault)
  })

  if (heldLabels.length === 1) {
    return {
      label: `Earning ${heldLabels[0]}`,
      tooltip: `This position routes yield into ${heldLabels[0]}.`,
      preferredVaultAddress: getVaultAddress(heldVariants[0])
    }
  }

  return {
    label: `${heldLabels.length} yield modes`,
    tooltip: `This position is split across ${heldLabels.join(', ')} reward routes.`
  }
}

export function getCanonicalSourceVaultAddressForRoute(
  routeVaultAddress: TAddress | undefined,
  allVaults: TDict<TKongVault>
): `0x${string}` | undefined {
  if (!routeVaultAddress) {
    return undefined
  }

  const normalizedAddress = toAddress(routeVaultAddress)
  const directVault = allVaults[normalizedAddress]
  const directSourceAddress = getYieldSplitterSourceVaultAddress(directVault)

  if (directSourceAddress) {
    return directSourceAddress
  }

  const canonicalAddress = getCanonicalHoldingsVaultAddress(normalizedAddress)
  return canonicalAddress === normalizedAddress ? undefined : canonicalAddress
}
