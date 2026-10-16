'use client'

import type { ReactNode } from 'react'
import type { TYTrancheModel } from '@/components/ytranche/model'
import { shortAddress } from '@/components/ytranche/model'
import type { TTheme } from '@/lib/theme'

export { DepositWidget } from '@/components/ytranche/DepositWidget'
export type { TTheme } from '@/lib/theme'
export { useThemePreference } from '@/lib/theme'

export function WalletButton({ model, inverse = false }: { model: TYTrancheModel; inverse?: boolean }) {
  return (
    <button
      className={`wallet-control${model.account ? ' wallet-control--connected' : ''}${inverse ? ' wallet-control--inverse' : ''}`}
      onClick={() => void model.connectWallet()}
      type="button"
    >
      {model.account ? (
        <>
          <span className="wallet-control__dot" aria-hidden="true" />
          {shortAddress(model.account)}
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
