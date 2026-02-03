import { deriveListKind } from '@pages/vaults/utils/vaultListFacets'
import {
  getCategoryDescription,
  getChainDescription,
  getChainWebsite,
  getKindDescription,
  getProductTypeDescription
} from '@pages/vaults/utils/vaultTagCopy'
import { Markdown } from '@shared/components/Markdown'
import { TokenLogo } from '@shared/components/TokenLogo'
import { IconChevron } from '@shared/icons/IconChevron'
import { IconCopy } from '@shared/icons/IconCopy'
import { IconLinkOut } from '@shared/icons/IconLinkOut'
import { cl, formatPercent } from '@shared/utils'
import { copyToClipboard } from '@shared/utils/helpers'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { getNetwork } from '@shared/utils/wagmi/utils'
import { type ReactElement, type ReactNode, useState } from 'react'

type TInlineHeading = {
  label: string
  value: ReactNode
  icon?: ReactNode
  suffix?: ReactNode
}

function InlineHeading({ label, value, icon, suffix }: TInlineHeading): ReactElement {
  return (
    <div className={'flex flex-wrap items-center gap-2 text-sm'}>
      <span className={'sr-only'}>{`${label}:`}</span>
      <span className={'flex items-center gap-1 font-normal text-text-primary'}>
        <span>{value}</span>
        {icon ? <span className={'flex size-4 items-center justify-center'}>{icon}</span> : null}
        {suffix ? <span className={'flex size-3 items-center justify-center'}>{suffix}</span> : null}
      </span>
    </div>
  )
}

type TExpandableInfoItem = {
  label: string
  value: ReactNode
  children: ReactNode
  className?: string
  icon?: ReactNode
}

function ExpandableInfoItem({ label, value, children, className, icon }: TExpandableInfoItem): ReactElement {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <details
      className={cl('py-1', className)}
      onToggle={(event): void => {
        setIsOpen(event.currentTarget.open)
      }}
    >
      <summary className={'cursor-pointer list-none [&::-webkit-details-marker]:hidden'}>
        <InlineHeading
          label={label}
          value={value}
          icon={icon}
          suffix={
            <IconChevron
              className={'text-text-secondary transition-transform duration-200'}
              size={12}
              direction={isOpen ? 'up' : 'down'}
            />
          }
        />
      </summary>
      <div className={'mt-1 text-sm text-text-secondary'}>{children}</div>
    </details>
  )
}

