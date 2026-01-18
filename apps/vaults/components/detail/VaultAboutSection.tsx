import { TokenLogo } from '@lib/components/TokenLogo'
import { IconChevron } from '@lib/icons/IconChevron'
import { IconLinkOut } from '@lib/icons/IconLinkOut'
import { IconRewind } from '@lib/icons/IconRewind'
import { IconScissors } from '@lib/icons/IconScissors'
import { IconStablecoin } from '@lib/icons/IconStablecoin'
import { IconVolatile } from '@lib/icons/IconVolatile'
import { cl, formatPercent } from '@lib/utils'
import { parseMarkdown } from '@lib/utils/helpers'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { getNetwork } from '@lib/utils/wagmi/utils'
import { deriveListKind } from '@vaults/utils/vaultListFacets'
import {
  getCategoryDescription,
  getChainDescription,
  getChainWebsite,
  getKindDescription,
  getProductTypeDescription,
  HIDDEN_TAG_DESCRIPTION,
  MIGRATABLE_TAG_DESCRIPTION,
  RETIRED_TAG_DESCRIPTION
} from '@vaults/utils/vaultTagCopy'
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
        {icon ? <span className={'flex size-4 items-center justify-center'}>{icon}</span> : null}
        <span>{value}</span>
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
      <div className={'mt-1 pl-5 text-sm text-text-secondary'}>{children}</div>
    </details>
  )
}

export function VaultAboutSection({
  currentVault,
  className,
  showKindTag = true
}: {
  currentVault: TYDaemonVault
  className?: string
  showKindTag?: boolean
  showHiddenTag?: boolean
  isHidden?: boolean
}): ReactElement {
  const { token, apr } = currentVault
  const chainName = getNetwork(currentVault.chainID).name
  const chainLogoSrc = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${currentVault.chainID}/logo-32.png`
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
  const feesSummary = `${managementFee} Management | ${performanceFee} Performance`
  const categoryIcon =
    currentVault.category === 'Stablecoin' ? (
      <IconStablecoin className={'size-4 text-text-secondary'} />
    ) : currentVault.category === 'Volatile' ? (
      <IconVolatile className={'size-4 text-text-secondary'} />
    ) : null
  const productTypeIcon = isAllocatorVault ? (
    <span className={'text-sm leading-none'}>{'⚙️'}</span>
  ) : isLegacyVault ? (
    <IconRewind className={'size-4 text-text-secondary'} />
  ) : (
    <span className={'text-sm leading-none'}>{'🏭'}</span>
  )
  const chainIcon = <TokenLogo src={chainLogoSrc} tokenSymbol={chainName} width={16} height={16} />
  const feesIcon = <IconScissors className={'size-4 text-text-secondary'} />

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
      <div className={'flex flex-col gap-4'}>
        <div className={'px-4 text-sm text-text-secondary'}>
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

        <div className={'flex flex-col gap-1.5 px-4'}>
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

          <ExpandableInfoItem label={'Asset Type'} value={assetTypeLabel} icon={categoryIcon}>
            <p>{assetTypeDescription}</p>
          </ExpandableInfoItem>

          <ExpandableInfoItem label={'Vault Type'} value={vaultTypeLabel || productTypeLabel} icon={productTypeIcon}>
            <div className={'space-y-1'}>
              <p>{productTypeDescription}</p>
              {vaultKindDescription ? <p>{vaultKindDescription}</p> : null}
            </div>
          </ExpandableInfoItem>

          <ExpandableInfoItem label={'Fees'} value={feesSummary} icon={feesIcon}>
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
