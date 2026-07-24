'use client'

import { WidgetActionType } from '@pages/vaults/types'
import { createYBoldPreset, VaultWidget, type VaultWidgetMode, VaultWidgetProvider } from '@yearn/vault-widget'
import { createYearnFiActivityStore, createYearnFiSettingsStore } from '@yearn/vault-widget/services'
import { type ReactElement, useMemo } from 'react'

const baseConfig = createYBoldPreset({ ensoEndpoint: '/api/enso/route' })
const yearnFiServices = {
  activityStore: createYearnFiActivityStore(),
  settings: createYearnFiSettingsStore()
}

export function resolvePackagedYBoldMode(mode: WidgetActionType, showInfo: boolean): VaultWidgetMode {
  if (showInfo) return 'info'
  return mode === WidgetActionType.Withdraw ? 'withdraw' : 'deposit'
}

type TPackagedYBoldWidgetProps = {
  assetPriceUsd: number
  estimatedApr: number
  mode: WidgetActionType
  onConnectWallet: () => void
  onModeChange: (mode: WidgetActionType) => void
  onSuccess: () => void
  showInfo?: boolean
  viewport: 'desktop' | 'mobile'
}

export function PackagedYBoldWidget({
  assetPriceUsd,
  estimatedApr,
  mode,
  onConnectWallet,
  onModeChange,
  onSuccess,
  showInfo = false,
  viewport
}: TPackagedYBoldWidgetProps): ReactElement {
  const config = useMemo(
    () => ({
      ...baseConfig,
      display: {
        ...baseConfig.display,
        assetPriceUsd,
        estimatedApr
      }
    }),
    [assetPriceUsd, estimatedApr]
  )

  return (
    <VaultWidgetProvider services={yearnFiServices}>
      <VaultWidget
        chainId={config.chainId}
        vaultAddress={config.vaultAddress}
        config={config}
        mode={resolvePackagedYBoldMode(mode, showInfo)}
        onConnectWallet={onConnectWallet}
        onModeChange={(nextMode) => {
          if (nextMode === 'deposit') onModeChange(WidgetActionType.Deposit)
          if (nextMode === 'withdraw') onModeChange(WidgetActionType.Withdraw)
        }}
        onSuccess={onSuccess}
        showNavigation={false}
        viewport={viewport}
      />
    </VaultWidgetProvider>
  )
}
