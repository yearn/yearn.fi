import Link from '@components/Link'
import { VaultsListChip } from '@pages/vaults/components/list/VaultsListChip'
import { useVaultApyData } from '@pages/vaults/hooks/useVaultApyData'
import { deriveListKind } from '@pages/vaults/utils/vaultListFacets'
import {
  getCategoryDescription,
  getChainDescription,
  getProductTypeDescription
} from '@pages/vaults/utils/vaultTagCopy'
import { RenderAmount } from '@shared/components/RenderAmount'
import { TokenLogo } from '@shared/components/TokenLogo'
import { IconRewind } from '@shared/icons/IconRewind'
import { IconStablecoin } from '@shared/icons/IconStablecoin'
import { IconVolatile } from '@shared/icons/IconVolatile'
import { toAddress } from '@shared/utils'
import { formatPercent } from '@shared/utils/format'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { getNetwork } from '@shared/utils/wagmi'
import type { ReactElement } from 'react'
import { useMemo } from 'react'

type TAprDisplay =
  | {
      type: 'value'
      label: string
      prefix?: string
      value: number
    }
  | {
      type: 'range'
      label: string
      prefix?: string
      range: [number, number]
    }

export function SuggestedVaultCard({ vault }: { vault: TYDaemonVault }): ReactElement {
  const apyData = useVaultApyData(vault)
  const aprDisplay = useMemo<TAprDisplay>(() => {
    const isV3Vault = vault.version?.startsWith('3') || vault.version?.startsWith('~3')
    const isVeYfi = vault.staking.source === 'VeYFI'
    const boostedApr = apyData.baseForwardApr + apyData.rewardsAprSum
    if (apyData.mode === 'historical' || apyData.mode === 'noForward') {
      return { type: 'value', label: '30D APY', value: apyData.netApr }
    }
    if (apyData.mode === 'katana' && apyData.katanaEstApr !== undefined) {
      return {
        type: 'value',
        label: 'Est. APY',
        prefix: '',
        value: apyData.katanaEstApr
      }
    }
    if (apyData.mode === 'rewards') {
      if (isVeYfi && apyData.estAprRange) {
        return {
          type: 'range',
          label: 'Est. APY',
          prefix: '⚡️',
          range: apyData.estAprRange
        }
      }
      return {
        type: 'value',
        label: 'Est. APY',
        prefix: '⚡️',
        value: boostedApr
      }
    }
    if (apyData.mode === 'boosted' && apyData.isBoosted) {
      return {
        type: 'value',
        label: 'Est. APY',
        prefix: isV3Vault ? '🚀' : undefined,
        value: apyData.baseForwardApr
      }
    }
    return { type: 'value', label: 'Est. APY', value: apyData.baseForwardApr }
  }, [apyData, vault])

  const chain = getNetwork(vault.chainID)
  const tokenIcon = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${vault.chainID}/${toAddress(
    vault.token.address
  ).toLowerCase()}/logo-128.png`
  const chainLogoSrc = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${vault.chainID}/logo-32.png`
  const listKind = deriveListKind(vault)
  const isAllocatorVault = listKind === 'allocator' || listKind === 'strategy'
  const isLegacyVault = listKind === 'legacy'
  const productTypeLabel = isAllocatorVault ? 'Single Asset Vault' : isLegacyVault ? 'Legacy' : 'LP Token Vault'
  const productTypeIcon = isAllocatorVault ? (
    <span className={'text-sm leading-none'}>{'⚙️'}</span>
  ) : isLegacyVault ? (
    <IconRewind className={'size-3.5'} />
  ) : (
    <span className={'text-sm leading-none'}>{'🏭'}</span>
  )
  const categoryIcon: ReactElement | null =
    vault.category === 'Stablecoin' ? (
      <IconStablecoin className={'size-3.5'} />
    ) : vault.category === 'Volatile' ? (
      <IconVolatile className={'size-3.5'} />
    ) : null
  const chainDescription = getChainDescription(vault.chainID)
  const categoryDescription = getCategoryDescription(vault.category)
  const productTypeDescription = getProductTypeDescription(listKind)

  const renderAprValue = (): string => {
    if (aprDisplay.type === 'range') {
      return `${formatPercent(aprDisplay.range[0] * 100, 2, 2)} – ${formatPercent(aprDisplay.range[1] * 100, 2, 2)}`
    }
    return formatPercent(aprDisplay.value * 100, 2, 2)
  }

  return (
    <Link
      to={`/vaults/${vault.chainID}/${toAddress(vault.address)}`}
      className={
        'group flex h-full flex-col rounded-md border border-border bg-surface px-4 pt-3 pb-2 shadow-[0_12px_32px_rgba(4,8,32,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(4,8,32,0.12)]'
      }
    >
      <div className={'flex items-center gap-3'}>
        <div className={'shrink-0'}>
          <TokenLogo src={tokenIcon} tokenSymbol={vault.token.symbol || ''} width={36} height={36} />
        </div>
        <div className={'flex min-w-0 flex-col'}>
          <p className={'truncate text-base font-semibold text-text-primary'}>{vault.name}</p>
        </div>
      </div>
      <div className={'mt-0 flex flex-wrap items-center gap-1'}>
        <VaultsListChip
          label={chain.name}
          icon={<TokenLogo src={chainLogoSrc} tokenSymbol={chain.name} width={14} height={14} />}
          tooltipDescription={chainDescription}
        />
        {vault.category ? (
          <VaultsListChip
            label={vault.category}
            icon={categoryIcon || undefined}
            tooltipDescription={categoryDescription || undefined}
          />
        ) : null}
        <VaultsListChip
          label={productTypeLabel}
          icon={productTypeIcon}
          tooltipDescription={productTypeDescription}
          isCollapsed
          showCollapsedTooltip
        />
      </div>
      <div className={'mt-1 flex items-end justify-between gap-4'}>
        <div>
          <p className={'text-mobile-label font-semibold uppercase tracking-wide text-text-secondary'}>
            {aprDisplay.label}
          </p>
          <p className={'mt-1 text-2xl font-bold text-text-primary'}>
            {aprDisplay.prefix ? `${aprDisplay.prefix} ` : ''}
            {renderAprValue()}
          </p>
        </div>
        <div className={'text-right'}>
          <p className={'text-mobile-label font-semibold uppercase tracking-wide text-text-secondary'}>{'TVL'}</p>
          <p className={'mt-1 text-lg font-semibold text-text-primary'}>
            <RenderAmount
              value={vault.tvl?.tvl || 0}
              symbol={'USD'}
              decimals={0}
              options={{
                shouldCompactValue: true,
                maximumFractionDigits: 2,
                minimumFractionDigits: 0
              }}
            />
          </p>
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
