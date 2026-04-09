export const ZAP_SLIPPAGE_RISK_ACKNOWLEDGEMENT_THRESHOLD = 1
export const ZAP_SLIPPAGE_HARD_CAP = 5
export const ZAP_SLIPPAGE_RISK_ACKNOWLEDGEMENT_TEXT = 'I accept the risk that I may lose money doing this'

function sanitizeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0
}

export function clampZapSlippage(value: number): number {
  return Math.min(ZAP_SLIPPAGE_HARD_CAP, Math.max(0, sanitizeNumber(value)))
}

export function requiresZapSlippageRiskAcknowledgement(value: number): boolean {
  return clampZapSlippage(value) > ZAP_SLIPPAGE_RISK_ACKNOWLEDGEMENT_THRESHOLD
}

export function toBasisPoints(value: number): number {
  return Math.max(0, Math.floor(sanitizeNumber(value) * 100))
}

export function fromBasisPoints(value: number): number {
  return Math.max(0, sanitizeNumber(value) / 100)
}

export function calculateRemainingEnsoSlippagePercentage({
  userTolerancePercentage,
  quoteImpactPercentage
}: {
  userTolerancePercentage: number
  quoteImpactPercentage: number
}): number {
  const tolerance = clampZapSlippage(userTolerancePercentage)
  const quoteImpact = Math.min(100, Math.max(0, sanitizeNumber(quoteImpactPercentage)))

  if (tolerance <= 0 || quoteImpact >= tolerance || quoteImpact >= 100) {
    return 0
  }

  return fromBasisPoints(toBasisPoints(((tolerance - quoteImpact) / (100 - quoteImpact)) * 100))
}
