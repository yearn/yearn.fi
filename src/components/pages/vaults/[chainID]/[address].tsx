import Link from '@components/Link'
import { useScrollSpy } from '@hooks/useScrollSpy'
import { BottomDrawer } from '@pages/vaults/components/detail/BottomDrawer'
import {
  DESKTOP_WIDGET_BOTTOM_PADDING_PX,
  DESKTOP_WIDGET_OFFSET_CSS_VAR,
  getDesktopWidgetHeightClassNames,
  resolveDesktopWidgetHeaderOffset
} from '@pages/vaults/components/detail/desktopWidgetSizing'
import { MobileKeyMetrics, YvUsdApyStatBox } from '@pages/vaults/components/detail/QuickStatsGrid'
import { VaultAboutSection } from '@pages/vaults/components/detail/VaultAboutSection'
import { VaultChartsSection } from '@pages/vaults/components/detail/VaultChartsSection'
import { VaultDetailsHeader, VaultDetailsHeaderPresentation } from '@pages/vaults/components/detail/VaultDetailsHeader'
import { VaultInfoSection } from '@pages/vaults/components/detail/VaultInfoSection'
import { VaultRecentReallocationsSection } from '@pages/vaults/components/detail/VaultRecentReallocationsSection'
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
import { YvUsdHeaderBanner } from '@pages/vaults/components/yvUSD/YvUsdHeaderBanner'
import {
  getVaultChainID,
  getVaultView,
  type TKongVault,
  type TKongVaultView
} from '@pages/vaults/domain/kongVaultSelectors'
import {
  mergeYBoldSnapshot,
  mergeYBoldVault,
  YBOLD_STAKING_ADDRESS,
  YBOLD_VAULT_ADDRESS
} from '@pages/vaults/domain/normalizeVault'
import { isNonYearnErc4626Vault, NON_YEARN_ERC4626_WARNING_MESSAGE } from '@pages/vaults/domain/vaultWarnings'
import { useEnsureVaultListFetch } from '@pages/vaults/hooks/useEnsureVaultListFetch'
import { useVaultRecentReallocations } from '@pages/vaults/hooks/useVaultRecentReallocations'
import { useVaultSnapshot } from '@pages/vaults/hooks/useVaultSnapshot'
import { useVaultUserData } from '@pages/vaults/hooks/useVaultUserData'
import { useYvUsdVaults } from '@pages/vaults/hooks/useYvUsdVaults'
import { WidgetActionType } from '@pages/vaults/types'
import {
  getYvUsdSharePrice,
  isYvUsdAddress,
  type TYvUsdVariant,
  YVUSD_CHAIN_ID,
  YVUSD_LOCKED_ADDRESS,
  YVUSD_UNLOCKED_ADDRESS
} from '@pages/vaults/utils/yvUsd'
import { Breadcrumbs } from '@shared/components/Breadcrumbs'
import { TokenLogo } from '@shared/components/TokenLogo'
import { useWallet } from '@shared/contexts/useWallet'
import { useYearn } from '@shared/contexts/useYearn'
import { IconChevron } from '@shared/icons/IconChevron'
import { cl, isZeroAddress, toAddress, toNormalizedBN } from '@shared/utils'
import { getVaultName } from '@shared/utils/helpers'
import type { TKongVaultSnapshot } from '@shared/utils/schemas/kongVaultSnapshotSchema'
import type { ReactElement } from 'react'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { isAddressEqual } from 'viem'
import { VaultsListChip } from '@/components/pages/vaults/components/list/VaultsListChip'
import { deriveListKind } from '@/components/pages/vaults/utils/vaultListFacets'
import { getVaultPrimaryLogoSrc } from '@/components/pages/vaults/utils/vaultLogo'
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

const desktopWidgetHeightClassNames = getDesktopWidgetHeightClassNames()

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

const isSnapshotLikelyV3Vault = (snapshot: TKongVaultSnapshot): boolean => {
  const apiVersion = snapshot.apiVersion ?? ''
  if (apiVersion.startsWith('3') || apiVersion.startsWith('~3')) {
    return true
  }

  const normalizedKind = snapshot.meta?.kind?.toLowerCase() ?? ''
  if (normalizedKind === 'single strategy' || normalizedKind === 'multi strategy') {
    return true
  }

  return (snapshot.composition?.length ?? 0) > 0 || (snapshot.strategies?.length ?? 0) > 0
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
    v3: isSnapshotLikelyV3Vault(snapshot),
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
          available: snapshot.staking.available,
          source: snapshot.staking.source ?? '',
          rewards: (snapshot.staking.rewards ?? []).map((reward) => ({
            ...reward,
            decimals: reward.decimals ?? 18,
            isFinished: reward.isFinished ?? false
          }))
        }
      : null
  }
}

