import type { TKongVault } from '@pages/vaults/domain/kongVaultSelectors'
import { isNonYearnErc4626Vault } from '@pages/vaults/domain/vaultWarnings'
import { toAddress } from '@shared/utils'
import type { TKongVaultSnapshot } from '@shared/utils/schemas/kongVaultSnapshotSchema'

const isSnapshotLikelyV3Vault = (snapshot: TKongVaultSnapshot): boolean => {
  const apiVersion = snapshot.apiVersion ?? ''
  if (apiVersion.startsWith('3') || apiVersion.startsWith('~3')) {
    return true
  }

  const normalizedKind = snapshot.meta?.kind?.toLowerCase() ?? ''
  if (normalizedKind === 'single strategy' || normalizedKind === 'multi strategy') {
    return true
  }

  return (snapshot.composition?.length ?? 0) > 0 || (snapshot.strategies?.length ?? 0) > 0
}

export const buildSnapshotBackedVault = (
  snapshot: TKongVaultSnapshot,
  route: { chainId: number; address: string }
): TKongVault => {
  const token = snapshot.meta?.token
  const asset = snapshot.asset
    ? {
        address: snapshot.asset.address,
        name: snapshot.asset.name,
        symbol: snapshot.asset.symbol,
        decimals: snapshot.asset.decimals
      }
    : token
      ? {
          address: token.address,
          name: token.name,
          symbol: token.symbol,
          decimals: token.decimals
        }
      : null

  const vault: TKongVault = {
    chainId: route.chainId,
    address: toAddress(route.address),
    name: snapshot.name || snapshot.meta?.name || snapshot.meta?.displayName || '',
    symbol: snapshot.symbol || snapshot.meta?.displaySymbol || null,
    apiVersion: snapshot.apiVersion ?? null,
    decimals: snapshot.decimals ?? token?.decimals ?? asset?.decimals ?? null,
    asset,
    tvl: snapshot.tvl?.close ?? null,
    performance: null,
    fees: null,
    category: snapshot.meta?.category ?? null,
    type: snapshot.meta?.type ?? null,
    kind: snapshot.meta?.kind ?? null,
    v3: isSnapshotLikelyV3Vault(snapshot),
    yearn: false,
    isRetired: snapshot.meta?.isRetired ?? false,
    isHidden: snapshot.meta?.isHidden ?? false,
    isBoosted: snapshot.meta?.isBoosted ?? false,
    isHighlighted: snapshot.meta?.isHighlighted ?? false,
    inclusion: snapshot.inclusion,
    migration: snapshot.meta?.migration?.available,
    origin: snapshot.origin ?? null,
    strategiesCount: snapshot.composition?.length ?? snapshot.debts?.length ?? 0,
    riskLevel: snapshot.risk?.riskLevel ?? null,
    staking: snapshot.staking
      ? {
          address: snapshot.staking.address ?? null,
          available: snapshot.staking.available,
          source: snapshot.staking.source ?? '',
          rewards: (snapshot.staking.rewards ?? []).map((reward) => ({
            ...reward,
            decimals: reward.decimals ?? 18,
            isFinished: reward.isFinished ?? false
          }))
        }
      : null
  }

  return { ...vault, yearn: !isNonYearnErc4626Vault({ vault }) }
}
