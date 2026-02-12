import Link from '@components/Link'
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
import { deriveListKind } from '@pages/vaults/utils/vaultListFacets'
import {
  getCategoryDescription,
  getChainDescription,
  getProductTypeDescription
} from '@pages/vaults/utils/vaultTagCopy'
import { TokenLogo } from '@shared/components/TokenLogo'
import { toAddress } from '@shared/utils'
import { getNetwork } from '@shared/utils/wagmi'
import type { ReactElement } from 'react'

export function SuggestedVaultCard({ vault }: { vault: TKongVaultInput }): ReactElement {
  const apyData = useVaultApyData(vault)
  const apyLabel = apyData.mode === 'historical' || apyData.mode === 'noForward' ? '30D APY' : 'Est. APY'
  const chainID = getVaultChainID(vault)
  const vaultAddress = getVaultAddress(vault)
  const token = getVaultToken(vault)
  const vaultName = getVaultName(vault)
  const vaultCategory = getVaultCategory(vault)

  const chain = getNetwork(chainID)
  const tokenIcon = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${chainID}/${toAddress(token.address).toLowerCase()}/logo-128.png`
  const chainLogoSrc = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${chainID}/logo-32.png`
  const listKind = deriveListKind(vault)
  const isAllocatorVault = listKind === 'allocator' || listKind === 'strategy'
  const isLegacyVault = listKind === 'legacy'
  const productTypeLabel = isAllocatorVault ? 'Single Asset' : isLegacyVault ? 'Legacy' : 'LP Token'
  const chainDescription = getChainDescription(chainID)
  const categoryDescription = getCategoryDescription(vaultCategory)
  const productTypeDescription = getProductTypeDescription(listKind)

  return (
    <Link
      to={`/vaults/${chainID}/${toAddress(vaultAddress)}`}
      className={
        'group flex h-full flex-col rounded-lg border border-border bg-surface gap-2 px-6 pt-4 pb-4 shadow-[0_12px_32px_rgba(4,8,32,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(4,8,32,0.12)]'
      }
    >
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
      <div className={'mt-1 flex items-end justify-between gap-4'}>
        <div>
          <p className={'text-mobile-label text-xs uppercase tracking-wide text-text-secondary'}>{apyLabel}</p>
          <div className={'mt-0'}>
            <VaultForwardAPY
              currentVault={vault}
              className={'items-start text-left md:text-left'}
              valueClassName={'text-xl font-bold text-text-primary'}
              showSubline={false}
              showSublineTooltip
            />
          </div>
        </div>
        <div className={'text-left'}>
          <p className={'text-mobile-label text-xs uppercase tracking-wide text-text-secondary'}>{'TVL'}</p>
          <div className={'mt-0'}>
            <VaultTVL currentVault={vault} valueClassName={'text-xl font-semibold text-text-primary'} />
          </div>
        </div>
      </div>
      {/* <div
        className={
          'mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#0657F9] transition-colors group-hover:text-[#0543c0]'
        }
      >
        <span>{'View vault'}</span>
        <span aria-hidden>{'→'}</span>
      </div> */}
    </Link>
  )
}
