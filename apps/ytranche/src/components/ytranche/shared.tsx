'use client'

import type { ReactNode } from 'react'

export { DepositWidget } from '@/components/ytranche/DepositWidget'
export type { TTheme } from '@/lib/theme'
export { useThemePreference } from '@/lib/theme'

export function ContractLink({ address, children }: { address: string; children: ReactNode }) {
  return (
    <a href={`https://etherscan.io/address/${address}#code`} target="_blank" rel="noreferrer">
      {children} <span aria-hidden="true">↗</span>
    </a>
  )
}
