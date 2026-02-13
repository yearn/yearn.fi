import Link from '@components/Link'
import { VaultsListChip } from '@pages/vaults/components/list/VaultsListChip'
import { VaultTVL } from '@pages/vaults/components/table/VaultTVL'
import { getCategoryDescription, getChainDescription } from '@pages/vaults/utils/vaultTagCopy'
import { TokenLogo } from '@shared/components/TokenLogo'
import { formatPercent, toAddress } from '@shared/utils'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { getNetwork } from '@shared/utils/wagmi'
import type { ReactElement } from 'react'

type TExternalComparisonCardProps = {
  vault: TYDaemonVault
  externalProtocol: string
  externalApy: number
  yearnApy: number
  underlyingSymbol: string
}

export function ExternalComparisonCard({
  vault,
  externalProtocol,
  externalApy,
  yearnApy,
  underlyingSymbol
}: TExternalComparisonCardProps): ReactElement {
  const chain = getNetwork(vault.chainID)
  const tokenIcon = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${vault.chainID}/${toAddress(
    vault.token.address
  ).toLowerCase()}/logo-128.png`
  const chainLogoSrc = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${vault.chainID}/logo-32.png`
  const chainDescription = getChainDescription(vault.chainID)
  const categoryDescription = getCategoryDescription(vault.category)

  const apyDelta = yearnApy - externalApy
  const externalApyDisplay = formatPercent(externalApy * 100, 1, 1)
  const yearnApyDisplay = formatPercent(yearnApy * 100, 1, 1)
  const deltaDisplay = formatPercent(apyDelta * 100, 1, 1)

  return (
    <Link
      to={`/vaults/${vault.chainID}/${toAddress(vault.address)}`}
      className="group flex h-full flex-col rounded-lg border border-border bg-surface gap-3 px-6 pt-4 pb-4 shadow-[0_12px_32px_rgba(4,8,32,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(4,8,32,0.12)]"
    >
      <div className="flex items-center gap-3">
        <div className="relative flex shrink-0 items-center justify-center">
          <TokenLogo src={tokenIcon} tokenSymbol={vault.token.symbol || ''} width={36} height={36} />
          <div className="absolute -bottom-1 -left-1 flex size-4 items-center justify-center rounded-full border border-border bg-surface">
            <TokenLogo src={chainLogoSrc} tokenSymbol={chain.name} width={16} height={16} />
          </div>
        </div>
        <div className="flex min-w-0 flex-col">
          <p className="truncate text-base font-semibold text-text-primary">{vault.name}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <VaultsListChip
          label={chain.name}
          icon={<TokenLogo src={chainLogoSrc} tokenSymbol={chain.name} width={14} height={14} />}
          showIconInChip={false}
          tooltipDescription={chainDescription}
        />
        {vault.category ? (
          <VaultsListChip label={vault.category} tooltipDescription={categoryDescription || undefined} />
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 rounded-md bg-surface-secondary px-4 py-3">
        <div className="flex flex-col items-center">
          <p className="text-xs text-text-secondary">{externalProtocol}</p>
          <p className="text-lg font-bold text-text-primary">{externalApyDisplay}</p>
          <p className="text-[10px] uppercase tracking-wide text-text-secondary">{'APY'}</p>
        </div>
        <div className="flex flex-col items-center">
          <p className="text-xs font-semibold text-green-600">{`+${deltaDisplay}`}</p>
          <span className="text-text-secondary">{'→'}</span>
        </div>
        <div className="flex flex-col items-center">
          <p className="text-xs text-text-secondary">{'Yearn'}</p>
          <p className="text-lg font-bold text-green-600">{yearnApyDisplay}</p>
          <p className="text-[10px] uppercase tracking-wide text-text-secondary">{'APY'}</p>
        </div>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-text-secondary">{'TVL'}</p>
          <VaultTVL currentVault={vault} valueClassName="text-sm font-semibold text-text-primary" />
        </div>
        <p className="text-xs text-text-secondary">{`You hold ${underlyingSymbol}`}</p>
      </div>
    </Link>
  )
}
