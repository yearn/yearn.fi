export const SLIPPAGE_RISK_ACKNOWLEDGEMENT_THRESHOLD = 1
export const SLIPPAGE_HARD_CAP = 5
export const SLIPPAGE_RISK_ACKNOWLEDGEMENT_TEXT = 'I accept the risk that I may lose money doing this'

export function clampSlippage(value: number): number {
  const sanitized = Number.isFinite(value) ? value : 0
  return Math.min(SLIPPAGE_HARD_CAP, Math.max(0, sanitized))
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
