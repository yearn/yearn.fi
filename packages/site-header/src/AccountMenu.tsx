'use client'

import { DropdownPanel } from '@yearn/site-header/DropdownPanel'
import { IconArrowLeft } from '@yearn/site-header/icons/IconArrowLeft'
import { IconArrowRight } from '@yearn/site-header/icons/IconArrowRight'
import { IconChevron } from '@yearn/site-header/icons/IconChevron'
import { IconCopy } from '@yearn/site-header/icons/IconCopy'
import { IconMoon } from '@yearn/site-header/icons/IconMoon'
import { IconPower } from '@yearn/site-header/icons/IconPower'
import { IconSettings } from '@yearn/site-header/icons/IconSettings'
import { IconSun } from '@yearn/site-header/icons/IconSun'
import { LogoYearn } from '@yearn/site-header/icons/LogoYearn'
import { setThemePreference, useThemePreference } from '@yearn/site-header/theme'
import { cl } from '@yearn/site-header/utils'
import { type ReactElement, type ReactNode, type RefObject, useState } from 'react'

export type TAccountActivity = {
  id: string | number
  status: string
  type: string
  amount?: string | number
  fromTokenName?: string
  timestamp?: number
}
export type TAccountMenuData = {
  address?: string
  displayName: string
  isWalletLoading?: boolean
  portfolioValue?: ReactNode
  recentActivity: TAccountActivity[]
  onDisconnect: () => void
  onViewPortfolio: () => void
  onViewAllActivity?: () => void
  onCopied?: () => void
  networkAction?: ReactNode
}
function AccountView({
  account,
  onSettingsClick
}: {
  account: TAccountMenuData
  onSettingsClick: () => void
}): ReactElement {
  const {
    address,
    displayName,
    isWalletLoading,
    portfolioValue,
    recentActivity,
    onDisconnect: handleDisconnect,
    onViewPortfolio: handleViewPortfolio,
    onViewAllActivity: handleViewAllActivity,
    networkAction
  } = account
  const isDarkTheme = useThemePreference() !== 'light'
  const [copyStatus, setCopyStatus] = useState('')
  const handleCopyAddress = async () => {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      setCopyStatus('Address copied')
      account.onCopied?.()
    } catch {
      setCopyStatus('Unable to copy address. Please try again.')
    }
  }
  function formatDate(timestamp?: number): string {
    if (!timestamp) return ''
    const date = new Date(timestamp * 1000)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'success':
        return 'text-[#0C9000]'
      case 'error':
        return 'text-error'
      case 'submitted':
      case 'pending':
        return 'text-primary'
      default:
        return 'text-text-secondary'
    }
  }

  const iconButtonClass = cl(
    'flex size-7 items-center justify-center rounded-full transition-colors',
    isDarkTheme
      ? 'text-text-secondary hover:bg-surface-tertiary hover:text-text-primary'
      : 'text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700'
  )

  return (
    <div className={'flex flex-col'}>
      <div className={cl('rounded-2xl p-4', isDarkTheme ? 'bg-surface-secondary' : 'bg-neutral-100')}>
        <div className={'mb-4 flex items-start justify-between'}>
          <div className={'flex flex-col'}>
            <button
              onClick={handleCopyAddress}
              aria-label="Copy wallet address"
              disabled={!address}
              className={
                'group flex items-center gap-1.5 text-sm font-medium text-text-primary hover:text-primary transition-colors disabled:cursor-default disabled:hover:text-text-primary'
              }
            >
              <span>{displayName}</span>
              {address && <IconCopy className={'size-3.5 opacity-50 group-hover:opacity-100 transition-opacity'} />}
            </button>
            {isWalletLoading ? (
              <div className={'mt-1 h-7 w-20 animate-pulse rounded bg-surface-tertiary'} />
            ) : portfolioValue !== undefined ? (
              <p className={'text-2xl font-bold text-text-primary'}>{portfolioValue}</p>
            ) : null}
            {copyStatus && (
              <p role="status" className="mt-1 text-xs text-text-secondary">
                {copyStatus}
              </p>
            )}
          </div>
          <div className={'flex items-center gap-1'}>
            <button aria-label="Wallet settings" onClick={onSettingsClick} className={iconButtonClass}>
              <IconSettings className={'size-4'} />
            </button>
            <button
              onClick={handleDisconnect}
              aria-label="Disconnect wallet"
              disabled={isWalletLoading}
              className={cl(iconButtonClass, isWalletLoading && 'opacity-50 cursor-not-allowed')}
            >
              <IconPower className={'size-4'} />
            </button>
          </div>
        </div>

        <button
          onClick={handleViewPortfolio}
          className={cl(
            'flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors',
            isDarkTheme
              ? 'border-border bg-transparent text-text-primary hover:bg-surface-tertiary'
              : 'border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50'
          )}
        >
          {'View portfolio'}
          <IconArrowRight className={'size-4'} />
        </button>
      </div>

      {networkAction}
      <div className={'mt-4'}>
        <h3 className={'mb-3 text-sm font-semibold text-text-primary'}>{'Recent activity'}</h3>
        {recentActivity.length > 0 ? (
          <div className={'flex flex-col gap-3'}>
            {recentActivity.map((activity) => (
              <div key={activity.id} className={'flex items-center justify-between'}>
                <div className={'flex items-center gap-3'}>
                  <div
                    className={cl(
                      'flex size-9 items-center justify-center rounded-full',
                      isDarkTheme ? 'bg-surface-secondary' : 'bg-neutral-100'
                    )}
                  >
                    <LogoYearn className={'size-5'} front={'text-white'} back={'text-primary'} />
                  </div>
                  <div>
                    <p className={cl('text-sm font-medium capitalize', getStatusColor(activity.status))}>
                      {activity.type}
                    </p>
                    <p className={'text-xs text-text-secondary'}>
                      {activity.amount} {activity.fromTokenName ?? ''}
                    </p>
                  </div>
                </div>
                <span className={'text-xs text-text-secondary'}>{formatDate(activity.timestamp)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className={'text-sm text-text-secondary'}>{'No recent activity'}</p>
        )}

        {recentActivity.length > 0 && handleViewAllActivity && (
          <button
            onClick={handleViewAllActivity}
            className={cl(
              'mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isDarkTheme
                ? 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
                : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
            )}
          >
            {'More transactions'}
            <IconArrowRight className={'size-4'} />
          </button>
        )}
      </div>
    </div>
  )
}

const DARK_VARIANT_LABELS: Record<string, string> = {
  'soft-dark': 'Soft Dark',
  'blue-dark': 'Blue Dark',
  midnight: 'Midnight'
}

function SettingsView({
  onBack,
  advancedSettings
}: {
  onBack: () => void
  advancedSettings?: ReactNode
}): ReactElement {
  const themePreference = useThemePreference()
  const isDarkTheme = themePreference !== 'light'
  const backButtonClass = cl(
    'flex size-7 items-center justify-center rounded-full transition-colors',
    isDarkTheme
      ? 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
      : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
  )

  const menuItemClass = cl(
    'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isDarkTheme
      ? 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
  )

  function getVariantButtonClass(variant: string): string {
    if (themePreference === variant) {
      return 'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors bg-primary/10 text-primary'
    }
    return menuItemClass
  }

  return (
    <div className={'flex flex-col'}>
      <div className={'mb-4 flex items-center'}>
        <button aria-label="Back to wallet" onClick={onBack} className={backButtonClass}>
          <IconArrowLeft className={'size-4'} />
        </button>
        <h2 className={'flex-1 text-center text-base font-semibold text-text-primary'}>{'Settings'}</h2>
        <div className={'w-7'} />
      </div>

      <div className={'mb-4 flex items-center justify-between'}>
        <span className={'text-sm font-medium text-text-primary'}>{'Theme'}</span>
        <div className={cl('flex rounded-full p-0.5', isDarkTheme ? 'bg-surface-secondary' : 'bg-neutral-100')}>
          <button
            onClick={() => setThemePreference('light')}
            aria-label="Use light theme"
            className={cl(
              'flex items-center justify-center rounded-full px-3 py-1 text-sm font-medium transition-colors',
              !isDarkTheme ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
            )}
          >
            <IconSun className={'size-4'} />
          </button>
          <button
            onClick={() => setThemePreference(themePreference === 'light' ? 'soft-dark' : themePreference)}
            aria-label="Use dark theme"
            className={cl(
              'flex items-center justify-center rounded-full px-3 py-1 text-sm font-medium transition-colors',
              isDarkTheme ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
            )}
          >
            <IconMoon className={'size-4'} />
          </button>
        </div>
      </div>

      {isDarkTheme && (
        <div className={'mb-4'}>
          <span className={'mb-2 block text-xs font-medium text-text-secondary'}>{'Dark variant'}</span>
          <div className={'flex flex-col gap-1'}>
            {(['soft-dark', 'blue-dark', 'midnight'] as const).map((variant) => (
              <button
                key={variant}
                onClick={() => setThemePreference(variant)}
                className={getVariantButtonClass(variant)}
              >
                <span>{DARK_VARIANT_LABELS[variant]}</span>
                {themePreference === variant && <IconChevron className={'size-4 -rotate-90'} />}
              </button>
            ))}
          </div>
        </div>
      )}

      {advancedSettings}
    </div>
  )
}

export function AccountMenu({
  account,
  advancedSettings
}: {
  account: TAccountMenuData
  advancedSettings?: ReactNode
}) {
  const [view, setView] = useState<'account' | 'settings'>('account')
  return view === 'account' ? (
    <AccountView account={account} onSettingsClick={() => setView('settings')} />
  ) : (
    <SettingsView onBack={() => setView('account')} advancedSettings={advancedSettings} />
  )
}

export function AccountDropdown({
  isOpen,
  onClose,
  account,
  advancedSettings,
  triggerRef
}: {
  isOpen: boolean
  onClose: () => void
  triggerRef?: RefObject<HTMLElement | null>
  account: TAccountMenuData
  advancedSettings?: ReactNode
}) {
  const isDarkTheme = useThemePreference() !== 'light'
  return (
    <DropdownPanel
      isOpen={isOpen}
      triggerRef={triggerRef}
      onClose={onClose}
      anchor="right"
      className="w-80 max-md:w-full"
      forceDark={isDarkTheme}
    >
      <div role="dialog" aria-label="Wallet account">
        <AccountMenu key={account.address} account={account} advancedSettings={advancedSettings} />
      </div>
    </DropdownPanel>
  )
}
