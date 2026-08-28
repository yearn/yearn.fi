import { getVaultName as getKongVaultName, type TKongVaultInput } from '@pages/vaults/domain/kongVaultSelectors'
import { yToast } from '@shared/components/yToast'
import type { TSortDirection } from '../types/mixed'

export function getVaultName(vault: TKongVaultInput): string {
  let baseName = getKongVaultName(vault)

  baseName = baseName.replace(/^(curve|aerodrome|velodrome)\s+/i, '')

  if (baseName.includes(' Factory yVault')) {
    return baseName.replace(' Factory yVault', ' LP')
  }

  if (baseName.includes(' yVault')) {
    return baseName.replace(' yVault', '')
  }

  return baseName
}

export function copyToClipboard(value: string): void {
  const { toast } = yToast()
  navigator.clipboard.writeText(value)
  toast({ content: 'Copied to clipboard!', type: 'info' })
}

/***************************************************************************
 ** Detect is we are running from an Iframe
 **************************************************************************/
export function isIframe(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  if (window !== window.top || window.top !== window.self || (document?.location?.ancestorOrigins || []).length !== 0) {
    return true
  }
  return false
}

/***************************************************************************
 ** Helper function to sort elements based on the type of the element.
 **************************************************************************/
export const stringSort = ({ a, b, sortDirection }: { a: string; b: string; sortDirection: TSortDirection }): number =>
  sortDirection === 'desc' ? a.localeCompare(b) : b.localeCompare(a)

export const numberSort = ({
  a,
  b,
  sortDirection
}: {
  a?: number
  b?: number
  sortDirection: TSortDirection
}): number => (sortDirection === 'desc' ? (b ?? 0) - (a ?? 0) : (a ?? 0) - (b ?? 0))
