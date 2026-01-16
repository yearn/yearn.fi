import { Dialog, Transition } from '@headlessui/react'
import { useThemePreference } from '@hooks/useThemePreference'
import { Counter } from '@lib/components/Counter'
import { RenderAmount } from '@lib/components/RenderAmount'
import { TokenLogo } from '@lib/components/TokenLogo'
import { useWeb3 } from '@lib/contexts/useWeb3'

import { IconCirclePile } from '@lib/icons/IconCirclePile'
import { IconLinkOut } from '@lib/icons/IconLinkOut'
import { IconMigratable } from '@lib/icons/IconMigratable'
import { IconRewind } from '@lib/icons/IconRewind'
import { IconStablecoin } from '@lib/icons/IconStablecoin'
import { IconStack } from '@lib/icons/IconStack'
import { IconVolatile } from '@lib/icons/IconVolatile'
import { cl, formatUSD, toAddress, toNormalizedBN } from '@lib/utils'
import { getVaultName } from '@lib/utils/helpers'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { getNetwork } from '@lib/utils/wagmi/utils'
import { VaultsListChip } from '@vaults/components/list/VaultsListChip'
import { VaultForwardAPY } from '@vaults/components/table/VaultForwardAPY'
import { VaultHistoricalAPY } from '@vaults/components/table/VaultHistoricalAPY'
import { useHeaderCompression } from '@vaults/hooks/useHeaderCompression'

import { useVaultUserData } from '@vaults/hooks/useVaultUserData'

import { deriveListKind } from '@vaults/shared/utils/vaultListFacets'

