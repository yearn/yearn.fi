import {
  DESKTOP_WIDGET_BOTTOM_PADDING_PX,
  DESKTOP_WIDGET_OFFSET_CSS_VAR,
  getDesktopWidgetHeightClassNames,
  resolveDesktopWidgetHeaderOffset
} from '@pages/vaults/components/detail/desktopWidgetSizing'
import { type TVaultAddressItem, VaultAboutSection } from '@pages/vaults/components/detail/VaultAboutSection'
import { VaultDetailsHeader } from '@pages/vaults/components/detail/VaultDetailsHeader'
import { VaultInfoSection } from '@pages/vaults/components/detail/VaultInfoSection'
import { VaultRiskSection } from '@pages/vaults/components/detail/VaultRiskSection'
import { VaultStrategiesSection } from '@pages/vaults/components/detail/VaultStrategiesSection'
import { TranchedVaultChartsSection } from '@pages/vaults/components/tranched/TranchedVaultChartsSection'
import { Widget } from '@pages/vaults/components/widget'
import {
  getTranchedProductById,
  getTranchedVaultRowsByKind,
  type TTranchedProduct
} from '@pages/vaults/constants/tranchedProducts'
import {
  getVaultAddress,
  getVaultChainID,
  getVaultName,
  getVaultSymbol,
  getVaultToken,
  type TKongVaultInput
} from '@pages/vaults/domain/kongVaultSelectors'
import type { VaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import { WidgetActionType } from '@pages/vaults/types'
import { IconChevron } from '@shared/icons/IconChevron'
import { cl, toNormalizedBN } from '@shared/utils'
import type { ReactElement, ReactNode } from 'react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

type TSectionKey = 'charts' | 'about' | 'strategies' | 'risk' | 'info'

type TResolvedTranchedProduct = {
  product: TTranchedProduct
  row: ReturnType<typeof getTranchedVaultRowsByKind>[number]
}

const SECTION_TABS: Array<{ key: TSectionKey; label: string }> = [
  { key: 'charts', label: 'Performance' },
  { key: 'about', label: 'Vault Info' },
  { key: 'strategies', label: 'Strategies' },
  { key: 'risk', label: 'Risk' },
  { key: 'info', label: 'More Info' }
]

const desktopWidgetHeightClassNames = getDesktopWidgetHeightClassNames()

const resolveHeaderOffset = (): number => {
  if (typeof window === 'undefined') return 0
  const root = document.documentElement
  const styles = getComputedStyle(root)
  const rawValue = styles.getPropertyValue('--header-height').trim()
  if (!rawValue) return 0

  const rootFontSize = Number.parseFloat(styles.fontSize || '16') || 16
  let nextOffset = Number.parseFloat(rawValue)

  if (rawValue.endsWith('rem')) {
    nextOffset *= rootFontSize
  } else if (rawValue.endsWith('vh')) {
    nextOffset = (window.innerHeight * nextOffset) / 100
  }

  return Number.isNaN(nextOffset) ? 0 : nextOffset
}

function resolveTranchedProduct(product: TTranchedProduct): TResolvedTranchedProduct {
  const row = getTranchedVaultRowsByKind(product.kind).find((candidate) => candidate.product.id === product.id)

  if (!row) {
    throw new Error(`Missing tranched vault row for ${product.id}`)
  }

  return { product, row }
}

function getProductTypeLabel(product: TTranchedProduct): string {
  return product.kind === 'senior' ? 'Steady Yield' : 'Single Asset'
}

function getProductTypeDescription(product: TTranchedProduct): string {
  if (product.kind === 'senior') {
    return 'Senior tranche product designed around a target coupon paid before junior upside.'
  }
  return 'Single asset vault with junior tranche exposure.'
}

function getPositionChip(product: TTranchedProduct): { label: string; tooltipDescription: string } {
  if (product.kind === 'senior') {
    return {
      label: 'Target Rate',
      tooltipDescription: 'This product is designed around a target coupon paid before junior upside.'
    }
  }
  return {
    label: 'Junior',
    tooltipDescription:
      'Junior products receive excess yield after senior obligations and sit below senior in the waterfall.'
  }
}

function createMockToken({
  address,
  chainID,
  decimals,
  name,
  symbol
}: {
  address?: `0x${string}`
  chainID: number
  decimals?: number
  name?: string
  symbol?: string
}) {
  return {
    address,
    chainID,
    decimals,
    name,
    symbol,
    balance: toNormalizedBN(0n, decimals ?? 18)
  }
}

function createMockVaultUserData(vault: TKongVaultInput): VaultUserData {
  const chainID = getVaultChainID(vault)
  const token = getVaultToken(vault)
  const vaultSymbol = getVaultSymbol(vault)
  const vaultName = getVaultName(vault)

  return {
    assetToken: createMockToken({
      address: token.address,
      chainID,
      decimals: token.decimals,
      name: token.name,
      symbol: token.symbol
    }),
    vaultToken: createMockToken({
      address: getVaultAddress(vault),
      chainID,
      decimals: 18,
      name: vaultName,
      symbol: vaultSymbol
    }),
    stakingToken: undefined,
    pricePerShare: 10n ** 18n,
    availableToDeposit: 0n,
    depositedShares: 0n,
    depositedValue: 0n,
    stakingWithdrawableAssets: 0n,
    stakingRedeemableShares: 0n,
    isLoading: false,
    refetch: () => undefined
  }
}

function SectionShell({
  children,
  defaultOpen = true,
  id,
  title
}: {
  children: ReactNode
  defaultOpen?: boolean
  id: TSectionKey
  title: string
}): ReactElement {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div
      id={id}
      data-scroll-spy-key={id}
      className={'rounded-lg border border-border bg-surface'}
      style={{ scrollMarginTop: 'var(--vault-header-height, calc(var(--header-height) + 128px))' }}
    >
      <button
        type={'button'}
        className={'flex w-full items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4'}
        onClick={(): void => setIsOpen((previous) => !previous)}
      >
        <span className={'text-base font-semibold text-text-primary'}>{title}</span>
        <IconChevron
          className={'size-4 text-text-secondary transition-transform duration-200'}
          direction={isOpen ? 'up' : 'down'}
        />
      </button>
      {isOpen ? <div>{children}</div> : null}
    </div>
  )
}

