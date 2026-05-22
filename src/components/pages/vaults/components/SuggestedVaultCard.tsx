import { VaultsListChip } from '@pages/vaults/components/list/VaultsListChip'
import { VaultForwardAPY } from '@pages/vaults/components/table/VaultForwardAPY'
import { VaultTVL } from '@pages/vaults/components/table/VaultTVL'
import {
  getVaultAddress,
  getVaultCategory,
  getVaultChainID,
  getVaultName,
  getVaultToken,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import { useVaultApyData } from '@pages/vaults/hooks/useVaultApyData'
import { useYvUsdVaults } from '@pages/vaults/hooks/useYvUsdVaults'
import { deriveListKind } from '@pages/vaults/utils/vaultListFacets'
import { getVaultPrimaryLogoSrc } from '@pages/vaults/utils/vaultLogo'
import {
  getCategoryDescription,
  getChainDescription,
  getProductTypeDescription
} from '@pages/vaults/utils/vaultTagCopy'
import { isYvUsdVault, YVUSD_LOCKED_ADDRESS, YVUSD_LOCKED_COOLDOWN_DAYS } from '@pages/vaults/utils/yvUsd'
import { TokenLogo } from '@shared/components/TokenLogo'
import { formatApyDisplay, toAddress } from '@shared/utils'
import { getNetwork } from '@shared/utils/wagmi'
import Link from 'next/link'
import type { ReactElement } from 'react'
import { env } from '@/env'

export function SuggestedVaultCard({
  vault,
  matchedSymbol,
  externalProtocol,
  matchedChainName
}: {
  vault: TKongVaultInput
  matchedSymbol?: string
  externalProtocol?: string
  matchedChainName?: string
}): ReactElement {
  const apyData = useVaultApyData(vault)
  const apyLabel = apyData.mode === 'historical' || apyData.mode === 'noForward' ? '30D APY' : 'Est. APY'
  const chainID = getVaultChainID(vault)
  const vaultAddress = getVaultAddress(vault)
  const token = getVaultToken(vault)
  const vaultCategory = getVaultCategory(vault)
  const yvUsdVaults = useYvUsdVaults()
  const isYvUsd = isYvUsdVault(vault)
  const isYvUsdLocked = isYvUsd && vaultAddress === YVUSD_LOCKED_ADDRESS
  const vaultName = isYvUsd
    ? isYvUsdLocked
      ? `yvUSD (${YVUSD_LOCKED_COOLDOWN_DAYS} day lock)`
      : 'yvUSD (Unlocked)'
    : getVaultName(vault)
  const yvUsdApy = isYvUsdLocked ? yvUsdVaults.metrics.locked.apy : yvUsdVaults.metrics.unlocked.apy

  const chain = getNetwork(chainID)
  const tokenIcon = isYvUsd
    ? getVaultPrimaryLogoSrc(vault)
    : `${env.NEXT_PUBLIC_BASE_YEARN_ASSETS_URI}/tokens/${chainID}/${toAddress(token.address).toLowerCase()}/logo-128.png`
  const chainLogoSrc = `${env.NEXT_PUBLIC_BASE_YEARN_ASSETS_URI}/chains/${chainID}/logo-32.png`
  const listKind = deriveListKind(vault)
  const isAllocatorVault = listKind === 'allocator' || listKind === 'strategy'
  const isLegacyVault = listKind === 'legacy'

  const productTypeLabel = isAllocatorVault ? 'Single Asset' : isLegacyVault ? 'Legacy' : 'LP Token'
  const chainDescription = getChainDescription(chainID)
  const categoryDescription = getCategoryDescription(vaultCategory)
  const productTypeDescription = getProductTypeDescription(listKind)
  const matchedReason = matchedSymbol
    ? externalProtocol
      ? `You hold ${matchedSymbol} on ${externalProtocol}${matchedChainName ? ` on ${matchedChainName}` : ''}`
      : `You hold ${matchedSymbol}${matchedChainName ? ` on ${matchedChainName}` : ''}`
    : null

  return (
    <Link
      href={`/vaults/${chainID}/${toAddress(vaultAddress)}`}
      className={
        'group flex h-fit min-h-[156px] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-[0_12px_32px_rgba(4,8,32,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(4,8,32,0.12)]'
      }
    >
      <div className={'flex flex-1 flex-col gap-2 px-6 pb-4 pt-4'}>
        <div className={'flex items-center gap-3'}>
          <div className={'relative flex shrink-0 items-center justify-center'}>
            <TokenLogo src={tokenIcon} tokenSymbol={token.symbol || ''} width={36} height={36} />
            <div
              className={
                'absolute -bottom-1 -left-1 flex size-4 items-center justify-center rounded-full border border-border bg-surface'
              }
            >
              <TokenLogo src={chainLogoSrc} tokenSymbol={chain.name} width={16} height={16} />
            </div>
          </div>
          <div className={'flex min-w-0 flex-col'}>
            <p className={'truncate text-base font-semibold text-text-primary'}>{vaultName}</p>
          </div>
        </div>
        <div className={'mt-1 flex flex-wrap items-center gap-1'}>
          <VaultsListChip
            label={chain.name}
            icon={<TokenLogo src={chainLogoSrc} tokenSymbol={chain.name} width={14} height={14} />}
            showIconInChip={false}
            tooltipDescription={chainDescription}
          />
          {vaultCategory ? (
            <VaultsListChip label={vaultCategory} tooltipDescription={categoryDescription || undefined} />
          ) : null}
          <VaultsListChip
            label={productTypeLabel}
            tooltipDescription={productTypeDescription}
            isCollapsed
            showCollapsedTooltip
          />
        </div>
        <div className={'flex items-end justify-between gap-4'}>
          <div>
            <p className={'text-mobile-label text-xs uppercase tracking-wide text-text-secondary'}>
              {isYvUsd ? (isYvUsdLocked ? 'Locked APY' : 'Unlocked APY') : apyLabel}
            </p>
            <div className={'mt-0'}>
              {isYvUsd ? (
                <span className={'text-xl font-bold text-text-primary'}>{formatApyDisplay(yvUsdApy)}</span>
              ) : (
                <VaultForwardAPY
                  currentVault={vault}
                  className={'items-start text-left md:text-left'}
                  valueClassName={'text-xl font-bold text-text-primary'}
                  showSubline={false}
                  showSublineTooltip
                />
              )}
            </div>
          </div>
          <div className={'text-left'}>
            <p className={'text-mobile-label text-xs uppercase tracking-wide text-text-secondary'}>{'TVL'}</p>
            <div className={'mt-0'}>
              <VaultTVL currentVault={vault} valueClassName={'text-xl font-semibold text-text-primary'} />
            </div>
          </div>
        </div>
      </div>
      {matchedReason ? (
        <div className={'flex h-7 items-center gap-1.5 truncate bg-primary px-6 text-xs font-semibold text-white'}>
          <span className={'truncate'}>{matchedReason}</span>
        </div>
      ) : null}
    </Link>
  )
}
