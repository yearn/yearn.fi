'use client'

import { useVaultWidgetRuntime } from '@yearn/vault-widget'
import type { ReactNode } from 'react'
import type { TTheme } from '@/lib/theme'

export { DepositWidget } from '@/components/ytranche/DepositWidget'
export type { TTheme } from '@/lib/theme'
export { useThemePreference } from '@/lib/theme'

export function WalletButton({ inverse = false }: { inverse?: boolean }) {
  const { wallet } = useVaultWidgetRuntime()
  const account = wallet.address
  return (
    <button
      className={`wallet-control${account ? ' wallet-control--connected' : ''}${inverse ? ' wallet-control--inverse' : ''}`}
      onClick={() => void wallet.open()}
      type="button"
    >
      {account ? (
        <>
          <span className="wallet-control__dot" aria-hidden="true" />
          {account.slice(0, 6)}…{account.slice(-4)}
        </>
      ) : (
        'Connect wallet'
      )}
    </button>
  )
}

export function ThemeSwitcher({ theme, onChange }: { theme: TTheme; onChange: (theme: TTheme) => void }) {
  return (
    <fieldset className="theme-switcher">
      <legend className="sr-only">Color theme</legend>
      <button
        className={theme === 'light' ? 'is-active' : undefined}
        type="button"
        aria-pressed={theme === 'light'}
        onClick={() => onChange('light')}
      >
        Light
      </button>
      <button
        className={theme === 'dark' ? 'is-active' : undefined}
        type="button"
        aria-pressed={theme === 'dark'}
        onClick={() => onChange('dark')}
      >
        Dark
      </button>
    </fieldset>
  )
}

export function ContractLink({ address, children }: { address: string; children: ReactNode }) {
  return (
    <a href={`https://etherscan.io/address/${address}#code`} target="_blank" rel="noreferrer">
      {children} <span aria-hidden="true">↗</span>
    </a>
  )
}
