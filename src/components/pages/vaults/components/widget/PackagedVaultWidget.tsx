'use client'

import { WidgetActionType } from '@pages/vaults/types'
import { getNetwork } from '@shared/utils/wagmi/utils'
import {
  createYBoldPreset,
  createYvBtcFamilyPreset,
  createYvUsdFamilyPreset,
  VaultFamilyWidget,
  VaultWidget,
  type VaultWidgetEvent,
  type VaultWidgetMode,
  VaultWidgetProvider
} from '@yearn/vault-widget'
import { createYearnFiActivityStore, createYearnFiSettingsStore } from '@yearn/vault-widget/services'
import { useRouter } from 'next/navigation'
import { type ReactElement, type ReactNode, useMemo } from 'react'
import type { Address, Hash } from 'viem'

const yearnFiServices = {
  activityStore: createYearnFiActivityStore(),
  settings: createYearnFiSettingsStore()
}

export type PackagedVaultKind = 'generic' | 'ybold' | 'yvbtc' | 'yvusd'

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
  mode: WidgetActionType,
  showInfo: boolean,
  showRewards: boolean
): VaultWidgetMode {
  if (showRewards) return 'rewards'
  if (showInfo) return 'info'
  if (mode === WidgetActionType.Migrate) return 'migrate'
  return mode === WidgetActionType.Withdraw ? 'withdraw' : 'deposit'
}

type PackagedVaultWidgetProps = {
  assetPriceUsd?: number
  chainId: number
  estimatedApr?: number
  kind?: PackagedVaultKind
  mode: WidgetActionType
  onConnectWallet: () => void
  onModeChange: (mode: WidgetActionType) => void
  onSettingsOpenChange?: (open: boolean) => void
  onSuccess?: (event: Extract<VaultWidgetEvent, { type: 'transaction_succeeded' }>) => void
  onVariantChange?: (variant: string) => void
  settingsOpen?: boolean
  showInfo?: boolean
  showRewards?: boolean
  variant?: string
  vaultAddress: Address
  viewport: 'desktop' | 'mobile'
}

export function PackagedVaultWidget({
  assetPriceUsd,
  chainId,
  estimatedApr,
  kind = 'generic',
  mode,
  onConnectWallet,
  onModeChange,
  onSettingsOpenChange,
  onSuccess,
  onVariantChange,
  settingsOpen,
  showInfo = false,
  showRewards = false,
  variant,
  vaultAddress,
  viewport
}: PackagedVaultWidgetProps): ReactElement {
  const router = useRouter()
  const packageMode = resolvePackagedVaultMode(mode, showInfo, showRewards)
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
  const family = useMemo(() => {
    if (kind === 'yvusd') return createYvUsdFamilyPreset({ assetPriceUsd, estimatedApr })
    if (kind === 'yvbtc') return createYvBtcFamilyPreset({ assetPriceUsd, estimatedApr })
    return undefined
  }, [assetPriceUsd, estimatedApr, kind])
  const sharedProps = {
    mode: packageMode,
    onConnectWallet,
    onModeChange: (nextMode: VaultWidgetMode): void => {
      if (nextMode === 'deposit') onModeChange(WidgetActionType.Deposit)
      if (nextMode === 'withdraw') onModeChange(WidgetActionType.Withdraw)
      if (nextMode === 'migrate') onModeChange(WidgetActionType.Migrate)
    },
    onSettingsOpenChange,
    onSuccess,
    onViewAllActivity: (): void => router.push('/portfolio?tab=activity'),
    settingsOpen,
    showNavigation: false,
    slots: { TransactionLink },
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