export function VaultAboutSection({
  currentVault,
  className,
  showKindTag = true,
  showVaultAddress = false
}: {
  currentVault: TYDaemonVault
  className?: string
  showKindTag?: boolean
  showVaultAddress?: boolean
  showHiddenTag?: boolean
  isHidden?: boolean
}): ReactElement {
  const { token, apr } = currentVault
  const chainName = getNetwork(currentVault.chainID).name
  const chainLogoSrc = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${currentVault.chainID}/logo-32.png`
  const listKind = deriveListKind(currentVault)
  const isAllocatorVault = listKind === 'allocator' || listKind === 'strategy'
  const isLegacyVault = listKind === 'legacy'
  const productTypeLabel = isAllocatorVault ? 'Single Asset' : isLegacyVault ? 'Legacy' : 'LP Token'
  const baseKindType: 'multi' | 'single' | undefined =
    currentVault.kind === 'Multi Strategy' ? 'multi' : currentVault.kind === 'Single Strategy' ? 'single' : undefined
  const fallbackKindType: 'multi' | 'single' | undefined =
    listKind === 'allocator' ? 'multi' : listKind === 'strategy' ? 'single' : undefined
  const kindType = baseKindType ?? fallbackKindType
  const kindLabel: string | undefined =
    kindType === 'multi' ? 'Allocator' : kindType === 'single' ? 'Strategy' : currentVault.kind
  const shouldShowKind = showKindTag && Boolean(kindLabel)
  const vaultTypeLabel = [productTypeLabel, shouldShowKind ? kindLabel : null].filter(Boolean).join(' | ')
  const chainDescription = getChainDescription(currentVault.chainID)
  const chainWebsite = getChainWebsite(currentVault.chainID) ?? ''
  const hasChainWebsite = Boolean(chainWebsite)
  const assetTypeLabel = currentVault.category ?? 'Not specified'
  const assetTypeDescription = getCategoryDescription(currentVault.category) ?? 'No asset category provided.'
  const productTypeDescription = getProductTypeDescription(listKind)
  const vaultKindDescription = shouldShowKind ? getKindDescription(kindType, kindLabel) : null
  const managementFee = formatPercent((apr.fees.management || 0) * 100, 0, 2)
  const performanceFee = formatPercent((apr.fees.performance || 0) * 100, 0, 2)
  const feesSummary = `${managementFee} Management Fee | ${performanceFee} Performance Fee`
  const chainIcon = <TokenLogo src={chainLogoSrc} tokenSymbol={chainName} width={16} height={16} />
  const explorerBase = getNetwork(currentVault.chainID).defaultBlockExplorer
  const explorerHref = explorerBase ? `${explorerBase}/address/${currentVault.address}` : ''

  const rawDescription = currentVault.description?.trim()
    ? currentVault.description
    : token.description?.trim()
      ? token.description
      : ''
  const descriptionText = rawDescription ? rawDescription.replaceAll('{{token}}', currentVault.token.symbol) : ''

  return (
    <div className={cl('p-4 md:p-6 md:pt-0', className)} data-tour="vaults-row-expanded-info">
      <div className={'flex flex-col gap-2'}>
        <div className={'text-sm text-text-secondary'}>
          <div className="">
            {rawDescription ? (
              <Markdown content={descriptionText} />
            ) : (
              <div>
                Sorry, we don't have a description for this vault right now. To learn more about how Yearn Vaults work,
                check out our{' '}
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
              </div>
            )}
          </div>
          {showVaultAddress ? (
            <div className={'flex flex-wrap items-center py-3 gap-2 text-sm border-b border-border'}>
              {explorerHref ? (
                <a
                  href={explorerHref}
                  target={'_blank'}
                  rel={'noopener noreferrer'}
                  className={
                    ' flex flex-row gap-1 items-center text-text-primary transition-colors hover:text-text-secondary'
                  }
                  aria-label={'View vault on block explorer'}
                >
                  {currentVault.address}
                  <IconLinkOut className={'size-3'} />
                </a>
              ) : null}
              <button
                type={'button'}
                onClick={(): void => copyToClipboard(currentVault.address)}
                className={'text-text-secondary transition-colors hover:text-text-primary'}
                aria-label={'Copy vault address'}
              >
                <IconCopy className={'size-3'} />
              </button>
            </div>
          ) : null}
        </div>

        <div className={'flex flex-col gap-1.5'}>
          <ExpandableInfoItem label={'Chain'} value={chainName} icon={chainIcon}>
            <p>
              {chainDescription}
              {hasChainWebsite ? (
                <>
                  {' Learn more about '} {chainName} {' at '}
                  <a
                    href={chainWebsite}
                    target={'_blank'}
                    rel={'noopener noreferrer'}
                    className={'inline-flex items-center gap-1 text-text-primary underline'}
                  >
                    {chainWebsite}
                    <IconLinkOut className={'inline-block size-3'} />
                  </a>
                </>
              ) : null}
            </p>
          </ExpandableInfoItem>

          <ExpandableInfoItem label={'Asset Type'} value={assetTypeLabel}>
            <p>{assetTypeDescription}</p>
          </ExpandableInfoItem>

          <ExpandableInfoItem label={'Vault Type'} value={vaultTypeLabel || productTypeLabel}>
            <div className={'space-y-1'}>
              <p>{productTypeDescription}</p>
              {vaultKindDescription ? <p>{vaultKindDescription}</p> : null}
            </div>
          </ExpandableInfoItem>

          <ExpandableInfoItem label={'Fees'} value={feesSummary}>
            <div className={'space-y-3'}>
              <p>
                {
                  'Management fees are claimed from earned yield, pro-rated and up to the stated percentage of principal.'
                }
              </p>
              <p>{'Performance fees are claimed from earned yield, up to the stated percentage of yield earned.'}</p>
            </div>
          </ExpandableInfoItem>
        </div>
      </div>
    </div>
  )
}
