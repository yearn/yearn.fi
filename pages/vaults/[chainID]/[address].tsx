import { useScrollSpy } from '@hooks/useScrollSpy'
import { useThemePreference } from '@hooks/useThemePreference'
import { ImageWithFallback } from '@lib/components/ImageWithFallback'
import { useWallet } from '@lib/contexts/useWallet'
import { useWeb3 } from '@lib/contexts/useWeb3'
import type { TUseBalancesTokens } from '@lib/hooks/useBalances.multichains'
import { useFetch } from '@lib/hooks/useFetch'
import { useYDaemonBaseURI } from '@lib/hooks/useYDaemonBaseURI'
import { IconChevron } from '@lib/icons/IconChevron'
import { cl, toAddress } from '@lib/utils'
import { getVaultName } from '@lib/utils/helpers'
import type { TYDaemonVault } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { yDaemonVaultSchema } from '@lib/utils/schemas/yDaemonVaultsSchemas'
import { UserBalanceGrid, VaultMetricsGrid } from '@nextgen/components/vaults-beta/QuickStatsGrid'
import { VaultAboutSection } from '@nextgen/components/vaults-beta/VaultAboutSection'
import { VaultChartsSection } from '@nextgen/components/vaults-beta/VaultChartsSection'
import { VaultDetailsHeader } from '@nextgen/components/vaults-beta/VaultDetailsHeader'
import { VaultInfoSection } from '@nextgen/components/vaults-beta/VaultInfoSection'
import { VaultRiskSection } from '@nextgen/components/vaults-beta/VaultRiskSection'
import { VaultStrategiesSection } from '@nextgen/components/vaults-beta/VaultStrategiesSection'
import { Widget } from '@nextgen/components/widget'
import { WidgetActionType } from '@nextgen/types'
import { fetchYBoldVault } from '@vaults-v3/utils/handleYBold'
import type { ReactElement } from 'react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { useDevFlags } from '/src/contexts/useDevFlags'