import type { ReactElement } from 'react'
import { Fragment, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

const METRIC_VALUE_CLASS = 'font-semibold text-[20px] leading-tight md:text-[22px]'
const METRIC_FOOTNOTE_CLASS = 'text-xs text-text-secondary'

type TMetricBlock = {
  key: string
  header: ReactElement
  value: ReactElement
  footnote?: ReactElement
  secondaryLabel?: ReactElement
}

function MetricInfoModal({
  description,
  isOpen,
  onClose,
  title
}: {
  description?: string
  isOpen: boolean
  onClose: () => void
  title: string
}): ReactElement | null {
  if (!description) {
    return null
  }
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as={'div'} className={'relative z-50'} onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter={'ease-out duration-300'}
          enterFrom={'opacity-0'}
          enterTo={'opacity-100'}
          leave={'ease-in duration-200'}
          leaveFrom={'opacity-100'}
          leaveTo={'opacity-0'}
        >
          <div className={'fixed inset-0 bg-neutral-900/30'} />
        </Transition.Child>

        <div className={'fixed inset-0 overflow-y-auto'}>
          <div className={'flex min-h-full items-center justify-center p-4 text-center'}>
            <Transition.Child
              as={Fragment}
              enter={'ease-out duration-300'}
              enterFrom={'opacity-0 scale-95'}
              enterTo={'opacity-100 scale-100'}
              leave={'ease-in duration-200'}
              leaveFrom={'opacity-100 scale-100'}
              leaveTo={'opacity-0 scale-95'}
            >
              <Dialog.Panel
                className={
                  'w-full max-w-md transform overflow-hidden rounded-2xl bg-surface p-6 text-left align-middle shadow-lg transition-all'
                }
              >
                <Dialog.Title as={'h3'} className={'text-lg font-semibold leading-6 text-text-primary'}>
                  {title}
                </Dialog.Title>
                <p className={'mt-4 text-sm text-text-secondary'}>
                  {description}
                  <span className={'mt-2 block text-xs text-text-secondary'}>
                    {'More information about this metric is coming soon.'}
                  </span>
                </p>
                <div className={'mt-6'}>
                  <button
                    type={'button'}
                    className={
                      'inline-flex w-full items-center justify-center rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-neutral-0 transition-colors hover:bg-neutral-800'
                    }
                    onClick={onClose}
                  >
                    {'Got it'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

function MetricsCard({
  hideFootnotes = false,
  items
}: {
  items: TMetricBlock[]
  hideFootnotes?: boolean
}): ReactElement {
  return (
    <div className={cl('rounded-lg border border-border bg-surface text-text-primary', 'backdrop-blur-sm')}>
      <div className={'divide-y divide-neutral-300 md:flex md:divide-y-0'}>
        {items.map(
          (item, index): ReactElement => (
            <div
              key={item.key}
              className={cl(
                'flex flex-1 flex-col gap-1 px-5 py-3',
                index < items.length - 1 ? 'md:border-r md:border-border' : ''
              )}
            >
              <div className={'flex items-center justify-between'}>{item.header}</div>
              <div className={'[&_b.yearn--table-data-section-item-value]:text-left font-semibold'}>{item.value}</div>
              {item.footnote && !hideFootnotes ? <div>{item.footnote}</div> : null}
            </div>
          )
        )}
      </div>
    </div>
  )
}

function MetricHeader({ label, tooltip }: { label: string; tooltip?: string }): ReactElement {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      <p className={'flex items-center gap-1 text-xs font-normal uppercase tracking-wide text-text-secondary'}>
        <span>{label}</span>
        {tooltip ? (
          <button
            type={'button'}
            onClick={(): void => setIsModalOpen(true)}
            aria-label={`Learn more about ${label}`}
            className={
              'inline-flex size-4 items-center justify-center rounded-full border bg-surface border-border text-[10px] font-normal text-text-secondary transition-colors hover:border-neutral-500 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300'
            }
          >
            <span className={'leading-none'}>{'i'}</span>
          </button>
        ) : null}
      </p>
      <MetricInfoModal
        description={tooltip}
        isOpen={isModalOpen}
        onClose={(): void => setIsModalOpen(false)}
        title={label}
      />
    </>
  )
}

function VaultOverviewCard({
  currentVault,
  isCompressed
}: {
  currentVault: TYDaemonVault
  isCompressed: boolean
}): ReactElement {
  const totalAssets = toNormalizedBN(currentVault.tvl.totalAssets, currentVault.decimals).normalized
  const metrics: TMetricBlock[] = [
    {
      key: 'est-apy',
      header: <MetricHeader label={'Est. APY'} tooltip={'Projected APY for the next period'} />,
      value: (
        <VaultForwardAPY
          currentVault={currentVault}
          showSubline={false}
          className={'items-start text-left'}
          valueClassName={METRIC_VALUE_CLASS}
        />
      )
    },
    {
      key: 'historical-apy',
      header: <MetricHeader label={'30 Day APY'} tooltip={'Average realized APY over the previous 30 days'} />,
      value: (
        <VaultHistoricalAPY
          currentVault={currentVault}
          className={'items-start text-left'}
          valueClassName={METRIC_VALUE_CLASS}
        />
      )
    },
    {
      key: 'tvl',
      header: <MetricHeader label={'TVL'} tooltip={'Total value currently deposited into this vault'} />,
      value: (
        <span className={METRIC_VALUE_CLASS}>
          <RenderAmount
            value={currentVault.tvl?.tvl || 0}
            symbol={'USD'}
            decimals={0}
            options={{
              shouldCompactValue: true,
              maximumFractionDigits: 2,
              minimumFractionDigits: 0
            }}
          />
        </span>
      ),
      footnote: (
        <p className={METRIC_FOOTNOTE_CLASS} suppressHydrationWarning>
          <span className={'font-number'}>
            <Counter value={totalAssets} decimals={currentVault.decimals} decimalsToDisplay={[2, 6, 8, 10, 12]} />
          </span>
          <span className={'pl-1'}>{currentVault.token.symbol || 'tokens'}</span>
        </p>
      )
    }
  ]

  return <MetricsCard items={metrics} hideFootnotes={isCompressed} />
}

function UserHoldingsCard({
  currentVault,
  availableToDeposit,
  depositedValue,
  tokenPrice,
  isCompressed
}: {
  currentVault: TYDaemonVault
  availableToDeposit: bigint
  depositedValue: bigint
  tokenPrice: number
  isCompressed: boolean
}): ReactElement {
  const availableAmount = toNormalizedBN(availableToDeposit, currentVault.token.decimals)
  const depositedAmount = toNormalizedBN(depositedValue, currentVault.token.decimals)
  const depositedValueUSD = depositedAmount.normalized * tokenPrice
  const availableValueUSD = availableAmount.normalized * tokenPrice

  const sections: TMetricBlock[] = [
    {
      key: 'available',
      header: (
        <MetricHeader
          label={'Available'}
          tooltip={'Track how much of the vault asset is already in your wallet and ready to be deposited.'}
        />
      ),
      value: (
        <span className={METRIC_VALUE_CLASS} suppressHydrationWarning>
          {formatUSD(availableValueUSD)}
        </span>
      ),
      footnote: (
        <p className={METRIC_FOOTNOTE_CLASS} suppressHydrationWarning>
          <RenderAmount
            value={Number(availableAmount.normalized)}
            symbol={currentVault.token.symbol}
            decimals={currentVault.token.decimals}
            shouldFormatDust
            options={{
              shouldDisplaySymbol: false,
              maximumFractionDigits: Number(availableAmount.normalized) > 1000 ? 2 : 4
            }}
          />
          <span className={'pl-1'}>{currentVault.token.symbol || 'tokens'}</span>
        </p>
      )
    },
    {
      key: 'deposited',
      header: (
        <MetricHeader
          label={'Deposited'}
          tooltip={'Review the USD value of everything you have supplied to this vault so far.'}
        />
      ),
      value: (
        <span className={METRIC_VALUE_CLASS} suppressHydrationWarning>
          {formatUSD(depositedValueUSD)}
        </span>
      ),
      footnote: (
        <p className={METRIC_FOOTNOTE_CLASS} suppressHydrationWarning>
          <RenderAmount
            value={Number(depositedAmount.normalized)}
            symbol={currentVault.token.symbol}
            decimals={currentVault.token.decimals}
            shouldFormatDust
            options={{
              shouldDisplaySymbol: false,
              maximumFractionDigits: Number(depositedAmount.normalized) > 1000 ? 2 : 4
            }}
          />
          <span className={'pl-1'}>{currentVault.token.symbol || 'tokens'}</span>
        </p>
      )
    }
  ]

  return <MetricsCard items={sections} hideFootnotes={isCompressed} />
}

export function VaultDetailsHeader({
  currentVault,
  isCollapsibleMode = true
}: {
  currentVault: TYDaemonVault
  isCollapsibleMode?: boolean
}): ReactElement {
  const { address } = useWeb3()
  const themePreference = useThemePreference()
  const isDarkTheme = themePreference !== 'light'
  const { isCompressed } = useHeaderCompression({ enabled: isCollapsibleMode })

  // Shared hook with widget - cache updates automatically when widget refetches
  const { availableToDeposit, depositedValue } = useVaultUserData({
    vaultAddress: toAddress(currentVault.address),
    assetAddress: toAddress(currentVault.token.address),
    stakingAddress: currentVault.staking.available ? toAddress(currentVault.staking.address) : undefined,
    chainId: currentVault.chainID,
    account: address
  })
  const tokenPrice = currentVault.tvl.price || 0

  const chainName = getNetwork(currentVault.chainID).name

  const tokenLogoSrc = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${
    currentVault.chainID
  }/${currentVault.token.address.toLowerCase()}/logo-128.png`
  const chainLogoSrc = `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/chains/${currentVault.chainID}/logo-32.png`
  const explorerBase = getNetwork(currentVault.chainID).defaultBlockExplorer
  const explorerHref = explorerBase ? `${explorerBase}/address/${currentVault.address}` : ''
  const showChainChip = !isCompressed
  const showCategoryChip = Boolean(currentVault.category)
  const listKind = deriveListKind(currentVault)
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
    currentVault.category === 'Stablecoin' ? (
      <IconStablecoin className={'size-3.5'} />
    ) : currentVault.category === 'Volatile' ? (
      <IconVolatile className={'size-3.5'} />
    ) : null

  const baseKindType: 'multi' | 'single' | undefined =
    currentVault.kind === 'Multi Strategy' ? 'multi' : currentVault.kind === 'Single Strategy' ? 'single' : undefined

  const fallbackKindType: 'multi' | 'single' | undefined =
    listKind === 'allocator' ? 'multi' : listKind === 'strategy' ? 'single' : undefined
  const kindType = baseKindType ?? fallbackKindType
  const kindLabel: string | undefined =
    kindType === 'multi' ? 'Allocator' : kindType === 'single' ? 'Strategy' : currentVault.kind
  const kindIcon: ReactElement | null =
    kindType === 'multi' ? (
      <IconCirclePile className={'size-3.5'} />
    ) : kindType === 'single' ? (
      <IconStack className={'size-3.5'} />
    ) : null
  const isMigratable = Boolean(currentVault.migration?.available)
  const isRetired = Boolean(currentVault.info?.isRetired)
  const migratableIcon = <IconMigratable className={'size-3.5'} />
  const retiredIcon = <span className={'text-xs leading-none'}>{'⚠️'}</span>
  const showKindChip = Boolean(kindLabel)
  const shouldShowMetadata =
    showChainChip || showCategoryChip || showKindChip || Boolean(productTypeLabel) || isMigratable || isRetired
  const [isTitleClipped, setIsTitleClipped] = useState(false)
  const titleRef = useRef<HTMLSpanElement>(null)
  const vaultName = getVaultName(currentVault)

  useEffect(() => {
    // Preload chain logo so it appears instantly when the chip mounts
    const preload = new Image()
    preload.src = chainLogoSrc
  }, [chainLogoSrc])

  useEffect(() => {
    if (!isCompressed) {
      setIsTitleClipped(false)
      return
    }

    const measure = (): void => {
      if (!titleRef.current) return
      setIsTitleClipped(titleRef.current.scrollWidth > titleRef.current.clientWidth)
    }

    measure()
    window.addEventListener('resize', measure)

    return () => {
      window.removeEventListener('resize', measure)
    }
  }, [isCompressed])

  return (
    <div className={'grid w-full grid-cols-1 gap-6 text-left md:auto-rows-min md:grid-cols-20 bg-app'}>
      <div className={'hidden md:flex items-center gap-2 text-sm text-text-secondary md:col-span-20 px-1'}>
        <Link to={'/'} className={'transition-colors hover:text-text-primary'}>
          {'Home'}
        </Link>
        <span>{'>'}</span>
        <Link to={'/v3'} className={'transition-colors hover:text-text-primary'}>
          {'Vaults'}
        </Link>
        <span>{'>'}</span>
        <span className={'font-medium text-text-primary'}>{getVaultName(currentVault)}</span>
      </div>
      <div
        className={cl(
          'flex flex-col gap-1 px-1',
          isCompressed ? 'md:col-span-5 md:row-start-2 md:justify-center' : 'md:col-span-20 md:row-start-2'
        )}
      >
        <div className={cl('flex items-center', isCompressed ? 'gap-2' : ' gap-4')}>
          <div
            className={cl(
              'relative flex items-center justify-start rounded-full bg-surface/70',
              isCompressed ? 'size-8' : 'size-10'
            )}
          >
            <TokenLogo
              src={tokenLogoSrc}
              tokenSymbol={currentVault.token.symbol || ''}
              width={isCompressed ? 32 : 40}
              height={isCompressed ? 32 : 40}
            />
            {isCompressed ? (
              <div
                className={
                  'absolute -bottom-1 -right-1 flex size-3.5 items-center justify-center rounded-full border border-border bg-surface'
                }
              >
                <TokenLogo src={chainLogoSrc} tokenSymbol={chainName} width={14} height={14} />
              </div>
            ) : null}
          </div>
          <div className={'flex flex-col'}>
            <div className={cl('flex items-center gap-3', isCompressed && isTitleClipped ? 'relative group' : '')}>
              <strong
                ref={titleRef}
                className={cl(
                  'text-lg font-black leading-tight md:text-3xl md:leading-10',
                  isDarkTheme ? 'text-text-primary' : 'text-text-secondary',
                  isCompressed ? 'md:text-[30px] md:leading-9 max-w-[260px] truncate whitespace-nowrap' : ''
                )}
              >
                {vaultName} {' yVault'}
              </strong>
              {isCompressed && isTitleClipped ? (
                <span
                  className={cl(
                    'pointer-events-none absolute left-0 top-1/2 z-20 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-app px-0 py-0 text-[30px] font-black leading-tight group-hover:block',
                    isDarkTheme ? 'text-text-primary' : 'text-text-secondary'
                  )}
                >
                  {vaultName} {' yVault'}
                </span>
              ) : null}
              {!isCompressed && explorerHref ? (
                <a
                  href={explorerHref}
                  target={'_blank'}
                  rel={'noopener noreferrer'}
                  className={'text-text-secondary hover:text-text-primary transition-colors h-7 content-end'}
                  aria-label={'View vault on block explorer'}
                >
                  <IconLinkOut className={'size-4 md:size-4'} />
                </a>
              ) : null}
            </div>
          </div>
        </div>
        {shouldShowMetadata ? (
          <div className={'flex flex-wrap items-center gap-1 text-xs text-text-primary/70 md:text-xs mt-1'}>
            {showChainChip ? (
              <VaultsListChip
                label={chainName}
                icon={<TokenLogo src={chainLogoSrc} tokenSymbol={chainName} width={14} height={14} priority />}
                isCollapsed={isCompressed}
                showCollapsedTooltip={isCompressed}
              />
            ) : null}
            {showCategoryChip ? (
              <VaultsListChip
                label={currentVault.category || ''}
                icon={categoryIcon}
                isCollapsed={isCompressed}
                showCollapsedTooltip={isCompressed}
              />
            ) : null}
            <VaultsListChip
              label={productTypeLabel}
              icon={productTypeIcon}
              isCollapsed={isCompressed}
              showCollapsedTooltip={isCompressed}
            />
            {showKindChip ? (
              <VaultsListChip
                label={kindLabel}
                icon={kindIcon}
                isCollapsed={isCompressed}
                showCollapsedTooltip={isCompressed}
              />
            ) : null}
            {isRetired ? (
              <VaultsListChip
                label={'Retired'}
                icon={retiredIcon}
                isCollapsed={isCompressed}
                showCollapsedTooltip={isCompressed}
              />
            ) : null}
            {isMigratable ? (
              <VaultsListChip
                label={'Migratable'}
                icon={migratableIcon}
                isCollapsed={isCompressed}
                showCollapsedTooltip={isCompressed}
              />
            ) : null}
            {isCompressed && explorerHref ? (
              <a
                href={explorerHref}
                target={'_blank'}
                rel={'noopener noreferrer'}
                className={
                  'inline-flex items-center justify-center px-2 py-1 text-text-secondary hover:text-text-primary transition-colors'
                }
                aria-label={'View vault on block explorer'}
              >
                <IconLinkOut className={'size-4'} />
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        className={cl(isCompressed ? 'md:col-start-6 md:col-span-8 md:row-start-2' : 'md:col-span-13 md:row-start-3')}
      >
        <VaultOverviewCard currentVault={currentVault} isCompressed={isCompressed} />
      </div>
      <div
        className={cl(
          isCompressed ? 'md:col-span-7 md:col-start-14 md:row-start-2' : 'md:col-span-7 md:col-start-14 md:row-start-3'
        )}
      >
        <UserHoldingsCard
          currentVault={currentVault}
          availableToDeposit={availableToDeposit}
          depositedValue={depositedValue}
          tokenPrice={tokenPrice}
          isCompressed={isCompressed}
        />
      </div>
    </div>
  )
}