function TranchedWidget({
  resolved,
  setWidgetMode,
  widgetMode
}: {
  resolved: TResolvedTranchedProduct
  setWidgetMode: (mode: WidgetActionType) => void
  widgetMode: WidgetActionType
}): ReactElement {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const vaultUserData = useMemo(() => createMockVaultUserData(resolved.row.vault), [resolved.row.vault])

  return (
    <div
      className={
        'flex w-full min-w-0 max-w-full flex-col overflow-hidden [&_*]:min-w-0 [&_.yearn--button--nextgen]:max-w-full'
      }
    >
      <Widget
        currentVault={resolved.row.vault}
        vaultAddress={getVaultAddress(resolved.row.vault)}
        actions={[WidgetActionType.Deposit, WidgetActionType.Withdraw]}
        chainId={getVaultChainID(resolved.row.vault)}
        vaultUserData={vaultUserData}
        mode={widgetMode}
        onModeChange={setWidgetMode}
        showTabs={false}
        onOpenSettings={(): void => setIsSettingsOpen((previous) => !previous)}
        isSettingsOpen={isSettingsOpen}
        disableBorderRadius
      />
    </div>
  )
}

function AdditionalFeatures({ product }: { product: TTranchedProduct }): ReactElement {
  return (
    <div
      className={'mt-2 rounded-lg border border-border bg-surface-secondary p-3 text-sm leading-6 text-text-secondary'}
    >
      {product.kind === 'senior'
        ? 'Senior receives the target coupon first. Junior and reserve capital sit below it.'
        : 'Junior receives excess return after senior obligations are covered and accepts earlier loss exposure.'}
    </div>
  )
}

