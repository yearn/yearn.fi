import { cl, formatAmount, formatPercent } from '@lib/utils'
import { parseMarkdown } from '@lib/utils/helpers'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { getNetwork } from '@lib/utils/wagmi/utils'
import { deriveListKind } from '@vaults/utils/vaultListFacets'
import {
  getCategoryDescription,
  getChainDescription,
  getKindDescription,
  getProductTypeDescription,
  HIDDEN_TAG_DESCRIPTION,
  MIGRATABLE_TAG_DESCRIPTION,
  RETIRED_TAG_DESCRIPTION
} from '@vaults/utils/vaultTagCopy'
import type { ReactElement } from 'react'

type TVaultFeesLineItem = {
  children: ReactElement
  label: string
  tooltip?: string
}

export function VaultFeesLineItem({ children, label, tooltip }: TVaultFeesLineItem): ReactElement {
  return (
    <div className={'flex flex-col space-y-0 md:space-y-0'}>
      <p className={'text-xxs text-text-secondary md:text-xs'}>{label}</p>
      <div
        className={cl(
          tooltip
            ? 'tooltip underline decoration-neutral-600/30 decoration-dotted underline-offset-4 transition-opacity hover:decoration-neutral-600'
            : ''
        )}
      >
        {tooltip ? (
          <span suppressHydrationWarning className={'tooltipFees bottom-full'}>
            <div
              className={
                'w-96 rounded-xl border border-border bg-surface-secondary p-4 text-center text-xxs text-text-primary'
              }
            >
              {tooltip}
            </div>
          </span>
        ) : null}
        {children}
      </div>
    </div>
  )
}

type TInfoCard = {
  title: string
  children: ReactElement
  className?: string
}

function InfoCard({ title, children, className }: TInfoCard): ReactElement {
  return (
    <div className={cl('rounded-lg border border-border bg-surface-secondary p-4', className)}>
      <p className={'text-xxs text-text-secondary md:text-xs'}>{title}</p>
      <div className={'mt-2'}>{children}</div>
    </div>
  )
}

