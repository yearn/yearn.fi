'use client'

import { usePlausible } from '@hooks/usePlausible'
import { PLAUSIBLE_EVENTS, type TPlausibleEventName } from '@shared/utils/plausible'
import { getNetwork } from '@shared/utils/wagmi/utils'
import {
  createYBoldPreset,
  createYvBtcFamilyPreset,
  createYvUsdFamilyPreset,
  VaultFamilyWidget,
  VaultWidget,
  type VaultWidgetConfig,
  type VaultWidgetEvent,
  type VaultWidgetMode,
  VaultWidgetProvider
} from '@yearn/vault-widget'
import {
  createEnsoVaultConfigResolver,
  createYearnFiActivityStore,
  createYearnFiSettingsStore
} from '@yearn/vault-widget/services'
import { useRouter } from 'next/navigation'
import { type ReactElement, type ReactNode, useMemo } from 'react'
import type { Address, Hash } from 'viem'

const yearnFiActivityStore = createYearnFiActivityStore()
const yearnFiConfigResolver = createEnsoVaultConfigResolver()
const yearnFiSettingsStore = createYearnFiSettingsStore()

export type PackagedVaultKind = 'generic' | 'ybold' | 'yvbtc' | 'yvusd'

export function applyPackagedVaultDisplay(
  config: VaultWidgetConfig,
  overrides: {
    assetPriceUsd?: number
    estimatedApr?: number
  }
): VaultWidgetConfig {
  return {
    ...config,
    display: {
      ...config.display,
      assetPriceUsd: overrides.assetPriceUsd ?? config.display?.assetPriceUsd,
      estimatedApr: overrides.estimatedApr ?? config.display?.estimatedApr
    }
  }
}

type PackagedVaultAnalyticsEvent = {
  name: TPlausibleEventName
  props: Record<string, string>
}

export function resolvePackagedVaultAnalyticsEvent(
  event: VaultWidgetEvent,
  chainId: number,
  vaultAddress: Address
): PackagedVaultAnalyticsEvent | undefined {
  if (event.type !== 'transaction_succeeded') return undefined

  const { plan } = event
  const commonProps = {
    chainID: String(chainId),
    vaultAddress,
    adapterId: plan.quote.adapterId,
    amountInRaw: plan.quote.amountIn.toString(),
    expectedOutRaw: plan.quote.expectedOut.toString(),
    action: plan.mode
  }

  if (plan.mode === 'deposit') {
    return {
      name: PLAUSIBLE_EVENTS.DEPOSIT,
      props: {
        ...commonProps,
        isZap: String(plan.quote.adapterId === 'enso')
      }
    }
  }
  if (plan.mode === 'withdraw') {
    return {
      name: PLAUSIBLE_EVENTS.WITHDRAW,
      props: {
        ...commonProps,
        isZap: String(plan.quote.adapterId === 'enso')
      }
    }
  }
  if (plan.mode === 'migrate') {
    return {
      name: PLAUSIBLE_EVENTS.MIGRATE,
      props: {
        ...commonProps,
        fromVault: vaultAddress
      }
    }
  }
  return {
    name: PLAUSIBLE_EVENTS.CLAIM,
    props: {
      ...commonProps,
      source: 'vault'
    }
  }
}

function TransactionLink({
  chainId,
  children,
  hash
}: {
  chainId: number
  children: ReactNode
  hash: Hash
}): ReactElement {
  const explorer = getNetwork(chainId).defaultBlockExplorer
  return explorer ? (
    <a href={`${explorer}/tx/${hash}`} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    <span>{children}</span>
  )
}

export function resolvePackagedVaultMode(
  mode: 'deposit' | 'migrate' | 'withdraw',
  showInfo: boolean,
  showRewards: boolean
): VaultWidgetMode {
  if (showRewards) return 'rewards'
  if (showInfo) return 'info'
  return mode
}

