import { getVaultAPR, type TKongVaultApr, type TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { formatAmount } from '@shared/utils'

type TVaultFeeStructure = Pick<TKongVaultApr['fees'], 'management' | 'performance'>

function toFeeBps(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 0
  }

  const normalizedValue = value > 1 ? value / 10000 : value
  return Math.max(0, Math.round(normalizedValue * 10000))
}

function formatFeePercent(bps: number): string {
  return `${formatAmount(bps / 100, 0, 2)}%`
}

export function getFeeStructureKeyFromFees(fees: TVaultFeeStructure | null | undefined): string {
  const managementBps = toFeeBps(fees?.management)
  const performanceBps = toFeeBps(fees?.performance)
  return `${managementBps}:${performanceBps}`
}

export function getVaultFeeStructureKey(vault: TKongVaultInput): string {
  return getFeeStructureKeyFromFees(getVaultAPR(vault).fees)
}

export function formatFeeStructureLabel(fees: TVaultFeeStructure | null | undefined): string {
  const managementBps = toFeeBps(fees?.management)
  const performanceBps = toFeeBps(fees?.performance)

  return `Fees: ${formatFeePercent(managementBps)} | ${formatFeePercent(performanceBps)}`
}

export function formatFeeStructureFilterAriaLabel(fees: TVaultFeeStructure | null | undefined): string {
  const managementBps = toFeeBps(fees?.management)
  const performanceBps = toFeeBps(fees?.performance)

  return `Filter by ${formatFeePercent(managementBps)} management fee and ${formatFeePercent(performanceBps)} performance fee`
}