function VaultWarningAlert({ message, className }: { message: string; className: string }): ReactElement {
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

function YvUsdMobileKeyMetrics({
  currentVault,
  apyVariant,
  onApyVariantChange
}: {
  currentVault: TKongVaultView
  apyVariant: TYvUsdVariant
  onApyVariantChange: (variant: TYvUsdVariant) => void
}): ReactElement {
  const { address } = useWeb3()
  const { getPrice } = useYearn()
  const { metrics, unlockedVault, lockedVault } = useYvUsdVaults()
  const account = address ? toAddress(address) : undefined
  const unlockedAssetAddress = toAddress(unlockedVault?.token.address ?? YVUSD_UNLOCKED_ADDRESS)

  const unlockedUserData = useVaultUserData({
    vaultAddress: toAddress(unlockedVault?.address ?? YVUSD_UNLOCKED_ADDRESS),
    assetAddress: unlockedAssetAddress,
    chainId: YVUSD_CHAIN_ID,
    account
  })
  const lockedUserData = useVaultUserData({
    vaultAddress: toAddress(lockedVault?.address ?? YVUSD_LOCKED_ADDRESS),
    assetAddress: YVUSD_UNLOCKED_ADDRESS,
    chainId: YVUSD_CHAIN_ID,
    account
  })

  const unlockedNormalized = toNormalizedBN(
    unlockedUserData.depositedValue,
    unlockedUserData.assetToken?.decimals ?? 6
  ).normalized
  const lockedNormalized = toNormalizedBN(
    lockedUserData.depositedValue,
    lockedUserData.assetToken?.decimals ?? 18
  ).normalized
  const unlockedAssetPrice =
    getPrice({ address: unlockedAssetAddress, chainID: YVUSD_CHAIN_ID }).normalized || unlockedVault?.tvl.price || 0
  const unlockedSharePrice = getYvUsdSharePrice(unlockedVault, unlockedAssetPrice)
  const depositedUsdValue = unlockedNormalized * unlockedAssetPrice + lockedNormalized * unlockedSharePrice
  const unlockedApy = metrics?.unlocked.apy ?? currentVault.apr.forwardAPR.netAPR ?? currentVault.apr.netAPR ?? 0
  const lockedApy = metrics?.locked.apy ?? lockedVault?.apr.forwardAPR.netAPR ?? lockedVault?.apr.netAPR ?? 0

  return (
    <MobileKeyMetrics
      currentVault={currentVault}
      depositedValue={unlockedUserData.depositedValue}
      depositedUsdValue={depositedUsdValue}
      tokenPrice={currentVault.tvl.price || 0}
      apyBox={
        <YvUsdApyStatBox
          lockedApy={lockedApy}
          unlockedApy={unlockedApy}
          activeVariant={apyVariant}
          onVariantChange={onApyVariantChange}
          lockedHasInfinifiPoints={Boolean(metrics?.locked.hasInfinifiPoints)}
          unlockedHasInfinifiPoints={Boolean(metrics?.unlocked.hasInfinifiPoints)}
        />
      }
    />
  )
}

function Index(): ReactElement | null {
  type SectionKey = 'charts' | 'about' | 'risk' | 'strategies' | 'reallocations' | 'info'
  const { headerDisplayMode } = useDevFlags()
  const mobileDetailsSectionId = useId()

  const params = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const chainId = Number(params.chainID)
  const { getBalance, onRefresh } = useWallet()
  const { address } = useWeb3()
  const { vaults, allVaults, isLoadingVaultList, enableVaultListFetch } = useYearn()
  const {
    listVault: yvUsdVault,
    unlockedVault: yvUsdUnlockedVault,
    lockedVault: yvUsdLockedVault,
    isLoading: isLoadingYvUsd
  } = useYvUsdVaults()
  const isYvUsd = isYvUsdAddress(params.address)
  const isLockedYvUsdRoute =
    chainId === YVUSD_CHAIN_ID && params.address ? toAddress(params.address) === YVUSD_LOCKED_ADDRESS : false
  const unlockedYvUsdPath = `/vaults/${YVUSD_CHAIN_ID}/${YVUSD_UNLOCKED_ADDRESS}${location.search}${location.hash}`
  const vaultKey = `${params.chainID}-${params.address}`
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false)
  const [mobileDrawerAction, setMobileDrawerAction] = useState<WidgetActionType>(WidgetActionType.Deposit)
  const [hideMobileDrawerTabs, setHideMobileDrawerTabs] = useState(false)
  const mobileWidgetRef = useRef<TWidgetRef>(null)
  const mobileDrawerPanelRef = useRef<HTMLDivElement>(null)
  const detailsRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement | null>(null)
  const compressedHeaderMeasureRef = useRef<HTMLDivElement>(null)
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
  const reallocationsRef = useRef<HTMLDivElement>(null)
  const infoRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useMemo(
    () => ({
      charts: chartsRef,
      about: aboutRef,
      risk: riskRef,
      strategies: strategiesRef,
      reallocations: reallocationsRef,
      info: infoRef
    }),
    []
  )
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    about: true,
    risk: true,
    strategies: true,
    reallocations: true,
    info: true,
    charts: true
  })
  const collapsibleTitles: Record<SectionKey, string> = {
    about: 'Vault Info',
    risk: 'Risk',
    strategies: 'Strategies',
    reallocations: 'Recent Reallocations',
    info: 'More Info',
    charts: 'Performance'
  }
  const [activeSection, setActiveSection] = useState<SectionKey>('charts')
  const [sectionScrollOffset, setSectionScrollOffset] = useState(0)
  const [isHeaderCompressed, setIsHeaderCompressed] = useState(false)
  const [yvUsdApyVariant, setYvUsdApyVariant] = useState<TYvUsdVariant>('locked')
  const isCollapsibleMode = headerDisplayMode === 'collapsible'
  const scrollPadding = 16
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

  useEffect(() => {
    if (!isLockedYvUsdRoute) {
      return
    }
    navigate(unlockedYvUsdPath, { replace: true })
  }, [isLockedYvUsdRoute, navigate, unlockedYvUsdPath])

  const baseVault = useMemo(() => {
    if (!params.address) return undefined
    const resolvedAddress = toAddress(params.address)
    return vaults[resolvedAddress]
  }, [params.address, vaults])

  const metadataVault = useMemo(() => {
    if (!params.address) return undefined
    return allVaults[toAddress(params.address)]
  }, [allVaults, params.address])

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
    return getVaultChainID(mergedBaseVault) === getVaultChainID(snapshotBackedVault)
      ? mergedBaseVault
      : snapshotBackedVault
  }, [mergedBaseVault, snapshotBackedVault])

  const isFactoryVault = useMemo(() => {
    if (!vaultViewInput) return false
    return deriveListKind(vaultViewInput) === 'factory'
  }, [vaultViewInput])

  const snapshotShouldDisableStaking = mergedSnapshot?.meta?.shouldDisableStaking
  const hasTriggeredVaultListFetch = useEnsureVaultListFetch({
    hasVaultList,
    isYvUsd,
    snapshotVault,
    enableVaultListFetch
  })
  const shouldDisableStakingForDeposit = useMemo(() => {
    if (isFactoryVault) {
      return true
    }
    return snapshotShouldDisableStaking === true
  }, [snapshotShouldDisableStaking, isFactoryVault])

  const currentVault = useMemo(() => {
    if (isYvUsd) {
      return yvUsdVault ?? yvUsdUnlockedVault ?? yvUsdLockedVault
    }
    if (!vaultViewInput) return undefined
    return getVaultView(vaultViewInput, mergedSnapshot)
  }, [isYvUsd, yvUsdVault, yvUsdUnlockedVault, yvUsdLockedVault, vaultViewInput, mergedSnapshot])
  const {
    panels: recentReallocationPanels,
    isLoading: isLoadingRecentReallocations,
    hasUnexpectedError: hasRecentReallocationsError
  } = useVaultRecentReallocations({
    currentVault
  })
  const isV3Vault = Boolean(currentVault?.version?.startsWith('3') || currentVault?.version?.startsWith('~3'))
  const shouldShowRecentReallocationsSection =
    isV3Vault && (recentReallocationPanels.length > 0 || isLoadingRecentReallocations || hasRecentReallocationsError)

  const shouldBootstrapYvUsdVaultList = isYvUsd && !hasVaultList && !hasTriggeredVaultListFetch
  const isLoadingVault = isYvUsd
    ? isLoadingYvUsd || shouldBootstrapYvUsdVaultList
    : !currentVault && (isLoadingSnapshotVault || (isLoadingVaultList && !isSnapshotNotFound))
  const stakingAddress = !isZeroAddress(currentVault?.staking?.address)
    ? toAddress(currentVault?.staking?.address)
    : undefined
  const disableDepositStaking = shouldDisableStakingForDeposit || !currentVault?.staking?.available

  const vaultUserData = useVaultUserData({
    vaultAddress: toAddress(currentVault?.address ?? '0x'),
    assetAddress: toAddress(currentVault?.token?.address ?? '0x'),
    stakingAddress,
    stakingSource: currentVault?.staking?.source,
    chainId,
    account: address
  })

  const vaultShareBalance =
    !!address && currentVault?.address && Number.isInteger(currentVault?.chainID)
      ? getBalance({ address: toAddress(currentVault.address), chainID: currentVault.chainID }).raw
      : 0n

  const stakingShareBalance =
    !!address && !!stakingAddress && Number.isInteger(currentVault?.chainID) && !!currentVault
      ? getBalance({ address: stakingAddress, chainID: currentVault.chainID }).raw
      : 0n

  const isMigratable = Boolean(currentVault?.migration?.available)
  const canShowMigrateAction = isMigratable && vaultShareBalance > 0n
  const isRetired = Boolean(currentVault?.info?.isRetired)
  const hasUserFundsInVault = vaultShareBalance > 0n || stakingShareBalance > 0n
  const retiredVaultAlertMessage = useMemo(() => {
    if (!isRetired || !currentVault) return null
    return getRetiredVaultAlertMessage({ vault: currentVault, hasUserFundsInVault })
  }, [currentVault, hasUserFundsInVault, isRetired])
  const shouldShowNonYearnVaultAlert = useMemo(() => {
    return isNonYearnErc4626Vault({
      vault: metadataVault,
      snapshot: mergedSnapshot
    })
  }, [metadataVault, mergedSnapshot])
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

  // Render-time state adjustment: keep mode valid when available actions change
  if (!widgetActions.includes(widgetMode)) {
    setWidgetMode(widgetActions[0])
  }
  if (!widgetActions.includes(mobileDrawerAction)) {
    setMobileDrawerAction(widgetActions[0])
  }

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
        key: 'reallocations' as const,
        shouldRender: shouldShowRecentReallocationsSection,
        ref: sectionRefs.reallocations,
        content: (
          <VaultRecentReallocationsSection
            panels={recentReallocationPanels}
            isLoading={isLoadingRecentReallocations}
            hasError={hasRecentReallocationsError}
          />
        )
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
  }, [
    chainId,
    currentVault,
    hasRecentReallocationsError,
    isLoadingRecentReallocations,
    isYvUsd,
    recentReallocationPanels,
    sectionRefs,
    shouldShowRecentReallocationsSection,
    snapshotVault?.inceptTime
  ])

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

  // Render-time state adjustment: ensure active section is valid
  if (!renderableSections.some((section) => section.key === activeSection) && renderableSections[0]) {
    setActiveSection(renderableSections[0].key)
  }

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

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return

    const measuredElement = isCollapsibleMode ? compressedHeaderMeasureRef.current : headerRef.current
    const fallbackElement = headerRef.current
    let frame = 0

    const updateCompressedOffset = (): void => {
      const baseOffset = resolveHeaderOffset()
      const primaryHeight = measuredElement?.getBoundingClientRect().height ?? 0
      const fallbackHeight = fallbackElement?.getBoundingClientRect().height ?? 0
      const nextOffset = resolveDesktopWidgetHeaderOffset({
        baseOffset,
        headerHeight: primaryHeight > 0 ? primaryHeight : fallbackHeight,
        bottomPadding: DESKTOP_WIDGET_BOTTOM_PADDING_PX
      })

      if (nextOffset === null) {
        return
      }

      document.documentElement.style.setProperty(DESKTOP_WIDGET_OFFSET_CSS_VAR, `${nextOffset}px`)
    }

    const scheduleUpdate = (): void => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(updateCompressedOffset)
    }

    updateCompressedOffset()
    window.addEventListener('resize', scheduleUpdate)

    if (typeof ResizeObserver === 'undefined') {
      return (): void => {
        if (frame) cancelAnimationFrame(frame)
        window.removeEventListener('resize', scheduleUpdate)
      }
    }

    const observer = new ResizeObserver(scheduleUpdate)
    if (measuredElement) {
      observer.observe(measuredElement)
    }
    if (fallbackElement && fallbackElement !== measuredElement) {
      observer.observe(fallbackElement)
    }

    return (): void => {
      if (frame) cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [currentVault?.address, isCollapsibleMode, vaultKey])

  useEffect(() => {
    return (): void => {
      if (typeof window === 'undefined') return
      document.documentElement.style.removeProperty(DESKTOP_WIDGET_OFFSET_CSS_VAR)
    }
  }, [])

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

  if (isLockedYvUsdRoute || isLoadingVault || !params.address) {
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

  const resolvedCurrentVault = currentVault

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

  const headerStickyTop = 'var(--header-height)'
  const resolvedWidgetMode = widgetActions.includes(widgetMode) ? widgetMode : widgetActions[0]
  const shouldCollapseWidgetDetails = isCompactWidget
  const mobileListKind = deriveListKind(resolvedCurrentVault)
  const mobileProductTypeLabel = getMobileProductTypeLabel()
  const widgetModeLabel = getWidgetModeLabel(resolvedWidgetMode)
  const collapsedWidgetTitle = isWidgetWalletOpen ? 'My Info' : widgetModeLabel

  function renderDetailCharts(chartHeightPx: number, chartHeightMdPx: number): ReactElement {
    if (isYvUsd) {
      return <YvUsdChartsSection chartHeightPx={chartHeightPx} chartHeightMdPx={chartHeightMdPx} />
    }

    return (
      <VaultChartsSection
        chainId={chainId}
        vaultAddress={resolvedCurrentVault.address}
        chartHeightPx={chartHeightPx}
        chartHeightMdPx={chartHeightMdPx}
      />
    )
  }

  function renderDesktopWidget(): ReactElement {
    if (isYvUsd) {
      return (
        <YvUsdWidget
          currentVault={resolvedCurrentVault}
          chainId={chainId}
          mode={resolvedWidgetMode}
          onModeChange={setWidgetMode}
          onOpenSettings={toggleWidgetSettings}
          isSettingsOpen={isWidgetSettingsOpen}
          onDepositVariantChange={setYvUsdApyVariant}
          showTabs={false}
          collapseDetails={shouldCollapseWidgetDetails}
        />
      )
    }

    return (
      <Widget
        ref={widgetRef}
        vaultAddress={resolvedCurrentVault.address}
        currentVault={resolvedCurrentVault}
        gaugeAddress={resolvedCurrentVault.staking.address}
        disableDepositStaking={disableDepositStaking}
        actions={widgetActions}
        chainId={chainId}
        vaultUserData={vaultUserData}
        mode={resolvedWidgetMode}
        onModeChange={setWidgetMode}
        showTabs={false}
        onOpenSettings={toggleWidgetSettings}
        isSettingsOpen={isWidgetSettingsOpen}
        collapseDetails={shouldCollapseWidgetDetails}
      />
    )
  }

  function renderMobileWidget(): ReactElement {
    if (isYvUsd) {
      return (
        <YvUsdWidget
          currentVault={resolvedCurrentVault}
          chainId={chainId}
          mode={mobileDrawerAction}
          onOpenSettings={toggleWidgetSettings}
          isSettingsOpen={isWidgetSettingsOpen}
          onDepositVariantChange={setYvUsdApyVariant}
          showTabs={false}
        />
      )
    }

    return (
      <Widget
        ref={mobileWidgetRef}
        vaultAddress={resolvedCurrentVault.address}
        currentVault={resolvedCurrentVault}
        gaugeAddress={resolvedCurrentVault.staking.address}
        disableDepositStaking={disableDepositStaking}
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
    )
  }

  return (
    <div
      className={
        'min-h-[calc(100vh-var(--header-height))] w-full bg-app pb-[calc(7rem+env(safe-area-inset-bottom,0px))] sm:pb-8'
      }
    >
      <div className={'mx-auto w-full max-w-[1232px] px-4'}>
        {isCollapsibleMode ? (
          <div
            aria-hidden="true"
            className={'pointer-events-none invisible fixed inset-x-0 top-0 -z-10 hidden md:block'}
            inert={true}
            tabIndex={-1}
          >
            <div className={'mx-auto w-full max-w-[1232px] px-4'}>
              <div ref={compressedHeaderMeasureRef}>
                <VaultDetailsHeaderPresentation
                  currentVault={currentVault}
                  depositedValue={vaultUserData.depositedValue}
                  yvUsdApyVariant={yvUsdApyVariant}
                  isCompressed={true}
                  sectionTabs={sectionTabs}
                  activeSectionKey={activeSection}
                  onSelectSection={(): void => undefined}
                  widgetActions={widgetActions}
                  widgetMode={resolvedWidgetMode}
                  onWidgetModeChange={(): void => undefined}
                  onYvUsdApyVariantChange={(): void => undefined}
                  isWidgetWalletOpen={isWidgetWalletOpen}
                  onWidgetWalletOpen={(): void => undefined}
                  onWidgetCloseOverlays={(): void => undefined}
                  includeTourAttributes={false}
                />
              </div>
            </div>
          </div>
        ) : null}

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
            yvUsdApyVariant={yvUsdApyVariant}
            isCollapsibleMode={isCollapsibleMode}
            sectionTabs={sectionTabs}
            activeSectionKey={activeSection}
            onSelectSection={(key): void => handleSelectSection(key as SectionKey)}
            sectionSelectorRef={sectionSelectorRef}
            widgetActions={widgetActions}
            widgetMode={resolvedWidgetMode}
            onWidgetModeChange={setWidgetMode}
            onYvUsdApyVariantChange={setYvUsdApyVariant}
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
          {isYvUsd ? <YvUsdHeaderBanner className={'mb-3 md:min-h-26'} /> : null}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-full bg-surface/70">
              <TokenLogo
                src={getVaultPrimaryLogoSrc(currentVault)}
                tokenSymbol={currentVault.token.symbol || ''}
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
          {isYvUsd ? (
            <YvUsdMobileKeyMetrics
              currentVault={currentVault}
              apyVariant={yvUsdApyVariant}
              onApyVariantChange={setYvUsdApyVariant}
            />
          ) : (
            <MobileKeyMetrics
              currentVault={currentVault}
              depositedValue={vaultUserData.depositedValue}
              tokenPrice={currentVault.tvl.price || 0}
            />
          )}

          {isRetired && retiredVaultAlertMessage ? (
            <VaultWarningAlert message={retiredVaultAlertMessage} className="px-4 py-3" />
          ) : null}

          {shouldShowNonYearnVaultAlert ? (
            <VaultWarningAlert message={NON_YEARN_ERC4626_WARNING_MESSAGE} className="px-4 py-3" />
          ) : null}

          {Number.isInteger(chainId) && (
            <div className="border border-border rounded-lg bg-surface overflow-hidden">
              {renderDetailCharts(180, 230)}
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
              desktopWidgetHeightClassNames.container
            )}
            style={{ top: 'var(--vault-header-height, var(--header-height))' }}
          >
            <div
              ref={widgetStackRef}
              className={cl(
                'relative grid w-full min-w-0 flex-1 min-h-0 overflow-hidden',
                desktopWidgetHeightClassNames.stack,
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
                    {renderDesktopWidget()}
                  </div>
                )}
                <WalletPanel
                  isActive={isWidgetWalletOpen && !isWidgetRewardsOpen}
                  currentVault={currentVault}
                  vaultAddress={toAddress(currentVault.address)}
                  stakingAddress={stakingAddress}
                  chainId={chainId}
                  vaultUserData={vaultUserData}
                />
              </div>
              {shouldShowWidgetRewards ? (
                <div ref={widgetRewardsRef} className={cl('w-full min-w-0', isWidgetRewardsOpen ? 'flex min-h-0' : '')}>
                  <WidgetRewards
                    stakingAddress={stakingAddress}
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
              <VaultWarningAlert message={retiredVaultAlertMessage} className="px-6 py-4" />
            ) : null}

            {shouldShowNonYearnVaultAlert ? (
              <VaultWarningAlert message={NON_YEARN_ERC4626_WARNING_MESSAGE} className="px-6 py-4" />
            ) : null}

            {renderableSections.map((section) => {
              const isCollapsible =
                section.key === 'about' ||
                section.key === 'risk' ||
                section.key === 'strategies' ||
                section.key === 'reallocations' ||
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
        {renderMobileWidget()}
      </BottomDrawer>
      <VaultDetailsWelcomeTour onTourStateChange={setVaultTourState} />
    </div>
  )
}

export default Index