function Index(): ReactElement | null {
  type SectionKey = 'charts' | 'about' | 'risk' | 'strategies' | 'info'
  const { headerDisplayMode } = useDevFlags()
  const mobileDetailsSectionId = useId()
  const themePreference = useThemePreference()
  const isDarkTheme = themePreference !== 'light'

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
  const [isMobileDetailsExpanded, setIsMobileDetailsExpanded] = useState(false)
  const detailsRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement | null>(null)
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
    about: 'Description',
    risk: 'Risk',
    strategies: 'Strategies',
    info: 'More Info',
    charts: 'Performance'
  }
  const [activeSection, setActiveSection] = useState<SectionKey>('charts')

  // Reset state when vault changes
  useEffect(() => {
    if (vaultKey !== lastVaultKey) {
      setCurrentVault(undefined)
      setOverrideVault(undefined)
      setHasFetchedOverride(false)
      setIsInit(false)
      setLastVaultKey(vaultKey)
    }
  }, [vaultKey, lastVaultKey])

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

  const isV3 = currentVault?.version.startsWith('3') || currentVault?.version.startsWith('~3')

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

  const sections = useMemo(() => {
    if (!currentVault || !yDaemonBaseUri) {
      return []
    }

    return [
      {
        key: 'charts' as const,
        shouldRender: Number.isInteger(chainId),
        ref: sectionRefs.charts,
        content: <VaultChartsSection chainId={chainId} vaultAddress={currentVault.address} chartHeightPx={230} />
      },
      {
        key: 'about' as const,
        shouldRender: true,
        ref: sectionRefs.about,
        content: <VaultAboutSection currentVault={currentVault} />
      },
      {
        key: 'risk' as const,
        shouldRender: true,
        ref: sectionRefs.risk,
        content: <VaultRiskSection currentVault={currentVault} />
      },
      {
        key: 'strategies' as const,
        shouldRender: Number(currentVault.strategies?.length || 0) > 0,
        ref: sectionRefs.strategies,
        content: <VaultStrategiesSection currentVault={currentVault} />
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
  const scrollSpySections = useMemo(
    () => renderableSections.map((section) => ({ key: section.key, ref: section.ref })),
    [renderableSections]
  )

  useScrollSpy({
    sections: scrollSpySections,
    activeKey: activeSection,
    onActiveKeyChange: setActiveSection,
    rootMargin: '-250px 0px -60% 0px',
    enabled: renderableSections.length > 0
  })

  useEffect(() => {
    if (!renderableSections.some((section) => section.key === activeSection) && renderableSections[0]) {
      setActiveSection(renderableSections[0].key)
    }
  }, [renderableSections, activeSection])

  const handleSelectSection = (key: SectionKey): void => {
    setActiveSection(key)
    const element = sectionRefs[key]?.current
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const toggleMobileDetails = (): void => {
    setIsMobileDetailsExpanded((prev) => {
      const newState = !prev
      // Scroll to details when expanding
      if (newState && detailsRef.current) {
        setTimeout(() => {
          detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }, 100)
      }
      return newState
    })
  }

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
  const nextSticky = `calc(var(--header-height) + 117.5px)`

  return (
    <div className={'min-h-[calc(100vh-var(--header-height))] w-full bg-app pb-8'}>
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
          <VaultDetailsHeader currentVault={currentVault} isCollapsibleMode={isCollapsibleMode} />
        </header>

        {/* Mobile: Compact Header */}
        <div className="md:hidden mt-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-full bg-surface/70">
              <ImageWithFallback
                src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${currentVault.chainID}/${currentVault.token.address.toLowerCase()}/logo-128.png`}
                alt={currentVault.token.symbol || ''}
                width={40}
                height={40}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h1
                className={cl(
                  'text-lg font-black leading-tight truncate',
                  isDarkTheme ? 'text-text-primary' : 'text-text-secondary'
                )}
              >
                {getVaultName(currentVault)} yVault
              </h1>
              <p className="text-xs text-text-secondary truncate">
                {currentVault.token.symbol} • v{currentVault.version}
              </p>
            </div>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden space-y-4">
          {/* Vault metrics always at the top */}
          <VaultMetricsGrid currentVault={currentVault} />

          {/* User balance grid */}
          <UserBalanceGrid currentVault={currentVault} />

          {/* Widget */}
          <div>
            <Widget
              vaultType={isV3 ? 'v3' : 'v2'}
              vaultAddress={currentVault.address}
              currentVault={currentVault}
              gaugeAddress={currentVault.staking.address}
              actions={[WidgetActionType.DepositFinal, WidgetActionType.WithdrawFinal]}
              chainId={chainId}
            />
          </div>

          {/* Expandable details toggle button */}
          <button
            type="button"
            onClick={toggleMobileDetails}
            aria-label={isMobileDetailsExpanded ? 'Hide vault details' : 'Show vault details'}
            aria-controls={mobileDetailsSectionId}
            aria-expanded={isMobileDetailsExpanded}
            className={cl(
              'w-full bg-surface-secondary border border-border rounded-lg',
              'py-4 px-6 flex items-center justify-between',
              'transition-all duration-200',
              'hover:bg-surface-secondary active:scale-[0.99]'
            )}
          >
            <span className="text-sm font-semibold text-text-primary">
              {isMobileDetailsExpanded ? 'Hide Details' : 'View More Details'}
            </span>
            <IconChevron direction={isMobileDetailsExpanded ? 'up' : 'down'} className="size-5 text-text-secondary" />
          </button>

          {/* Expandable details section */}
          {isMobileDetailsExpanded && (
            <section
              id={mobileDetailsSectionId}
              ref={detailsRef}
              aria-label="Vault performance and details"
              className="space-y-4 pb-8"
            >
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
                    >
                      <button
                        type={'button'}
                        className={'flex w-full items-center justify-between gap-3 px-4 py-3'}
                        onClick={(): void =>
                          setOpenSections((previous) => ({ ...previous, [typedKey]: !previous[typedKey] }))
                        }
                      >
                        <span className={'text-base font-semibold text-text-primary'}>
                          {collapsibleTitles[typedKey]}
                        </span>
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
                  >
                    {section.content}
                  </div>
                )
              })}
            </section>
          )}
        </div>

        {/* Desktop Layout - Hidden on mobile */}
        <section className={'hidden md:grid grid-cols-1 gap-6 md:grid-cols-20 md:items-start bg-app'}>
          <div className={'space-y-4 md:col-span-13 pb-4'}>
            {renderableSections.length > 0 ? (
              <div className={'w-full sticky z-30'} style={{ top: nextSticky }}>
                <div className={'bg-app h-6'}></div>
                <div
                  className={cl(
                    'flex flex-wrap gap-2 md:pb-3 md:gap-3',
                    'bg-gradient-to-b from-app from-90% to-transparent'
                  )}
                >
                  <div
                    className={
                      'flex w-full flex-wrap justify-between gap-2 rounded-lg bg-surface-secondary p-1 shadow-inner'
                    }
                  >
                    {renderableSections.map((section) => (
                      <button
                        key={section.key}
                        type={'button'}
                        onClick={(): void => handleSelectSection(section.key)}
                        className={cl(
                          'flex-1 min-w-[120px] rounded-lg px-3 py-2 text-xs font-semibold transition-all md:min-w-0 md:flex-1 md:px-4 md:py-2.5',
                          activeSection === section.key
                            ? 'bg-surface text-text-primary shadow-sm'
                            : 'bg-transparent text-text-secondary hover:text-text-primary'
                        )}
                      >
                        {collapsibleTitles[section.key]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

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
                    className={'border border-border rounded-lg bg-surface scroll-mt-[250px]'}
                  >
                    <button
                      type={'button'}
                      className={'flex w-full items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4'}
                      onClick={(): void =>
                        setOpenSections((previous) => ({ ...previous, [typedKey]: !previous[typedKey] }))
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
                  className={'border border-border rounded-lg bg-surface scroll-mt-[250px]'}
                >
                  {section.content}
                </div>
              )
            })}
          </div>
          <div className={cl('md:col-span-7 md:col-start-14 md:sticky md:h-fit pt-6')} style={{ top: nextSticky }}>
            <div>
              <Widget
                vaultType={isV3 ? 'v3' : 'v2'}
                vaultAddress={currentVault.address}
                currentVault={currentVault}
                gaugeAddress={currentVault.staking.address}
                actions={[WidgetActionType.DepositFinal, WidgetActionType.WithdrawFinal]}
                chainId={chainId}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default Index