export function VaultAboutSection({
  currentVault,
  className,
  showKindTag = true,
  showHiddenTag = false,
  isHidden
}: {
  currentVault: TYDaemonVault
  className?: string
  showKindTag?: boolean
  showHiddenTag?: boolean
  isHidden?: boolean
}): ReactElement {
  const { token, apr } = currentVault
  const chainName = getNetwork(currentVault.chainID).name
  const listKind = deriveListKind(currentVault)
  const isAllocatorVault = listKind === 'allocator' || listKind === 'strategy'
  const isLegacyVault = listKind === 'legacy'
  const productTypeLabel = isAllocatorVault ? 'Single Asset Vault' : isLegacyVault ? 'Legacy' : 'LP Token Vault'
  const baseKindType: 'multi' | 'single' | undefined =
    currentVault.kind === 'Multi Strategy' ? 'multi' : currentVault.kind === 'Single Strategy' ? 'single' : undefined
  const fallbackKindType: 'multi' | 'single' | undefined =
    listKind === 'allocator' ? 'multi' : listKind === 'strategy' ? 'single' : undefined
  const kindType = baseKindType ?? fallbackKindType
  const kindLabel: string | undefined =
    kindType === 'multi' ? 'Allocator' : kindType === 'single' ? 'Strategy' : currentVault.kind
  const isMigratable = Boolean(currentVault.migration?.available)
  const isRetired = Boolean(currentVault.info?.isRetired)
  const resolvedHidden = typeof isHidden === 'boolean' ? isHidden : Boolean(currentVault.info?.isHidden)
  const shouldShowHidden = showHiddenTag && resolvedHidden
  const shouldShowKind = showKindTag && Boolean(kindLabel)
  const vaultTypeLabel = [productTypeLabel, shouldShowKind ? kindLabel : null].filter(Boolean).join(' | ')
  const chainDescription = getChainDescription(currentVault.chainID)
  const assetTypeLabel = currentVault.category ?? 'Not specified'
  const assetTypeDescription = getCategoryDescription(currentVault.category) ?? 'No asset category provided.'
  const productTypeDescription = getProductTypeDescription(listKind)
  const vaultKindDescription = shouldShowKind ? getKindDescription(kindType, kindLabel) : null
  const statusItems = [
    isRetired
      ? {
          key: 'retired',
          label: 'Retired',
          description: RETIRED_TAG_DESCRIPTION
        }
      : null,
    isMigratable
      ? {
          key: 'migratable',
          label: 'Migratable',
          description: MIGRATABLE_TAG_DESCRIPTION
        }
      : null,
    shouldShowHidden
      ? {
          key: 'hidden',
          label: 'Hidden',
          description: HIDDEN_TAG_DESCRIPTION
        }
      : null
  ].filter((item) => item?.description)

  function getVaultDescription(): string | ReactElement {
    if (currentVault.description) {
      return parseMarkdown(currentVault.description.replaceAll('{{token}}', currentVault.token.symbol))
    }
    if (token.description) {
      return parseMarkdown(token.description.replaceAll('{{token}}', currentVault.token.symbol))
    }
    return (
      <>
        Sorry, we don't have a description for this vault right now. To learn more about how Yearn Vaults work, check
        out our{' '}
        <a
          href="https://docs.yearn.fi"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-primary underline"
        >
          docs
        </a>
        , or if you want to learn more about this vault, head to our{' '}
        <a
          href="https://discord.gg/yearn"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-primary underline"
        >
          discord
        </a>{' '}
        or{' '}
        <a
          href="https://t.me/yearnfinance"
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-primary underline"
        >
          telegram
        </a>{' '}
        and ask.
      </>
    )
  }

  const vaultDescription = getVaultDescription()
  const isDescriptionString = typeof vaultDescription === 'string'

  return (
    <div className={cl('p-8 pt-0', className)}>
      <div className={'grid gap-4 md:grid-cols-2'}>
        <InfoCard title={'Description'}>
          <div className={'text-sm text-text-secondary'}>
            {isDescriptionString ? (
              <div
                // biome-ignore lint/security/noDangerouslySetInnerHtml: Controlled description content
                dangerouslySetInnerHTML={{
                  __html: vaultDescription as string
                }}
              />
            ) : (
              <div>{vaultDescription}</div>
            )}
          </div>
        </InfoCard>

        <InfoCard title={'Chain'}>
          <div className={'space-y-1'}>
            <p className={'text-sm font-semibold text-text-primary'}>{chainName}</p>
            <p className={'text-sm text-text-secondary'}>{chainDescription}</p>
          </div>
        </InfoCard>

        <InfoCard title={'Asset Type'}>
          <div className={'space-y-1'}>
            <p className={'text-sm font-semibold text-text-primary'}>{assetTypeLabel}</p>
            <p className={'text-sm text-text-secondary'}>{assetTypeDescription}</p>
          </div>
        </InfoCard>

        <InfoCard title={'Vault Type'}>
          <div className={'space-y-1'}>
            <p className={'text-sm font-semibold text-text-primary'}>{vaultTypeLabel || productTypeLabel}</p>
            <p className={'text-sm text-text-secondary'}>{productTypeDescription}</p>
            {vaultKindDescription ? <p className={'text-sm text-text-secondary'}>{vaultKindDescription}</p> : null}
          </div>
        </InfoCard>

        <InfoCard title={'Fees'}>
          <div className={'grid grid-cols-2 gap-4'}>
            <VaultFeesLineItem label={'Management'}>
              <p className={'text-xl text-text-primary'}>{formatPercent((apr.fees.management || 0) * 100, 0)}</p>
            </VaultFeesLineItem>
            <VaultFeesLineItem label={'Performance'}>
              <p className={'text-xl text-text-primary'}>{formatPercent((apr.fees.performance || 0) * 100, 0)}</p>
            </VaultFeesLineItem>
            {(currentVault.apr.forwardAPR.composite?.keepVELO || 0) > 0 ? (
              <VaultFeesLineItem
                label={'keepVELO'}
                tooltip={`Percentage of VELO locked in each harvest. This is used to boost ${currentVault.category} vault pools, and is offset via yvOP staking rewards.`}
              >
                <b className={'text-xl text-text-secondary'}>
                  {`${formatAmount((currentVault.apr.forwardAPR.composite?.keepVELO || 0) * 100, 0, 2)} %`}
                </b>
              </VaultFeesLineItem>
            ) : null}
          </div>
        </InfoCard>

        {statusItems.length > 0 ? (
          <InfoCard title={'Retired / Migration'}>
            <div className={'space-y-2'}>
              {statusItems.map((item) =>
                item ? (
                  <div key={item.key} className={'space-y-0.5'}>
                    <p className={'text-sm font-semibold text-text-primary'}>{item.label}</p>
                    <p className={'text-sm text-text-secondary'}>{item.description}</p>
                  </div>
                ) : null
              )}
            </div>
          </InfoCard>
        ) : null}
      </div>
    </div>
  )
}
