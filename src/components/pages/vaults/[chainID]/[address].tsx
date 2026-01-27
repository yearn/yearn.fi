import { useScrollDirection } from '@hooks/useScrollDirection'
import { useScrollSpy } from '@hooks/useScrollSpy'
import { useThemePreference } from '@hooks/useThemePreference'
import { BottomDrawer } from '@pages/vaults/components/detail/BottomDrawer'
import { MobileKeyMetrics } from '@pages/vaults/components/detail/QuickStatsGrid'
import { VaultAboutSection } from '@pages/vaults/components/detail/VaultAboutSection'
import { VaultChartsSection } from '@pages/vaults/components/detail/VaultChartsSection'
import { VaultDetailsHeader } from '@pages/vaults/components/detail/VaultDetailsHeader'
import { VaultInfoSection } from '@pages/vaults/components/detail/VaultInfoSection'
import { VaultRiskSection } from '@pages/vaults/components/detail/VaultRiskSection'
import { VaultStrategiesSection } from '@pages/vaults/components/detail/VaultStrategiesSection'
import type { TWidgetRef } from '@pages/vaults/components/widget'
import { Widget } from '@pages/vaults/components/widget'
import { WidgetRewards } from '@pages/vaults/components/widget/rewards'
import { WalletPanel } from '@pages/vaults/components/widget/WalletPanel'
import { WidgetActionType } from '@pages/vaults/types'
import { fetchYBoldVault } from '@pages/vaults/utils/handleYBold'
import { ImageWithFallback } from '@shared/components/ImageWithFallback'
import { useWallet } from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import type { TUseBalancesTokens } from '@shared/hooks/useBalances.multichains'
import { useFetch } from '@shared/hooks/useFetch'
import { useYDaemonBaseURI } from '@shared/hooks/useYDaemonBaseURI'
import { IconChevron } from '@shared/icons/IconChevron'
import type { TToken } from '@shared/types'
import { cl, isZeroAddress, toAddress } from '@shared/utils'
import { getVaultName } from '@shared/utils/helpers'
import type { TYDaemonVault } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import { yDaemonVaultSchema } from '@shared/utils/schemas/yDaemonVaultsSchemas'
import type { ReactElement } from 'react'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { useDevFlags } from '@/contexts/useDevFlags'

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

