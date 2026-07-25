import type { VaultWidgetSettings, VaultWidgetSettingsStore } from '../services/types'
import type { VaultWidgetConfig } from '../types'

export const SLIPPAGE_RISK_ACKNOWLEDGEMENT_THRESHOLD = 1
export const SLIPPAGE_HARD_CAP = 5
export const SLIPPAGE_RISK_ACKNOWLEDGEMENT_TEXT = 'I accept the risk that I may lose money doing this'

export function clampSlippage(value: number): number {
  const sanitized = Number.isFinite(value) ? value : 0
  return Math.min(SLIPPAGE_HARD_CAP, Math.max(0, sanitized))
}

export function getRemainingEnsoSlippageBps({
  quoteImpactPercent,
  userToleranceBps
}: {
  quoteImpactPercent: number
  userToleranceBps: number
}): number {
  const tolerancePercent = Math.max(0, userToleranceBps) / 100
  const impactPercent = Math.min(100, Math.max(0, Number.isFinite(quoteImpactPercent) ? quoteImpactPercent : 0))
  if (tolerancePercent <= 0 || impactPercent >= tolerancePercent || impactPercent >= 100) return 0
  return Math.floor(((tolerancePercent - impactPercent) / (100 - impactPercent)) * 10_000)
}

export function getSlippageSaveState({
  localSlippage,
  currentSlippage,
  riskAcknowledgement = ''
}: {
  localSlippage: number
  currentSlippage: number
  riskAcknowledgement?: string
}): {
  sanitizedSlippage: number
  isSlippageDirty: boolean
  needsRiskAcknowledgement: boolean
  hasValidRiskAcknowledgement: boolean
} {
  const sanitizedSlippage = clampSlippage(localSlippage)
  const isSlippageDirty = sanitizedSlippage !== currentSlippage
  const needsRiskAcknowledgement = isSlippageDirty && sanitizedSlippage > SLIPPAGE_RISK_ACKNOWLEDGEMENT_THRESHOLD
  const hasValidRiskAcknowledgement =
    !needsRiskAcknowledgement || riskAcknowledgement.trim() === SLIPPAGE_RISK_ACKNOWLEDGEMENT_TEXT

  return {
    sanitizedSlippage,
    isSlippageDirty,
    needsRiskAcknowledgement,
    hasValidRiskAcknowledgement
  }
}

export function resolveVaultWidgetSettings(
  config: Pick<VaultWidgetConfig, 'defaultMaxLossBps' | 'defaultSlippagePercent'>,
  store: VaultWidgetSettingsStore
): VaultWidgetSettings {
  const settings = store.read()
  return {
    ...settings,
    maxLossBps:
      config.defaultMaxLossBps !== undefined && store.hasStored?.('maxLossBps') === false
        ? config.defaultMaxLossBps
        : settings.maxLossBps,
    slippagePercent:
      config.defaultSlippagePercent !== undefined && store.hasStored?.('slippagePercent') === false
        ? config.defaultSlippagePercent
        : settings.slippagePercent
  }
}