type PackagedVaultWidgetProps = {
  assetPriceUsd?: number
  chainId: number
  estimatedApr?: number
  estimatedAprByVariant?: Partial<Record<'locked' | 'unlocked', number>>
  kind?: PackagedVaultKind
  mode: VaultWidgetMode
  onClose?: () => void
  onConnectWallet: () => void
  onModeChange: (mode: VaultWidgetMode) => void
  onSettingsOpenChange?: (open: boolean) => void
  onSuccess?: (event: Extract<VaultWidgetEvent, { type: 'transaction_succeeded' }>) => void
  onVariantChange?: (variant: string) => void
  settingsOpen?: boolean
  variant?: string
  vaultAddress: Address
  viewport: 'desktop' | 'mobile'
}

export function PackagedVaultWidget({
  assetPriceUsd,
  chainId,
  estimatedApr,
  estimatedAprByVariant,
  kind = 'generic',
  mode,
  onClose,
  onConnectWallet,
  onModeChange,
  onSettingsOpenChange,
  onSuccess,
  onVariantChange,
  settingsOpen,
  variant,
  vaultAddress,
  viewport
}: PackagedVaultWidgetProps): ReactElement {
  const router = useRouter()
  const trackEvent = usePlausible()
  const yBoldConfig = useMemo(() => {
    if (kind !== 'ybold') return undefined
    const config = createYBoldPreset({ ensoEndpoint: '/api/enso/route' })
    return {
      ...config,
      display: {
        ...config.display,
        assetPriceUsd,
        estimatedApr
      }
    }
  }, [assetPriceUsd, estimatedApr, kind])
  const yearnFiServices = useMemo(
    () => ({
      activityStore: yearnFiActivityStore,
      configResolver: {
        async resolve(
          resolverChainId: number,
          resolverVaultAddress: Address,
          signal?: AbortSignal
        ): Promise<VaultWidgetConfig> {
          const config = await yearnFiConfigResolver.resolve(resolverChainId, resolverVaultAddress, signal)
          return applyPackagedVaultDisplay(config, { assetPriceUsd, estimatedApr })
        }
      },
      settings: yearnFiSettingsStore
    }),
    [assetPriceUsd, estimatedApr]
  )
  const family = useMemo(() => {
    if (kind === 'yvusd') {
      return createYvUsdFamilyPreset({ assetPriceUsd, estimatedApr, estimatedAprByVariant })
    }
    if (kind === 'yvbtc') {
      return createYvBtcFamilyPreset({
        assetPriceUsd,
        estimatedApr: estimatedAprByVariant?.unlocked ?? estimatedApr
      })
    }
    return undefined
  }, [assetPriceUsd, estimatedApr, estimatedAprByVariant, kind])
  const selectedFamilyConfig =
    family?.variants.find(({ id }) => id === (variant ?? family.defaultVariant))?.config ??
    family?.variants.find(({ id }) => id === family.defaultVariant)?.config
  const handleEvent = (event: VaultWidgetEvent): void => {
    const analyticsEvent = resolvePackagedVaultAnalyticsEvent(
      event,
      selectedFamilyConfig?.chainId ?? chainId,
      selectedFamilyConfig?.vaultAddress ?? vaultAddress
    )
    if (analyticsEvent) trackEvent(analyticsEvent.name, { props: analyticsEvent.props })
  }
  const sharedProps = {
    mode,
    onClose,
    onConnectWallet,
    onModeChange,
    onSettingsOpenChange,
    onEvent: handleEvent,
    onSuccess,
    onViewAllActivity: (): void => router.push('/portfolio?tab=activity'),
    settingsOpen,
    slots: { TransactionLink },
    switcher: viewport === 'desktop' ? 'external' : 'built-in',
    viewport
  } as const

  return (
    <VaultWidgetProvider services={yearnFiServices}>
      {family ? (
        <VaultFamilyWidget {...sharedProps} family={family} variant={variant} onVariantChange={onVariantChange} />
      ) : (
        <VaultWidget
          {...sharedProps}
          chainId={chainId}
          config={yBoldConfig}
          vaultAddress={yBoldConfig?.vaultAddress ?? vaultAddress}
        />
      )}
    </VaultWidgetProvider>
  )
}