function Index(): ReactElement | null {
  type SectionKey = 'charts' | 'about' | 'risk' | 'strategies' | 'info'
  const { headerDisplayMode } = useDevFlags()
  const mobileDetailsSectionId = useId()
  const themePreference = useThemePreference()
  const isDarkTheme = themePreference !== 'light'
  const scrollDirection = useScrollDirection({ threshold: 10, topThreshold: 50 })

  const { address, isActive } = useWeb3()
  const params = useParams()
  const chainId = Number(params.chainID)
  const { onRefresh } = useWallet()
  const { yDaemonBaseUri } = useYDaemonBaseURI({
    chainID: chainId
  })

  // Use vault address as key to reset state
  const vaultKey = `${params.chainID}-${params.address}`
  const [_currentVault, setCurrentVault] = useState<TYDaemonVault | undefined>(undefined)
  const [isInit, setIsInit] = useState(false)
  const [overrideVault, setOverrideVault] = useState<TYDaemonVault | undefined>(undefined)
  const [hasFetchedOverride, setHasFetchedOverride] = useState(false)
  const [lastVaultKey, setLastVaultKey] = useState(vaultKey)
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false)
  const [mobileDrawerAction, setMobileDrawerAction] = useState<
    typeof WidgetActionType.Deposit | typeof WidgetActionType.Withdraw
  >(WidgetActionType.Deposit)
  const mobileWidgetRef = useRef<TWidgetRef>(null)
  const detailsRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement | null>(null)
  const sectionSelectorRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<TWidgetRef>(null)
  const widgetContainerRef = useRef<HTMLDivElement>(null)
  const widgetStackRef = useRef<HTMLDivElement>(null)
  const widgetPrimaryRef = useRef<HTMLDivElement>(null)
  const widgetRewardsRef = useRef<HTMLDivElement>(null)
  const chartsRef = useRef<HTMLDivElement>(null)
  const aboutRef = useRef<HTMLDivElement>(null)
  const riskRef = useRef<HTMLDivElement>(null)
  const strategiesRef = useRef<HTMLDivElement>(null)
  const infoRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useMemo(
    () => ({
      charts: chartsRef,
      about: aboutRef,
      risk: riskRef,
      strategies: strategiesRef,
      info: infoRef
    }),
    []
  )
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    about: true,
    risk: true,
    strategies: true,
    info: true,
    charts: true
  })
  const collapsibleTitles: Record<SectionKey, string> = {
    about: 'Vault Info',
    risk: 'Risk Score',
    strategies: 'Strategies',
    info: 'More Info',
    charts: 'Performance'
  }
  const [activeSection, setActiveSection] = useState<SectionKey>('charts')
  const [sectionScrollOffset, setSectionScrollOffset] = useState(0)
  const [isHeaderCompressed, setIsHeaderCompressed] = useState(false)
  const initialHeaderOffsetRef = useRef<number | null>(null)
  const scrollPadding = 16
  const widgetBottomPadding = 16
  const updateSectionScrollOffset = useCallback((): number => {
    if (typeof window === 'undefined') return 0
    const baseOffset = resolveHeaderOffset()
    const headerHeight = headerRef.current?.getBoundingClientRect().height ?? 0
    const nextOffset = Math.round(baseOffset + headerHeight)
    document.documentElement.style.setProperty('--vault-header-height', `${nextOffset}px`)
    setSectionScrollOffset((prev) => (Math.abs(prev - nextOffset) > 1 ? nextOffset : prev))
    return nextOffset
  }, [])
  const [isProgrammaticScroll, setIsProgrammaticScroll] = useState(false)
  const scrollTargetRef = useRef<number | null>(null)
  const scrollTimeoutRef = useRef<number | null>(null)
  const [pendingSectionKey, setPendingSectionKey] = useState<SectionKey | null>(null)

  // Reset state when vault changes
  useEffect(() => {
    if (vaultKey !== lastVaultKey) {
      setCurrentVault(undefined)
      setOverrideVault(undefined)
      setHasFetchedOverride(false)
      setIsInit(false)
      setLastVaultKey(vaultKey)
      initialHeaderOffsetRef.current = null
      if (typeof window !== 'undefined') {
        document.documentElement.style.removeProperty('--vault-header-initial-offset')
      }
    }
  }, [vaultKey, lastVaultKey])

  useEffect(() => {
    if (typeof window === 'undefined') return
    void vaultKey
    let frame = 0
    const captureInitialOffset = (): void => {
      if (initialHeaderOffsetRef.current !== null) return
      if (window.scrollY > 0) return
      const baseOffset = resolveHeaderOffset()
      const headerHeight = headerRef.current?.getBoundingClientRect().height ?? 0
      if (headerHeight <= 0) {
        frame = requestAnimationFrame(captureInitialOffset)
        return
      }
      const paddedOffset = Math.round(baseOffset + headerHeight + widgetBottomPadding)
      initialHeaderOffsetRef.current = paddedOffset
      document.documentElement.style.setProperty('--vault-header-initial-offset', `${paddedOffset}px`)
    }

    frame = requestAnimationFrame(captureInitialOffset)
    return (): void => {
      if (frame) cancelAnimationFrame(frame)
    }
  }, [vaultKey])

  // Create a stable endpoint that includes the vault key to force SWR to refetch
  const endpoint = useMemo(() => {
    if (!params.address || !yDaemonBaseUri) return null
    return `${yDaemonBaseUri}/vaults/${toAddress(params.address as string)}?${new URLSearchParams({
      strategiesDetails: 'withDetails',
      strategiesCondition: 'inQueue'
    })}`
  }, [params.address, yDaemonBaseUri])

  const {
    data: vault,
    isLoading: isLoadingVault,
    mutate
  } = useFetch<TYDaemonVault>({
    endpoint,
    schema: yDaemonVaultSchema,
    config: {
      // Force re-fetch when vault key changes
      revalidateOnMount: true,
      keepPreviousData: false,
      dedupingInterval: 0 // Disable deduping to ensure fresh fetch
    }
  })

  // Force refetch when endpoint changes
  useEffect(() => {
    if (endpoint) {
      mutate()
    }
  }, [endpoint, mutate])

  // TODO: remove this workaround when possible
  // <WORKAROUND>
  const currentVault = useMemo(() => {
    if (overrideVault) return overrideVault
    if (_currentVault) return _currentVault
    return undefined
  }, [overrideVault, _currentVault])

  useEffect(() => {
    if (!hasFetchedOverride && _currentVault && _currentVault.address) {
      setHasFetchedOverride(true)
      fetchYBoldVault(yDaemonBaseUri, _currentVault).then((_vault) => {
        if (_vault) {
          setOverrideVault(_vault)
        }
      })
    }
  }, [yDaemonBaseUri, _currentVault, hasFetchedOverride])
  // </WORKAROUND>

  useEffect((): void => {
    if (vault && (!_currentVault || vault.address !== _currentVault.address)) {
      setCurrentVault(vault)
      setIsInit(true)
    }
  }, [vault, _currentVault])

  useEffect((): void => {
    if (address && isActive) {
      const tokensToRefresh: TUseBalancesTokens[] = []
      if (currentVault?.address) {
        tokensToRefresh.push({
          address: currentVault.address,
          chainID: currentVault.chainID
        })
      }
      if (currentVault?.token?.address) {
        tokensToRefresh.push({
          address: currentVault.token.address,
          chainID: currentVault.chainID
        })
      }
      if (currentVault?.staking.available) {
        tokensToRefresh.push({
          address: currentVault.staking.address,
          chainID: currentVault.chainID
        })
      }
      onRefresh(tokensToRefresh)
    }
  }, [
    currentVault?.address,
    currentVault?.token.address,
    address,
    isActive,
    onRefresh,
    currentVault?.chainID,
    currentVault?.staking.available,
    currentVault?.staking.address
  ])

  const widgetActions = useMemo(() => {
    if (currentVault?.migration?.available) {
      return [WidgetActionType.Deposit, WidgetActionType.Migrate, WidgetActionType.Withdraw]
    }
    return [WidgetActionType.Deposit, WidgetActionType.Withdraw]
  }, [currentVault?.migration?.available])
  const [widgetMode, setWidgetMode] = useState<WidgetActionType>(widgetActions[0])
  const [isWidgetSettingsOpen, setIsWidgetSettingsOpen] = useState(false)
  const [isWidgetWalletOpen, setIsWidgetWalletOpen] = useState(false)
  const [isWidgetRewardsOpen, setIsWidgetRewardsOpen] = useState(false)
  const [collapsedWidgetHeight, setCollapsedWidgetHeight] = useState<number | null>(null)
  const [depositPrefill, setDepositPrefill] = useState<{
    address: `0x${string}`
    chainId: number
    amount?: string
  } | null>(null)

  useEffect(() => {
    setWidgetMode(widgetActions[0])
  }, [widgetActions])

  const toggleWidgetSettings = (): void => {
    setIsWidgetSettingsOpen((prev) => {
      const next = !prev
      if (next) {
        setIsWidgetWalletOpen(false)
        setIsWidgetRewardsOpen(false)
      }
      return next
    })
  }

  const openWidgetWallet = (): void => {
    setIsWidgetWalletOpen(true)
    setIsWidgetSettingsOpen(false)
    setIsWidgetRewardsOpen(false)
  }

  const closeWidgetOverlays = (): void => {
    setIsWidgetSettingsOpen(false)
    setIsWidgetWalletOpen(false)
    setIsWidgetRewardsOpen(false)
  }

  const isWidgetPanelActive = !isWidgetWalletOpen

  const openWidgetRewards = (): void => {
    setIsWidgetRewardsOpen(true)
    setIsWidgetSettingsOpen(false)
  }

  const closeWidgetRewards = (): void => {
    setIsWidgetRewardsOpen(false)
  }

  const updateCollapsedWidgetHeight = useCallback(() => {
    if (isWidgetRewardsOpen) {
      return
    }
    const rewardsElement = widgetRewardsRef.current
    if (!rewardsElement) {
      return
    }
    const nextHeight = rewardsElement.offsetTop + rewardsElement.offsetHeight
    setCollapsedWidgetHeight((prev) => (prev && Math.abs(prev - nextHeight) < 1 ? prev : nextHeight))
  }, [isWidgetRewardsOpen])

  const toggleWidgetCollapse = (): void => {
    setIsWidgetRewardsOpen((prev) => !prev)
    setIsWidgetSettingsOpen(false)
  }

  const handleZapTokenSelect = useCallback(
    (token: TToken): void => {
      if (!widgetActions.includes(WidgetActionType.Deposit)) {
        return
      }
      setIsWidgetSettingsOpen(false)
      setIsWidgetWalletOpen(false)
      setIsWidgetRewardsOpen(false)
      setWidgetMode(WidgetActionType.Deposit)
      setDepositPrefill({
        address: toAddress(token.address),
        chainId: token.chainID
      })
    },
    [widgetActions]
  )

  const handleRewardsClaimSuccess = useCallback(() => {
    if (!currentVault) {
      return
    }
    mutate()
    onRefresh([
      { address: currentVault.address, chainID: currentVault.chainID },
      { address: currentVault.token.address, chainID: currentVault.chainID }
    ])
  }, [currentVault, mutate, onRefresh])

  useEffect(() => {
    updateCollapsedWidgetHeight()
  }, [updateCollapsedWidgetHeight])

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      return
    }
    const observer = new ResizeObserver(() => updateCollapsedWidgetHeight())
    if (widgetPrimaryRef.current) {
      observer.observe(widgetPrimaryRef.current)
    }
    if (widgetRewardsRef.current) {
      observer.observe(widgetRewardsRef.current)
    }
    return () => observer.disconnect()
  }, [updateCollapsedWidgetHeight])

  const sections = useMemo(() => {
    if (!currentVault || !yDaemonBaseUri) {
      return []
    }

    return [
      {
        key: 'charts' as const,
        shouldRender: Number.isInteger(chainId),
        ref: sectionRefs.charts,
        content: (
          <VaultChartsSection
            chainId={chainId}
            vaultAddress={currentVault.address}
            chartHeightPx={180}
            chartHeightMdPx={230}
          />
        )
      },
      {
        key: 'about' as const,
        shouldRender: true,
        ref: sectionRefs.about,
        content: <VaultAboutSection currentVault={currentVault} />
      },
      {
        key: 'strategies' as const,
        shouldRender: Number(currentVault.strategies?.length || 0) > 0,
        ref: sectionRefs.strategies,
        content: <VaultStrategiesSection currentVault={currentVault} />
      },
      {
        key: 'risk' as const,
        shouldRender: true,
        ref: sectionRefs.risk,
        content: <VaultRiskSection currentVault={currentVault} />
      },
      {
        key: 'info' as const,
        shouldRender: true,
        ref: sectionRefs.info,
        content: <VaultInfoSection currentVault={currentVault} yDaemonBaseUri={yDaemonBaseUri} />
      }
    ]
  }, [chainId, currentVault, sectionRefs, yDaemonBaseUri])

  const renderableSections = useMemo(() => sections.filter((section) => section.shouldRender), [sections])
  const sectionTabs = renderableSections.map((section) => ({
    key: section.key,
    label: collapsibleTitles[section.key]
  }))
  const scrollSpySections = useMemo(
    () =>
      renderableSections.map((section) => ({
        key: section.key,
        ref: section.ref
      })),
    [renderableSections]
  )

  useScrollSpy({
    sections: scrollSpySections,
    activeKey: activeSection,
    onActiveKeyChange: setActiveSection,
    offsetTop: sectionScrollOffset + scrollPadding,
    enabled: renderableSections.length > 0 && !isProgrammaticScroll
  })

  useEffect(() => {
    if (!renderableSections.some((section) => section.key === activeSection) && renderableSections[0]) {
      setActiveSection(renderableSections[0].key)
    }
  }, [renderableSections, activeSection])

  useEffect(() => {
    if (!pendingSectionKey || !isHeaderCompressed) return
    const element = sectionRefs[pendingSectionKey]?.current
    if (!element || typeof window === 'undefined') {
      setPendingSectionKey(null)
      setIsProgrammaticScroll(false)
      return
    }

    const scrollOffset = updateSectionScrollOffset()
    const top = element.getBoundingClientRect().top + window.scrollY - scrollOffset
    const baseTarget = pendingSectionKey === 'charts' ? Math.max(top, 1) : top
    const targetTop = Math.max(1, baseTarget - scrollPadding)

    scrollTargetRef.current = targetTop
    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current)
    }
    scrollTimeoutRef.current = window.setTimeout(() => {
      scrollTargetRef.current = null
      setIsProgrammaticScroll(false)
      scrollTimeoutRef.current = null
    }, 1200)

    window.scrollTo({ top: targetTop, behavior: 'smooth' })
    setPendingSectionKey(null)
  }, [pendingSectionKey, isHeaderCompressed, sectionRefs, updateSectionScrollOffset])

  useEffect(() => {
    if (!isProgrammaticScroll || typeof window === 'undefined') return

    const handleScroll = (): void => {
      const target = scrollTargetRef.current
      if (target === null) return
      if (Math.abs(window.scrollY - target) <= 2) {
        scrollTargetRef.current = null
        setIsProgrammaticScroll(false)
        if (scrollTimeoutRef.current) {
          window.clearTimeout(scrollTimeoutRef.current)
          scrollTimeoutRef.current = null
        }
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return (): void => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [isProgrammaticScroll])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleResize = (): void => {
      updateSectionScrollOffset()
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return (): void => window.removeEventListener('resize', handleResize)
  }, [updateSectionScrollOffset])

  useEffect(() => {
    if (typeof window === 'undefined') return
    void isHeaderCompressed
    const frame = requestAnimationFrame(() => {
      updateSectionScrollOffset()
    })
    return (): void => cancelAnimationFrame(frame)
  }, [isHeaderCompressed, updateSectionScrollOffset])

  useEffect(() => {
    const element = headerRef.current
    if (!element || typeof ResizeObserver === 'undefined') return

    let frame = 0
    const updateHeight = (): void => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        updateSectionScrollOffset()
      })
    }

    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(element)

    return (): void => {
      if (frame) cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [updateSectionScrollOffset])

  const handleSelectSection = (key: SectionKey): void => {
    setActiveSection(key)
    const element = sectionRefs[key]?.current
    if (!element || typeof window === 'undefined') return

    if (!isHeaderCompressed) {
      setIsProgrammaticScroll(true)
      setPendingSectionKey(key)
      window.scrollTo({ top: 1, behavior: 'auto' })
      return
    }

    const scrollOffset = updateSectionScrollOffset()
    const top = element.getBoundingClientRect().top + window.scrollY - scrollOffset
    const baseTarget = key === 'charts' ? Math.max(top, 1) : top
    const targetTop = Math.max(1, baseTarget - scrollPadding)

    setIsProgrammaticScroll(true)
    scrollTargetRef.current = targetTop
    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current)
    }
    scrollTimeoutRef.current = window.setTimeout(() => {
      scrollTargetRef.current = null
      setIsProgrammaticScroll(false)
      scrollTimeoutRef.current = null
    }, 1200)

    window.scrollTo({ top: targetTop, behavior: 'smooth' })
  }

  const handleFloatingButtonClick = (
    action: typeof WidgetActionType.Deposit | typeof WidgetActionType.Withdraw
  ): void => {
    setMobileDrawerAction(action)
    setIsMobileDrawerOpen(true)
  }

  const handleMobileDrawerClose = (): void => {
    setIsMobileDrawerOpen(false)
  }

  useEffect(() => {
    if (isMobileDrawerOpen && mobileWidgetRef.current) {
      mobileWidgetRef.current.setMode(mobileDrawerAction)
    }
  }, [isMobileDrawerOpen, mobileDrawerAction])

  if (isLoadingVault || !params.address || !isInit || !yDaemonBaseUri) {
    return (
      <div className={'relative flex min-h-dvh flex-col px-4 text-center'}>
        <div className={'mt-[20%] flex h-10 items-center justify-center'}>
          <span className={'loader'} />
        </div>
      </div>
    )
  }

  if (!currentVault) {
    return (
      <div className={'relative flex h-14 flex-col items-center justify-center px-4 text-center'}>
        <div className={'mt-[20%] flex h-10 items-center justify-center'}>
          <p className={'text-sm text-text-primary'}>{"We couldn't find this vault on the connected network."}</p>
        </div>
      </div>
    )
  }

  const isCollapsibleMode = headerDisplayMode === 'collapsible'
  // Calculate sticky positions for the collapsible header (desktop only)
  // On mobile, natural scroll behavior is used
  const headerStickyTop = 'var(--header-height)'
  const widgetModeLabel =
    widgetMode === WidgetActionType.Deposit
      ? 'Deposit'
      : widgetMode === WidgetActionType.Withdraw
        ? 'Withdraw'
        : 'Migrate'
  const collapsedWidgetTitle = isWidgetWalletOpen ? 'My Info' : widgetModeLabel

  return (
    <div
      className={
        'min-h-[calc(100vh-var(--header-height))] w-full bg-app pb-[calc(7rem+env(safe-area-inset-bottom,0px))] sm:pb-8'
      }
    >
      <div className={'mx-auto w-full max-w-[1232px] px-4'}>
        <header
          className={cl(
            'h-full rounded-3xl',
            'relative flex-col items-center justify-center',
            'hidden md:flex',
            'md:sticky md:z-30'
          )}
          style={{ top: headerStickyTop }}
          ref={headerRef}
        >
          <VaultDetailsHeader
            currentVault={currentVault}
            isCollapsibleMode={isCollapsibleMode}
            sectionTabs={sectionTabs}
            activeSectionKey={activeSection}
            onSelectSection={(key): void => handleSelectSection(key as SectionKey)}
            sectionSelectorRef={sectionSelectorRef}
            widgetActions={widgetActions}
            widgetMode={widgetMode}
            onWidgetModeChange={setWidgetMode}
            isWidgetWalletOpen={isWidgetWalletOpen}
            onWidgetWalletOpen={openWidgetWallet}
            onWidgetCloseOverlays={closeWidgetOverlays}
            onCompressionChange={setIsHeaderCompressed}
          />
        </header>

        {/* Mobile: Compact Header */}
        <div className="md:hidden mt-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-full bg-surface/70">
              <ImageWithFallback
                src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${
                  currentVault.chainID
                }/${currentVault.token.address.toLowerCase()}/logo-128.png`}
                alt={currentVault.token.symbol || ''}
                width={40}
                height={40}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h1
                className={cl(
                  'text-lg font-black leading-tight truncate-safe',
                  isDarkTheme ? 'text-text-primary' : 'text-text-secondary'
                )}
              >
                {getVaultName(currentVault)} yVault
              </h1>
              <p className="text-mobile-label text-text-secondary">
                {currentVault.token.symbol} • v{currentVault.version}
              </p>
            </div>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden space-y-4">
          {/* Key metrics above chart */}
          <MobileKeyMetrics currentVault={currentVault} />

          {/* Chart section */}
          {Number.isInteger(chainId) && (
            <div className="border border-border rounded-lg bg-surface overflow-hidden">
              <VaultChartsSection
                chainId={chainId}
                vaultAddress={currentVault.address}
                chartHeightPx={180}
                chartHeightMdPx={230}
              />
            </div>
          )}

          {/* Details sections - collapsible on mobile */}
          <section id={mobileDetailsSectionId} ref={detailsRef} aria-label="Vault details" className="space-y-4 pb-8">
            {renderableSections
              .filter((section) => section.key !== 'charts')
              .map((section) => {
                const typedKey = section.key as Exclude<SectionKey, 'charts'>
                const isOpen = openSections[typedKey]

                return (
                  <div
                    key={section.key}
                    ref={section.ref}
                    data-scroll-spy-key={section.key}
                    className={'border border-border rounded-lg bg-surface'}
                  >
                    <button
                      type={'button'}
                      className={'flex w-full items-center justify-between gap-3 px-4 py-3'}
                      onClick={(): void =>
                        setOpenSections((previous) => ({
                          ...previous,
                          [typedKey]: !previous[typedKey]
                        }))
                      }
                    >
                      <span className={'text-base font-semibold text-text-primary'}>{collapsibleTitles[typedKey]}</span>
                      <IconChevron
                        className={'size-4 text-text-secondary transition-transform duration-200'}
                        direction={isOpen ? 'up' : 'down'}
                      />
                    </button>
                    {isOpen ? <div>{section.content}</div> : null}
                  </div>
                )
              })}
          </section>
        </div>

        {/* Main Content Grid - Responsive layout */}
        <section className={'grid grid-cols-1 gap-4 md:gap-6 md:grid-cols-20 md:items-start bg-app'}>
          <div
            ref={widgetContainerRef}
            className={cl(
              'hidden md:block',
              'order-1 md:order-2',
              'md:col-span-7 md:col-start-14 md:sticky md:h-[calc(100vh-var(--vault-header-initial-offset))] pt-4',
              'flex flex-col overflow-hidden',
              'max-h-[calc(100vh-var(--vault-header-initial-offset))]'
            )}
            style={{ top: 'var(--vault-header-height, var(--header-height))' }}
          >
            <div
              ref={widgetStackRef}
              className={cl(
                'relative grid w-full min-w-0 flex-1 min-h-0 max-h-[calc(100vh-16px-var(--vault-header-initial-offset))] overflow-hidden',
                isWidgetRewardsOpen ? 'grid-rows-[auto_minmax(0,1fr)]' : 'grid-rows-[minmax(0,1fr)_auto]'
              )}
              style={isWidgetRewardsOpen && collapsedWidgetHeight ? { height: collapsedWidgetHeight } : undefined}
            >
              <div ref={widgetPrimaryRef} className="flex w-full min-w-0 flex-col min-h-0">
                {isWidgetRewardsOpen ? (
                  <button
                    type="button"
                    onClick={toggleWidgetCollapse}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-surface px-6 py-4"
                  >
                    <span className="text-base font-semibold text-text-primary">{collapsedWidgetTitle}</span>
                    <IconChevron className="size-4 text-text-secondary transition-transform" direction={'down'} />
                  </button>
                ) : (
                  <div
                    className={cl('flex flex-col min-h-0', isWidgetPanelActive ? 'flex' : 'hidden')}
                    aria-hidden={!isWidgetPanelActive}
                  >
                    <Widget
                      ref={widgetRef}
                      vaultAddress={currentVault.address}
                      currentVault={currentVault}
                      gaugeAddress={currentVault.staking.address}
                      actions={widgetActions}
                      chainId={chainId}
                      mode={widgetMode}
                      onModeChange={setWidgetMode}
                      showTabs={false}
                      onOpenSettings={toggleWidgetSettings}
                      isSettingsOpen={isWidgetSettingsOpen}
                      depositPrefill={depositPrefill}
                      onDepositPrefillConsumed={() => setDepositPrefill(null)}
                    />
                  </div>
                )}
                <WalletPanel
                  isActive={isWidgetWalletOpen && !isWidgetRewardsOpen}
                  currentVault={currentVault}
                  vaultAddress={toAddress(currentVault.address)}
                  stakingAddress={
                    isZeroAddress(currentVault.staking.address) ? undefined : toAddress(currentVault.staking.address)
                  }
                  chainId={chainId}
                  onSelectZapToken={handleZapTokenSelect}
                />
              </div>
              <div ref={widgetRewardsRef} className={cl('w-full min-w-0', isWidgetRewardsOpen ? 'flex min-h-0' : '')}>
                <WidgetRewards
                  stakingAddress={currentVault.staking.available ? currentVault.staking.address : undefined}
                  stakingSource={currentVault.staking.source}
                  rewardTokens={(currentVault.staking.rewards ?? []).map((r) => ({
                    address: r.address,
                    symbol: r.symbol,
                    decimals: r.decimals,
                    price: r.price,
                    isFinished: r.isFinished
                  }))}
                  chainId={chainId}
                  isPanelOpen={isWidgetRewardsOpen}
                  onOpenRewards={openWidgetRewards}
                  onCloseRewards={closeWidgetRewards}
                  onClaimSuccess={handleRewardsClaimSuccess}
                />
              </div>
            </div>
          </div>

          {/* Desktop sections - Hidden on mobile */}
          <div className={'hidden md:block space-y-4 md:col-span-13 order-2 md:order-1 py-4'}>
            {renderableSections.map((section) => {
              const isCollapsible =
                section.key === 'about' ||
                section.key === 'risk' ||
                section.key === 'strategies' ||
                section.key === 'info'
              if (isCollapsible) {
                const typedKey = section.key as SectionKey
                const isOpen = openSections[typedKey]

                return (
                  <div
                    key={section.key}
                    ref={section.ref}
                    data-scroll-spy-key={section.key}
                    className={'border border-border rounded-lg bg-surface'}
                    style={{ scrollMarginTop: `${sectionScrollOffset}px` }}
                  >
                    <button
                      type={'button'}
                      className={'flex w-full items-center justify-between gap-3 px-4 py-3 md:px-8 md:py-4'}
                      onClick={(): void =>
                        setOpenSections((previous) => ({
                          ...previous,
                          [typedKey]: !previous[typedKey]
                        }))
                      }
                    >
                      <span className={'text-base font-semibold text-text-primary'}>{collapsibleTitles[typedKey]}</span>
                      <IconChevron
                        className={'size-4 text-text-secondary transition-transform duration-200'}
                        direction={isOpen ? 'up' : 'down'}
                      />
                    </button>
                    {isOpen ? <div>{section.content}</div> : null}
                  </div>
                )
              }

              return (
                <div
                  key={section.key}
                  ref={section.ref}
                  data-scroll-spy-key={section.key}
                  className={'border border-border rounded-lg bg-surface'}
                  style={{ scrollMarginTop: `${sectionScrollOffset}px` }}
                >
                  {section.content}
                </div>
              )
            })}
            {renderableSections.length > 0 ? <div aria-hidden className={'h-[65vh]'} /> : null}
          </div>
        </section>
      </div>

      {/* Mobile Floating Action Buttons - visible only on viewports ≤640px, hidden when drawer is open */}
      {!isMobileDrawerOpen && (
        <div
          className={cl(
            'fixed bottom-0 left-0 right-0 z-50 px-4 pt-4 sm:hidden',
            'backdrop-blur-md',
            'pb-[calc(1rem+env(safe-area-inset-bottom,0px))]',
            'transition-transform duration-250 ease-in-out',
            scrollDirection === 'down' ? 'translate-y-full' : 'translate-y-0'
          )}
        >
          <div className="flex gap-3 max-w-[1232px] mx-auto">
            <button
              type="button"
              onClick={() => handleFloatingButtonClick(WidgetActionType.Deposit)}
              className="yearn--button--nextgen flex-1"
              data-variant="filled"
            >
              Deposit
            </button>
            <button
              type="button"
              onClick={() => handleFloatingButtonClick(WidgetActionType.Withdraw)}
              className="yearn--button flex-1"
              data-variant="light"
            >
              Withdraw
            </button>
          </div>
        </div>
      )}

      {/* Mobile Bottom Drawer with Widget */}
      <BottomDrawer
        isOpen={isMobileDrawerOpen}
        onClose={handleMobileDrawerClose}
        title={`${mobileDrawerAction === WidgetActionType.Deposit ? 'Deposit' : 'Withdraw'} ${currentVault.name}`}
      >
        <Widget
          ref={mobileWidgetRef}
          vaultAddress={currentVault.address}
          currentVault={currentVault}
          gaugeAddress={currentVault.staking.address}
          actions={widgetActions}
          chainId={chainId}
          hideTabSelector
          onOpenSettings={toggleWidgetSettings}
          isSettingsOpen={isWidgetSettingsOpen}
        />
      </BottomDrawer>
    </div>
  )
}

export default Index