function TranchedProductDetail({ product }: { product: TTranchedProduct }): ReactElement {
  const resolved = useMemo(() => resolveTranchedProduct(product), [product])
  const [widgetMode, setWidgetMode] = useState<WidgetActionType>(WidgetActionType.Deposit)
  const [activeSectionKey, setActiveSectionKey] = useState<TSectionKey>('charts')
  const headerRef = useRef<HTMLElement | null>(null)
  const sectionRefs = useRef<Record<TSectionKey, HTMLDivElement | null>>({
    charts: null,
    about: null,
    strategies: null,
    risk: null,
    info: null
  })
  const widgetActions = [WidgetActionType.Deposit, WidgetActionType.Withdraw]
  const positionChip = getPositionChip(product)
  const vaultAddresses: TVaultAddressItem[] = [{ label: 'Vault', address: resolved.row.vault.address }]
  const scrollPadding = 16

  const updateSectionScrollOffset = useCallback((): number => {
    if (typeof window === 'undefined') return 0
    const baseOffset = resolveHeaderOffset()
    const headerHeight = headerRef.current?.getBoundingClientRect().height ?? 0
    const nextOffset = Math.round(baseOffset + headerHeight)
    const desktopWidgetOffset = resolveDesktopWidgetHeaderOffset({
      baseOffset,
      headerHeight,
      bottomPadding: DESKTOP_WIDGET_BOTTOM_PADDING_PX
    })

    document.documentElement.style.setProperty('--vault-header-height', `${nextOffset}px`)
    if (desktopWidgetOffset !== null) {
      document.documentElement.style.setProperty(DESKTOP_WIDGET_OFFSET_CSS_VAR, `${desktopWidgetOffset}px`)
    }

    return nextOffset
  }, [])

  const scrollToSection = useCallback(
    (sectionKey: TSectionKey, behavior: ScrollBehavior = 'smooth'): void => {
      const element = sectionRefs.current[sectionKey] ?? document.getElementById(sectionKey)
      if (!element || typeof window === 'undefined') {
        return
      }

      const scrollOffset = updateSectionScrollOffset()
      const top = element.getBoundingClientRect().top + window.scrollY - scrollOffset - scrollPadding
      window.scrollTo({ top: Math.max(1, top), behavior })
    },
    [updateSectionScrollOffset]
  )

  const handleSelectSection = useCallback(
    (key: string): void => {
      const sectionKey = key as TSectionKey
      setActiveSectionKey(sectionKey)
      if (typeof window === 'undefined') {
        return
      }

      if (window.scrollY < 1 && sectionKey !== 'charts') {
        window.scrollTo({ top: 1, behavior: 'auto' })
        requestAnimationFrame(() => {
          requestAnimationFrame(() => scrollToSection(sectionKey))
        })
        return
      }

      scrollToSection(sectionKey)
    },
    [scrollToSection]
  )

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return

    let frame = 0
    const scheduleUpdate = (): void => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(updateSectionScrollOffset)
    }

    scheduleUpdate()
    window.addEventListener('resize', scheduleUpdate)

    if (typeof ResizeObserver === 'undefined') {
      return (): void => {
        if (frame) cancelAnimationFrame(frame)
        window.removeEventListener('resize', scheduleUpdate)
      }
    }

    const observer = new ResizeObserver(scheduleUpdate)
    if (headerRef.current) {
      observer.observe(headerRef.current)
    }

    return (): void => {
      if (frame) cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [updateSectionScrollOffset])

  useEffect(() => {
    return (): void => {
      if (typeof window === 'undefined') return
      document.documentElement.style.removeProperty('--vault-header-height')
      document.documentElement.style.removeProperty(DESKTOP_WIDGET_OFFSET_CSS_VAR)
    }
  }, [])

  const setSectionRef =
    (key: TSectionKey) =>
    (element: HTMLDivElement | null): void => {
      sectionRefs.current[key] = element
    }

  return (
    <div
      className={
        'min-h-[calc(100vh-var(--header-height))] w-full bg-app pb-[calc(7rem+env(safe-area-inset-bottom,0px))] sm:pb-8'
      }
    >
      <div className={'mx-auto w-full max-w-[1232px] px-4'}>
        <header
          ref={headerRef}
          className={cl(
            'relative hidden h-full flex-col items-center justify-center rounded-3xl md:sticky md:top-[var(--header-height)] md:z-30 md:flex'
          )}
        >
          <VaultDetailsHeader
            currentVault={resolved.row.vault}
            depositedValue={0n}
            logoSrcOverride={resolved.row.logoSrc}
            productTypeLabelOverride={getProductTypeLabel(product)}
            productTypeDescriptionOverride={getProductTypeDescription(product)}
            extraMetadataChips={[positionChip]}
            sectionTabs={SECTION_TABS}
            activeSectionKey={activeSectionKey}
            onSelectSection={handleSelectSection}
            widgetActions={widgetActions}
            widgetMode={widgetMode}
            onWidgetModeChange={setWidgetMode}
            isCollapsibleMode={true}
          />
        </header>

        <div className={'py-4 md:hidden'}>
          <VaultDetailsHeader
            currentVault={resolved.row.vault}
            depositedValue={0n}
            logoSrcOverride={resolved.row.logoSrc}
            productTypeLabelOverride={getProductTypeLabel(product)}
            productTypeDescriptionOverride={getProductTypeDescription(product)}
            extraMetadataChips={[positionChip]}
            sectionTabs={SECTION_TABS}
            activeSectionKey={activeSectionKey}
            onSelectSection={handleSelectSection}
            widgetActions={widgetActions}
            widgetMode={widgetMode}
            onWidgetModeChange={setWidgetMode}
            isCollapsibleMode={false}
          />
        </div>

        <section className={'grid grid-cols-1 gap-4 bg-app md:grid-cols-20 md:items-start md:gap-6'}>
          <div
            className={cl(
              'hidden min-w-0 md:order-2 md:col-span-7 md:col-start-14 md:block md:sticky md:pt-4',
              'flex flex-col overflow-hidden',
              desktopWidgetHeightClassNames.container
            )}
            style={{ top: 'var(--vault-header-height, var(--header-height))' }}
          >
            <div
              className={cl(
                'relative grid w-full min-w-0 flex-1 min-h-0 overflow-hidden',
                desktopWidgetHeightClassNames.stack
              )}
            >
              <div className={'flex w-full min-w-0 flex-col min-h-0'}>
                <TranchedWidget resolved={resolved} widgetMode={widgetMode} setWidgetMode={setWidgetMode} />
              </div>
            </div>
          </div>

          <div className={'order-2 space-y-4 py-4 md:order-1 md:col-span-13'}>
            <div ref={setSectionRef('charts')}>
              <SectionShell id={'charts'} title={'Performance'}>
                <TranchedVaultChartsSection product={product} />
              </SectionShell>
            </div>

            <div ref={setSectionRef('about')}>
              <SectionShell id={'about'} title={'Vault Info'}>
                <VaultAboutSection
                  currentVault={resolved.row.vault}
                  vaultAddresses={vaultAddresses}
                  additionalFeaturesContent={<AdditionalFeatures product={product} />}
                />
              </SectionShell>
            </div>

            <div ref={setSectionRef('strategies')}>
              <SectionShell id={'strategies'} title={'Strategies'}>
                <VaultStrategiesSection currentVault={resolved.row.vault} />
              </SectionShell>
            </div>

            <div ref={setSectionRef('risk')}>
              <SectionShell id={'risk'} title={'Risk'}>
                <VaultRiskSection currentVault={resolved.row.vault} />
              </SectionShell>
            </div>

            <div ref={setSectionRef('info')}>
              <SectionShell id={'info'} title={'More Info'}>
                <VaultInfoSection currentVault={resolved.row.vault} inceptTime={null} />
              </SectionShell>
            </div>

            <div aria-hidden className={'hidden h-[65vh] md:block'} />
          </div>
        </section>
      </div>

      <div
        className={cl(
          'fixed bottom-0 left-0 right-0 z-50 bg-app/85 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] backdrop-blur-md md:hidden'
        )}
      >
        <div className={'mx-auto flex max-w-[1232px] gap-3'}>
          <button
            type={'button'}
            className={'yearn--button--nextgen flex-1'}
            data-variant={'filled'}
            onClick={(): void => setWidgetMode(WidgetActionType.Deposit)}
          >
            {'Deposit'}
          </button>
          <button
            type={'button'}
            className={'yearn--button flex-1'}
            data-variant={'light'}
            onClick={(): void => setWidgetMode(WidgetActionType.Withdraw)}
          >
            {'Withdraw'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TranchedProductDetailPage({ productId }: { productId: string }): ReactElement | null {
  const product = getTranchedProductById(productId)

  if (!product) {
    return null
  }

  return <TranchedProductDetail product={product} />
}
