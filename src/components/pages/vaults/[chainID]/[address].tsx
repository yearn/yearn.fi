import Link from '@components/Link'
import { useScrollSpy } from '@hooks/useScrollSpy'
import { BottomDrawer } from '@pages/vaults/components/detail/BottomDrawer'
import { MobileKeyMetrics } from '@pages/vaults/components/detail/QuickStatsGrid'
import { VaultAboutSection } from '@pages/vaults/components/detail/VaultAboutSection'
import { VaultChartsSection } from '@pages/vaults/components/detail/VaultChartsSection'
import { VaultDetailsHeader } from '@pages/vaults/components/detail/VaultDetailsHeader'
import { VaultInfoSection } from '@pages/vaults/components/detail/VaultInfoSection'
import { VaultRiskSection } from '@pages/vaults/components/detail/VaultRiskSection'
import { VaultStrategiesSection } from '@pages/vaults/components/detail/VaultStrategiesSection'
import { YvUsdChartsSection } from '@pages/vaults/components/detail/YvUsdChartsSection'
import { VaultDetailsWelcomeTour } from '@pages/vaults/components/tour/VaultDetailsWelcomeTour'
import type { TWidgetRef } from '@pages/vaults/components/widget'
import { Widget } from '@pages/vaults/components/widget'
import { MobileDrawerSettingsButton } from '@pages/vaults/components/widget/MobileDrawerSettingsButton'
import { WidgetRewards } from '@pages/vaults/components/widget/rewards'
import { WalletPanel } from '@pages/vaults/components/widget/WalletPanel'
import { YvUsdWidget } from '@pages/vaults/components/widget/yvUSD/YvUsdWidget'
import { getVaultView, type TKongVault, type TKongVaultView } from '@pages/vaults/domain/kongVaultSelectors'
import {
  mergeYBoldSnapshot,
  mergeYBoldVault,
  YBOLD_STAKING_ADDRESS,
  YBOLD_VAULT_ADDRESS
} from '@pages/vaults/domain/normalizeVault'
import { useVaultSnapshot } from '@pages/vaults/hooks/useVaultSnapshot'
import { useVaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import { useYvUsdVaults } from '@pages/vaults/hooks/useYvUsdVaults'
import { WidgetActionType } from '@pages/vaults/types'
import { isYvUsdAddress, YVUSD_LOCKED_ADDRESS, YVUSD_UNLOCKED_ADDRESS } from '@pages/vaults/utils/yvUsd'
import { Breadcrumbs } from '@shared/components/Breadcrumbs'
import { ImageWithFallback } from '@shared/components/ImageWithFallback'
import { useWallet } from '@shared/contexts/useWallet'
import { useYearn } from '@shared/contexts/useYearn'
import { IconChevron } from '@shared/icons/IconChevron'
import type { TToken } from '@shared/types'
import { cl, isZeroAddress, toAddress } from '@shared/utils'
import { getVaultName } from '@shared/utils/helpers'
import type { TKongVaultSnapshot } from '@shared/utils/schemas/kongVaultSnapshotSchema'
import type { ReactElement } from 'react'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { isAddressEqual } from 'viem'
import { VaultsListChip } from '@/components/pages/vaults/components/list/VaultsListChip'
import { deriveListKind } from '@/components/pages/vaults/utils/vaultListFacets'
import { getCategoryDescription, getProductTypeDescription } from '@/components/pages/vaults/utils/vaultTagCopy'
import { useWeb3 } from '@/components/shared/contexts/useWeb3'
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

const RETIRED_VAULT_ALERT_MESSAGES = {
  noFunds: 'This vault is retired.',
  sternMigration: 'This vault is retired. Please withdraw or migrate your funds.',
  softMigration:
    'This vault is retired, but still earning yield. It is still recommended to migrate your funds to the newest vault for the best experience and yield. Deposits are no longer allowed, but withdrawals will remain open indefinitely.',
  sternNoMigration: 'This vault is retired. Please withdraw your funds.',
  softNoMigration:
    'This vault is retired but still earning yield. Deposits are no longer allowed, but withdrawals will remain open indefinitely.'
} as const

const isSoftRetiredVault = (vault: TKongVaultView): boolean => {
  const hasActiveRouterStrategy = (vault.strategies ?? []).some(
    (strategy) => strategy.status === 'active' && strategy.name.toLowerCase().includes('router')
  )
  const hasPositiveMonthlyNetApy = vault.apr.points.monthAgo > 0 && vault.chainID !== 250
  return hasActiveRouterStrategy || hasPositiveMonthlyNetApy
}

const getRetiredVaultAlertMessage = ({
  vault,
  hasUserFundsInVault
}: {
  vault: TKongVaultView
  hasUserFundsInVault: boolean
}): string => {
  if (!hasUserFundsInVault) {
    return RETIRED_VAULT_ALERT_MESSAGES.noFunds
  }

  if (vault.symbol.includes('yv^2')) {
    return RETIRED_VAULT_ALERT_MESSAGES.softMigration
  }

  const hasMigrationPath = Boolean(vault.migration.available)
  const isSoft = isSoftRetiredVault(vault)

  if (hasMigrationPath) {
    return isSoft ? RETIRED_VAULT_ALERT_MESSAGES.softMigration : RETIRED_VAULT_ALERT_MESSAGES.sternMigration
  }

  return isSoft ? RETIRED_VAULT_ALERT_MESSAGES.softNoMigration : RETIRED_VAULT_ALERT_MESSAGES.sternNoMigration
}

const splitFirstSentence = (message: string): { title: string; body?: string } => {
  const firstPeriodIndex = message.indexOf('.')
  if (firstPeriodIndex === -1) return { title: message }

  const title = message.slice(0, firstPeriodIndex + 1).trim()
  const body = message.slice(firstPeriodIndex + 1).trim()
  return body ? { title, body } : { title }
}

const buildSnapshotBackedVault = (snapshot: TKongVaultSnapshot): TKongVault => {
  const token = snapshot.meta?.token
  const asset = snapshot.asset
    ? {
        address: snapshot.asset.address,
        name: snapshot.asset.name,
        symbol: snapshot.asset.symbol,
        decimals: snapshot.asset.decimals
      }
    : token
      ? {
          address: token.address,
          name: token.name,
          symbol: token.symbol,
          decimals: token.decimals
        }
      : null

  return {
    chainId: snapshot.chainId,
    address: snapshot.address,
    name: snapshot.name || snapshot.meta?.name || snapshot.meta?.displayName || '',
    symbol: snapshot.symbol || snapshot.meta?.displaySymbol || null,
    apiVersion: snapshot.apiVersion ?? null,
    decimals: snapshot.decimals ?? token?.decimals ?? asset?.decimals ?? null,
    asset,
    tvl: snapshot.tvl?.close ?? null,
    performance: null,
    fees: null,
    category: snapshot.meta?.category ?? null,
    type: snapshot.meta?.type ?? null,
    kind: snapshot.meta?.kind ?? null,
    v3: snapshot.apiVersion?.startsWith('3') ?? false,
    yearn: true,
    isRetired: snapshot.meta?.isRetired ?? false,
    isHidden: snapshot.meta?.isHidden ?? false,
    isBoosted: snapshot.meta?.isBoosted ?? false,
    isHighlighted: snapshot.meta?.isHighlighted ?? false,
    inclusion: snapshot.inclusion,
    migration: snapshot.meta?.migration?.available,
    origin: null,
    strategiesCount: snapshot.composition?.length ?? snapshot.debts?.length ?? 0,
    riskLevel: snapshot.risk?.riskLevel ?? null,
    staking: snapshot.staking
      ? {
          address: snapshot.staking.address ?? null,
          available: snapshot.staking.available
        }
      : null
  }
}

function RetiredVaultAlert({ message, className }: { message: string; className: string }): ReactElement {
  const { title, body } = splitFirstSentence(message)

  return (
    <div
      className={cl(
        'rounded-lg border border-border border-l-4 border-l-orange-500 dark:border-l-yellow-500 bg-surface-secondary text-sm text-text-primary',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <svg
          className="w-5 h-5 text-orange-500 dark:text-yellow-500 mt-0.5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div className="flex flex-col">
          <p className={'font-semibold'}>{title}</p>
          {body ? <p className="text-text-secondary">{body}</p> : null}
        </div>
      </div>
    </div>
  )
}

function Index(): ReactElement | null {
  type SectionKey = 'charts' | 'about' | 'risk' | 'strategies' | 'info'
  const { headerDisplayMode } = useDevFlags()
  const mobileDetailsSectionId = useId()

  const params = useParams()
  const chainId = Number(params.chainID)
  const { getBalance, onRefresh } = useWallet()
  const { address } = useWeb3()
  const { vaults, isLoadingVaultList, enableVaultListFetch } = useYearn()
  const {
    listVault: yvUsdVault,
    unlockedVault: yvUsdUnlockedVault,
    lockedVault: yvUsdLockedVault,
    isLoading: isLoadingYvUsd
  } = useYvUsdVaults()
  const isYvUsd = isYvUsdAddress(params.address)
  const vaultKey = `${params.chainID}-${params.address}`
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false)
  const [mobileDrawerAction, setMobileDrawerAction] = useState<WidgetActionType>(WidgetActionType.Deposit)
  const [hideMobileDrawerTabs, setHideMobileDrawerTabs] = useState(false)
  const mobileWidgetRef = useRef<TWidgetRef>(null)
  const mobileDrawerPanelRef = useRef<HTMLDivElement>(null)
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
    risk: 'Risk',
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
  const [hasTriggeredVaultListFetch, setHasTriggeredVaultListFetch] = useState(false)

  useEffect(() => {
    void vaultKey
    initialHeaderOffsetRef.current = null
    if (typeof window !== 'undefined') {
      document.documentElement.style.removeProperty('--vault-header-initial-offset')
    }
  }, [vaultKey])

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

  const baseVault = useMemo(() => {
    if (!params.address) return undefined
    const resolvedAddress = toAddress(params.address)
    return vaults[resolvedAddress]
  }, [params.address, vaults])

  const hasVaultList = Object.keys(vaults).length > 0

  const {
    data: snapshotVault,
    error: snapshotError,
    isLoading: isLoadingSnapshotVault,
    refetch: refetchSnapshot
  } = useVaultSnapshot({
    chainId,
    address: params.address
  })
  const isSnapshotNotFound = (snapshotError as any)?.response?.status === 404

  const isYBold = useMemo(() => {
    if (isYvUsd) return false
    if (!baseVault?.address && !params.address) return false
    const resolvedAddress = toAddress(baseVault?.address ?? params.address ?? '0x')
    return isAddressEqual(resolvedAddress, YBOLD_VAULT_ADDRESS)
  }, [isYvUsd, baseVault?.address, params.address])

  const yBoldStakingVault = useMemo(() => {
    if (!isYBold) return undefined
    return vaults[toAddress(YBOLD_STAKING_ADDRESS)]
  }, [isYBold, vaults])

  const mergedBaseVault = useMemo(() => {
    if (!baseVault) return undefined
    if (isYBold && yBoldStakingVault) {
      return mergeYBoldVault(baseVault, yBoldStakingVault)
    }
    return baseVault
  }, [baseVault, isYBold, yBoldStakingVault])

  const { data: yBoldSnapshot, refetch: refetchYBoldSnapshot } = useVaultSnapshot({
    chainId: isYBold ? chainId : undefined,
    address: isYBold ? YBOLD_STAKING_ADDRESS : undefined
  })

  const mergedSnapshot = useMemo(() => {
    if (!snapshotVault) return undefined
    if (isYBold && yBoldSnapshot) {
      return mergeYBoldSnapshot(snapshotVault, yBoldSnapshot)
    }
    return snapshotVault
  }, [isYBold, snapshotVault, yBoldSnapshot])

  const snapshotBackedVault = useMemo(() => {
    if (!mergedSnapshot) return undefined
    return buildSnapshotBackedVault(mergedSnapshot)
  }, [mergedSnapshot])

  const vaultViewInput = useMemo(() => {
    if (!mergedBaseVault) return snapshotBackedVault
    if (!snapshotBackedVault) return mergedBaseVault
    return mergedBaseVault.chainId === snapshotBackedVault.chainId ? mergedBaseVault : snapshotBackedVault
  }, [mergedBaseVault, snapshotBackedVault])

  const isFactoryVault = useMemo(() => {
    if (!vaultViewInput) return false
    return deriveListKind(vaultViewInput) === 'factory'
  }, [vaultViewInput])

  const snapshotShouldDisableStaking = mergedSnapshot?.meta?.shouldDisableStaking
  const shouldDisableStakingForDeposit = useMemo(() => {
    if (isFactoryVault) {
      return true
    }
    return snapshotShouldDisableStaking === true
  }, [snapshotShouldDisableStaking, isFactoryVault])

  const currentVault = useMemo(() => {
    if (isYvUsd) {
      const normalizedAddress = params.address ? toAddress(params.address) : undefined
      const isLockedAddress = normalizedAddress === YVUSD_LOCKED_ADDRESS

      if (isLockedAddress) {
        return yvUsdLockedVault ?? yvUsdVault ?? yvUsdUnlockedVault
      }

      const isUnlockedAddress = normalizedAddress === YVUSD_UNLOCKED_ADDRESS
      if (isUnlockedAddress) {
        return yvUsdUnlockedVault ?? yvUsdVault ?? yvUsdLockedVault
      }

      return yvUsdVault ?? yvUsdUnlockedVault ?? yvUsdLockedVault
    }
    if (!vaultViewInput) return undefined
    return getVaultView(vaultViewInput, mergedSnapshot)
  }, [isYvUsd, yvUsdLockedVault, yvUsdUnlockedVault, yvUsdVault, vaultViewInput, mergedSnapshot, params.address])

  const shouldBootstrapYvUsdVaultList = isYvUsd && !hasVaultList && !hasTriggeredVaultListFetch
  const isLoadingVault = isYvUsd
    ? !currentVault && (isLoadingYvUsd || isLoadingVaultList || shouldBootstrapYvUsdVaultList)
    : !currentVault && (isLoadingSnapshotVault || (isLoadingVaultList && !isSnapshotNotFound))

  const vaultUserData = useVaultUserData({
    vaultAddress: toAddress(currentVault?.address ?? '0x'),
    assetAddress: toAddress(currentVault?.token?.address ?? '0x'),
    stakingAddress: currentVault?.staking?.available ? toAddress(currentVault.staking.address) : undefined,
    chainId,
    account: address
  })

  useEffect(() => {
    if (hasTriggeredVaultListFetch || hasVaultList) {
      return
    }
    if (!isYvUsd && !snapshotVault) {
      return
    }
    setHasTriggeredVaultListFetch(true)
    const frame = requestAnimationFrame(() => enableVaultListFetch())
    return () => cancelAnimationFrame(frame)
  }, [enableVaultListFetch, hasTriggeredVaultListFetch, hasVaultList, isYvUsd, snapshotVault])

  const vaultShareBalance =
    !!address && currentVault?.address && Number.isInteger(currentVault?.chainID)
      ? getBalance({ address: toAddress(currentVault.address), chainID: currentVault.chainID }).raw
      : 0n

  const stakingShareBalance =
    !!address &&
    currentVault?.staking.available &&
    !isZeroAddress(currentVault?.staking.address) &&
    Number.isInteger(currentVault?.chainID)
      ? getBalance({ address: toAddress(currentVault.staking.address), chainID: currentVault.chainID }).raw
      : 0n

  const isMigratable = Boolean(currentVault?.migration?.available)
  const canShowMigrateAction = isMigratable && vaultShareBalance > 0n
  const isRetired = Boolean(currentVault?.info?.isRetired)
  const hasUserFundsInVault = vaultShareBalance > 0n || stakingShareBalance > 0n
  const retiredVaultAlertMessage = useMemo(() => {
    if (!isRetired || !currentVault) return null
    return getRetiredVaultAlertMessage({ vault: currentVault, hasUserFundsInVault })
  }, [currentVault, hasUserFundsInVault, isRetired])
  const widgetActions = useMemo(() => {
    if (isRetired || isMigratable) {
      return canShowMigrateAction ? [WidgetActionType.Migrate, WidgetActionType.Withdraw] : [WidgetActionType.Withdraw]
    }
    return [WidgetActionType.Deposit, WidgetActionType.Withdraw]
  }, [canShowMigrateAction, isMigratable, isRetired])
  const [widgetMode, setWidgetMode] = useState<WidgetActionType>(widgetActions[0])
  const [isWidgetSettingsOpen, setIsWidgetSettingsOpen] = useState(false)
  const [isWidgetWalletOpen, setIsWidgetWalletOpen] = useState(false)
  const [isWidgetRewardsOpen, setIsWidgetRewardsOpen] = useState(false)
  const [collapsedWidgetHeight, setCollapsedWidgetHeight] = useState<number | null>(null)
  const [isShortViewport, setIsShortViewport] = useState(false)
  const [isCompactWidget, setIsCompactWidget] = useState(false)
  const [shouldShowWidgetRewards, setShouldShowWidgetRewards] = useState(true)
  const [vaultTourState, setVaultTourState] = useState<{ isOpen: boolean; stepId?: string }>({ isOpen: false })
  const tourWidgetStateRef = useRef<{
    widgetMode: WidgetActionType
    isWalletOpen: boolean
    isSettingsOpen: boolean
    isRewardsOpen: boolean
  } | null>(null)
  const tourSectionsRef = useRef<Record<SectionKey, boolean> | null>(null)
  const [depositPrefill, setDepositPrefill] = useState<{
    address: `0x${string}`
    chainId: number
    amount?: string
  } | null>(null)

  useEffect(() => {
    setWidgetMode((previous) => (widgetActions.includes(previous) ? previous : widgetActions[0]))
  }, [widgetActions])

  useEffect(() => {
    if (!widgetActions.includes(mobileDrawerAction)) {
      setMobileDrawerAction(widgetActions[0])
    }
  }, [mobileDrawerAction, widgetActions])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const updateViewport = (): void => {
      setIsShortViewport(window.innerHeight < 890)
    }
    updateViewport()
    window.addEventListener('resize', updateViewport)
    return (): void => window.removeEventListener('resize', updateViewport)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const updateViewport = (): void => {
      setIsCompactWidget(window.innerHeight < 800)
    }
    updateViewport()
    window.addEventListener('resize', updateViewport)
    return (): void => window.removeEventListener('resize', updateViewport)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const updateRewardsVisibility = (): void => {
      const shouldShow = window.innerHeight >= 730
      setShouldShowWidgetRewards(shouldShow)
      if (!shouldShow) {
        setIsWidgetRewardsOpen(false)
      }
    }
    updateRewardsVisibility()
    window.addEventListener('resize', updateRewardsVisibility)
    return (): void => window.removeEventListener('resize', updateRewardsVisibility)
  }, [])

  useEffect(() => {
    if (!vaultTourState.isOpen) {
      return
    }
    if (!tourWidgetStateRef.current) {
      tourWidgetStateRef.current = {
        widgetMode,
        isWalletOpen: isWidgetWalletOpen,
        isSettingsOpen: isWidgetSettingsOpen,
        isRewardsOpen: isWidgetRewardsOpen
      }
    }
    if (!tourSectionsRef.current) {
      tourSectionsRef.current = openSections
    }
  }, [vaultTourState.isOpen, widgetMode, isWidgetWalletOpen, isWidgetSettingsOpen, isWidgetRewardsOpen, openSections])

  useEffect(() => {
    if (vaultTourState.isOpen) {
      return
    }
    if (tourWidgetStateRef.current) {
      const { widgetMode: savedMode, isWalletOpen, isSettingsOpen, isRewardsOpen } = tourWidgetStateRef.current
      if (widgetActions.includes(savedMode)) {
        setWidgetMode(savedMode)
      }
      setIsWidgetWalletOpen(isWalletOpen)
      setIsWidgetSettingsOpen(isSettingsOpen)
      setIsWidgetRewardsOpen(isRewardsOpen)
      tourWidgetStateRef.current = null
    }
    if (tourSectionsRef.current) {
      setOpenSections(tourSectionsRef.current)
      tourSectionsRef.current = null
    }
  }, [vaultTourState.isOpen, widgetActions])

  useEffect(() => {
    if (!vaultTourState.isOpen) {
      return
    }
    const stepId = vaultTourState.stepId
    const isWalletStep = stepId === 'my-info'

    if (isWalletStep) {
      setIsWidgetWalletOpen(true)
      setIsWidgetSettingsOpen(false)
      setIsWidgetRewardsOpen(false)
      return
    }

    if (isWidgetWalletOpen) {
      setIsWidgetWalletOpen(false)
    }

    const shouldShowDeposit = stepId === 'user-deposit' || stepId === 'deposit-widget'
    if (shouldShowDeposit && widgetActions.includes(WidgetActionType.Deposit)) {
      setWidgetMode(WidgetActionType.Deposit)
    }

    const tourSectionMap: Partial<Record<string, SectionKey>> = {
      info: 'info',
      strategies: 'strategies',
      risk: 'risk'
    }
    const targetSection = stepId ? tourSectionMap[stepId] : undefined
    if (targetSection) {
      setOpenSections((prev) => (prev[targetSection] ? prev : { ...prev, [targetSection]: true }))
    }
  }, [vaultTourState.isOpen, vaultTourState.stepId, widgetActions, isWidgetWalletOpen])

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
    updateCollapsedWidgetHeight()
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
    const container = widgetContainerRef.current
    if (!container || container.offsetParent === null) {
      return
    }
    const stackElement = widgetStackRef.current
    if (!stackElement) {
      return
    }
    const nextHeight = stackElement.getBoundingClientRect().height
    setCollapsedWidgetHeight((prev) => (prev && Math.abs(prev - nextHeight) < 1 ? prev : nextHeight))
  }, [isWidgetRewardsOpen])

  const toggleWidgetCollapse = (): void => {
    if (!isWidgetRewardsOpen) {
      updateCollapsedWidgetHeight()
    }
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
    refetchSnapshot()
    if (isYBold) {
      refetchYBoldSnapshot()
    }
    onRefresh([
      { address: currentVault.address, chainID: currentVault.chainID },
      { address: currentVault.token.address, chainID: currentVault.chainID }
    ])
  }, [currentVault, refetchSnapshot, refetchYBoldSnapshot, onRefresh, isYBold])

  useEffect(() => {
    updateCollapsedWidgetHeight()
  }, [updateCollapsedWidgetHeight])

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      return
    }
    const observer = new ResizeObserver(() => updateCollapsedWidgetHeight())
    if (widgetStackRef.current) {
      observer.observe(widgetStackRef.current)
    }
    return () => observer.disconnect()
  }, [updateCollapsedWidgetHeight])

  const sections = useMemo(() => {
    if (!currentVault) {
      return []
    }

    return [
      {
        key: 'charts' as const,
        shouldRender: Number.isInteger(chainId),
        ref: sectionRefs.charts,
        content: isYvUsd ? (
          <YvUsdChartsSection chartHeightPx={180} chartHeightMdPx={230} />
        ) : (
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
        content: <VaultInfoSection currentVault={currentVault} inceptTime={snapshotVault?.inceptTime ?? null} />
      }
    ]
  }, [chainId, currentVault, isYvUsd, sectionRefs, snapshotVault?.inceptTime])

  const renderableSections = useMemo(() => sections.filter((section) => section.shouldRender), [sections])
  const sectionTabs = renderableSections.map((section) => ({
    key: section.key,
    label: collapsibleTitles[section.key]
  }))
  const sectionTourTargets: Partial<Record<SectionKey, string>> = {
    charts: 'vault-detail-section-charts',
    about: 'vault-detail-section-about',
    strategies: 'vault-detail-section-strategies',
    risk: 'vault-detail-section-risk',
    info: 'vault-detail-section-info'
  }
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

  const handleSelectSection = useCallback(
    (key: SectionKey): void => {
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
    },
    [isHeaderCompressed, sectionRefs, updateSectionScrollOffset]
  )

  useEffect(() => {
    if (!vaultTourState.isOpen || !vaultTourState.stepId) {
      return
    }
    const tourScrollMap: Partial<Record<string, SectionKey>> = {
      charts: 'charts',
      about: 'about',
      strategies: 'strategies',
      risk: 'risk'
    }
    const targetSection = tourScrollMap[vaultTourState.stepId]
    if (targetSection) {
      handleSelectSection(targetSection)
    }
  }, [vaultTourState.isOpen, vaultTourState.stepId, handleSelectSection])

  const handleFloatingButtonClick = useCallback((action: WidgetActionType): void => {
    setMobileDrawerAction(action)
    setIsMobileDrawerOpen(true)
  }, [])

  useLayoutEffect(() => {
    // Reset when switching actions so we can re-measure with tabs visible.
    void mobileDrawerAction
    if (!isMobileDrawerOpen) {
      setHideMobileDrawerTabs((prev) => (prev ? false : prev))
      return
    }
    setHideMobileDrawerTabs((prev) => (prev ? false : prev))
  }, [isMobileDrawerOpen, mobileDrawerAction])

  useLayoutEffect(() => {
    // Re-check sizing when the drawer action changes.
    void mobileDrawerAction
    if (!isMobileDrawerOpen || hideMobileDrawerTabs) return
    if (typeof window === 'undefined') return
    const panel = mobileDrawerPanelRef.current
    if (!panel) return
    const maxHeight = window.innerHeight * 0.9
    const shouldHideTabs = panel.scrollHeight > maxHeight + 1
    if (shouldHideTabs) {
      setHideMobileDrawerTabs(true)
    }
  }, [isMobileDrawerOpen, mobileDrawerAction, hideMobileDrawerTabs])

  useEffect(() => {
    if (isYvUsd) return
    if (isMobileDrawerOpen && mobileWidgetRef.current) {
      mobileWidgetRef.current.setMode(mobileDrawerAction)
    }
  }, [isMobileDrawerOpen, mobileDrawerAction, isYvUsd])

  if (isLoadingVault || !params.address) {
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
      <div className={'min-h-[calc(100vh-var(--header-height))] w-full bg-app'}>
        <div className={'mx-auto w-full max-w-[1232px] px-4 py-16'}>
          <div className={'rounded-3xl border border-border bg-surface p-6 text-center md:p-10'}>
            <h1 className={'text-xl font-black text-text-primary md:text-2xl'}>{'Vault not found'}</h1>
            <p className={'mt-3 text-sm text-text-secondary'}>
              {"We couldn't find a vault at this address on this network."}
            </p>
            <p className={'mt-2 text-xs text-text-tertiary'}>
              {`Chain: ${params.chainID || 'unknown'} • Address: ${params.address || 'unknown'}`}
            </p>
            <div className={'mt-6 flex justify-center gap-3'}>
              <Link href={'/vaults'} className={'yearn--button--nextgen'} data-variant={'filled'}>
                {'Back to Vaults'}
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  function getMobileProductTypeLabel(): string {
    if (mobileListKind === 'allocator' || mobileListKind === 'strategy') return 'Single Asset'
    if (mobileListKind === 'legacy') return 'Legacy'
    return 'LP Token'
  }
  function getWidgetModeLabel(mode: WidgetActionType): string {
    switch (mode) {
      case WidgetActionType.Deposit:
        return 'Deposit'
      case WidgetActionType.Withdraw:
        return 'Withdraw'
      default:
        return 'Migrate'
    }
  }

  const isCollapsibleMode = headerDisplayMode === 'collapsible'
  const headerStickyTop = 'var(--header-height)'
  const resolvedWidgetMode = widgetActions.includes(widgetMode) ? widgetMode : widgetActions[0]
  const shouldCollapseWidgetDetails = isCompactWidget
  const mobileListKind = deriveListKind(currentVault)
  const mobileProductTypeLabel = getMobileProductTypeLabel()
  const widgetModeLabel = getWidgetModeLabel(resolvedWidgetMode)
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
            depositedValue={vaultUserData.depositedValue}
            isCollapsibleMode={isCollapsibleMode}
            sectionTabs={sectionTabs}
            activeSectionKey={activeSection}
            onSelectSection={(key): void => handleSelectSection(key as SectionKey)}
            sectionSelectorRef={sectionSelectorRef}
            widgetActions={widgetActions}
            widgetMode={resolvedWidgetMode}
            onWidgetModeChange={setWidgetMode}
            isWidgetWalletOpen={isWidgetWalletOpen}
            onWidgetWalletOpen={openWidgetWallet}
            onWidgetCloseOverlays={closeWidgetOverlays}
            onCompressionChange={setIsHeaderCompressed}
          />
        </header>

        <div className="md:hidden md:mt-4 mb-4">
          <Breadcrumbs
            className={'mb-3'}
            items={[
              { label: 'Home', href: '/' },
              { label: 'Vaults', href: '/vaults' },
              { label: `${getVaultName(currentVault)}`, isCurrent: true }
            ]}
          />
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
              <h1 className={'text-lg font-black leading-tight truncate-safe text-text-primary'}>
                {getVaultName(currentVault)}
              </h1>
              <div className="flex items-center gap-1 mt-1">
                {currentVault.category ? (
                  <VaultsListChip
                    label={currentVault.category}
                    tooltipDescription={getCategoryDescription(currentVault.category) || undefined}
                  />
                ) : null}
                <VaultsListChip
                  label={mobileProductTypeLabel}
                  tooltipDescription={getProductTypeDescription(mobileListKind)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="md:hidden space-y-4">
          <MobileKeyMetrics
            currentVault={currentVault}
            depositedValue={vaultUserData.depositedValue}
            tokenPrice={currentVault.tvl.price || 0}
          />

          {isRetired && retiredVaultAlertMessage ? (
            <RetiredVaultAlert message={retiredVaultAlertMessage} className="px-4 py-3" />
          ) : null}

          {Number.isInteger(chainId) && (
            <div className="border border-border rounded-lg bg-surface overflow-hidden">
              {isYvUsd ? (
                <YvUsdChartsSection chartHeightPx={180} chartHeightMdPx={230} />
              ) : (
                <VaultChartsSection
                  chainId={chainId}
                  vaultAddress={currentVault.address}
                  chartHeightPx={180}
                  chartHeightMdPx={230}
                />
              )}
            </div>
          )}

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

        <section className={'grid grid-cols-1 gap-4 md:gap-6 md:grid-cols-20 md:items-start bg-app'}>
          <div
            ref={widgetContainerRef}
            className={cl(
              'hidden md:block',
              'order-1 md:order-2',
              'md:col-span-7 md:col-start-14 md:sticky pt-4',
              'flex flex-col overflow-hidden',
              isShortViewport
                ? 'md:h-[calc(100vh-0.75rem-(var(--vault-header-height)+20px))] max-h-[calc(100vh-0.75rem-(var(--vault-header-height)+20px))]'
                : 'md:h-[calc(100vh-var(--vault-header-initial-offset)-16px)] max-h-[calc(100vh-var(--vault-header-initial-offset)-16px)]'
            )}
            style={{ top: 'var(--vault-header-height, var(--header-height))' }}
          >
            <div
              ref={widgetStackRef}
              className={cl(
                'relative grid w-full min-w-0 flex-1 min-h-0 overflow-hidden',
                isShortViewport
                  ? 'max-h-[calc(100vh-16px-(var(--vault-header-height,var(--header-height))-16px))]'
                  : 'max-h-[calc(100vh-16px-var(--vault-header-initial-offset))]',
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
                    {isYvUsd ? (
                      <YvUsdWidget
                        currentVault={currentVault}
                        chainId={chainId}
                        mode={resolvedWidgetMode}
                        onModeChange={setWidgetMode}
                        showTabs={false}
                      />
                    ) : (
                      <Widget
                        ref={widgetRef}
                        vaultAddress={currentVault.address}
                        currentVault={currentVault}
                        gaugeAddress={currentVault.staking.address}
                        disableDepositStaking={shouldDisableStakingForDeposit}
                        actions={widgetActions}
                        chainId={chainId}
                        vaultUserData={vaultUserData}
                        mode={resolvedWidgetMode}
                        onModeChange={setWidgetMode}
                        showTabs={false}
                        onOpenSettings={toggleWidgetSettings}
                        isSettingsOpen={isWidgetSettingsOpen}
                        depositPrefill={depositPrefill}
                        onDepositPrefillConsumed={() => setDepositPrefill(null)}
                        collapseDetails={shouldCollapseWidgetDetails}
                      />
                    )}
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
                  vaultUserData={vaultUserData}
                  onSelectZapToken={handleZapTokenSelect}
                />
              </div>
              {shouldShowWidgetRewards ? (
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
              ) : null}
            </div>
          </div>

          <div className={'hidden md:block space-y-4 md:col-span-13 order-2 md:order-1 py-4'}>
            {isRetired && retiredVaultAlertMessage ? (
              <RetiredVaultAlert message={retiredVaultAlertMessage} className="px-6 py-4" />
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
                    data-tour={sectionTourTargets[section.key as SectionKey]}
                    className={'border border-border rounded-lg bg-surface'}
                    style={{ scrollMarginTop: `${sectionScrollOffset}px` }}
                  >
                    <button
                      type={'button'}
                      className={'flex w-full items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4'}
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
                  data-tour={sectionTourTargets[section.key as SectionKey]}
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

      {/* Mobile Floating Action Buttons - visible until desktop widget appears (md:), hidden when drawer is open */}
      {!isMobileDrawerOpen && (
        <div
          className={cl(
            'fixed bottom-0 left-0 right-0 z-50 px-4 pt-4 md:hidden',
            'backdrop-blur-md',
            'pb-[calc(1rem+env(safe-area-inset-bottom,0px))]'
          )}
        >
          <div className="flex gap-3 max-w-[1232px] mx-auto">
            <button
              type="button"
              onClick={() => handleFloatingButtonClick(widgetActions[0])}
              className="yearn--button--nextgen flex-1"
              data-variant="filled"
            >
              {widgetActions[0] === WidgetActionType.Migrate ? 'Migrate' : 'Deposit'}
            </button>
            <button
              type="button"
              onClick={() => handleFloatingButtonClick(widgetActions[1])}
              className="yearn--button flex-1"
              data-variant="light"
            >
              Withdraw
            </button>
          </div>
        </div>
      )}

      <BottomDrawer
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
        title={currentVault.name}
        headerActions={isYvUsd ? undefined : <MobileDrawerSettingsButton />}
        panelRef={mobileDrawerPanelRef}
      >
        {isYvUsd ? (
          <YvUsdWidget currentVault={currentVault} chainId={chainId} mode={mobileDrawerAction} showTabs={false} />
        ) : (
          <Widget
            ref={mobileWidgetRef}
            vaultAddress={currentVault.address}
            currentVault={currentVault}
            gaugeAddress={currentVault.staking.address}
            disableDepositStaking={shouldDisableStakingForDeposit}
            actions={widgetActions}
            chainId={chainId}
            vaultUserData={vaultUserData}
            mode={mobileDrawerAction}
            onModeChange={setMobileDrawerAction}
            onOpenSettings={toggleWidgetSettings}
            isSettingsOpen={isWidgetSettingsOpen}
            hideTabSelector={hideMobileDrawerTabs}
            disableBorderRadius
          />
        )}
      </BottomDrawer>
      <VaultDetailsWelcomeTour onTourStateChange={setVaultTourState} />
    </div>
  )
}

export default Index
