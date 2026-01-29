import { setThemePreference, useThemePreference } from '@hooks/useThemePreference'
import { useNotifications } from '@shared/contexts/useNotifications'
import { useYearn } from '@shared/contexts/useYearn'
import useWallet from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { yToast } from '@shared/components/yToast'
import { IconArrowLeft } from '@shared/icons/IconArrowLeft'
import { IconArrowRight } from '@shared/icons/IconArrowRight'
import { IconChevron } from '@shared/icons/IconChevron'
import { IconMoon } from '@shared/icons/IconMoon'
import { IconPower } from '@shared/icons/IconPower'
import { IconSettings } from '@shared/icons/IconSettings'
import { IconSun } from '@shared/icons/IconSun'
import { LogoYearn } from '@shared/icons/LogoYearn'
import { cl, formatUSD } from '@shared/utils'
import { truncateHex } from '@shared/utils/tools.address'
import type { ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { DropdownPanel } from './DropdownPanel'

type TAccountDropdownProps = {
  isOpen: boolean
  onClose: () => void
}

type TView = 'account' | 'settings' | 'advanced'

function AccountView({ onSettingsClick, onClose }: { onSettingsClick: () => void; onClose: () => void }): ReactElement {
  const { address, ens, clusters, onDesactivate } = useWeb3()
  const { cumulatedValueInV2Vaults, cumulatedValueInV3Vaults, isLoading: isWalletLoading } = useWallet()
  const { cachedEntries } = useNotifications()
  const navigate = useNavigate()
  const themePreference = useThemePreference()
  const isDarkTheme = themePreference !== 'light'

  const totalValue = cumulatedValueInV2Vaults + cumulatedValueInV3Vaults

  const displayName = useMemo(() => {
    if (ens) return ens
    if (clusters?.name) return clusters.name
    if (address) return truncateHex(address, 4)
    return 'Not connected'
  }, [address, ens, clusters])

  const recentActivity = useMemo(() => {
    return cachedEntries.toSorted((a, b) => (b.timeFinished ?? 0) - (a.timeFinished ?? 0)).slice(0, 3)
  }, [cachedEntries])

  const handleViewPortfolio = useCallback(() => {
    navigate('/portfolio')
    onClose()
  }, [navigate, onClose])

  const handleDisconnect = useCallback(() => {
    onDesactivate()
    onClose()
  }, [onDesactivate, onClose])

  const handleViewAllActivity = useCallback(() => {
    navigate('/portfolio?tab=activity')
    onClose()
  }, [navigate, onClose])

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
        return 'text-red'
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
            <p className={'text-sm font-medium text-text-primary'}>{displayName}</p>
            {isWalletLoading ? (
              <div className={'mt-1 h-7 w-20 animate-pulse rounded bg-surface-tertiary'} />
            ) : (
              <p className={'text-2xl font-bold text-text-primary'}>
                <span>{formatUSD(Math.floor(totalValue), 0, 0)}</span>
                <span className={'text-text-secondary'}>
                  {totalValue > 0 ? `.${(totalValue % 1).toFixed(2).substring(2)}` : ''}
                </span>
              </p>
            )}
          </div>
          <div className={'flex items-center gap-1'}>
            <button onClick={onSettingsClick} className={iconButtonClass}>
              <IconSettings className={'size-4'} />
            </button>
            <button onClick={handleDisconnect} className={iconButtonClass}>
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
                <span className={'text-xs text-text-secondary'}>{formatDate(activity.timeFinished)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className={'text-sm text-text-secondary'}>{'No recent activity'}</p>
        )}

        {recentActivity.length > 0 && (
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

function SettingsView({ onBack, onAdvancedClick }: { onBack: () => void; onAdvancedClick: () => void }): ReactElement {
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
        <button onClick={onBack} className={backButtonClass}>
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
            className={cl(
              'flex items-center justify-center rounded-full px-3 py-1 text-sm font-medium transition-colors',
              !isDarkTheme ? 'bg-surface text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'
            )}
          >
            <IconSun className={'size-4'} />
          </button>
          <button
            onClick={() => setThemePreference(themePreference === 'light' ? 'soft-dark' : themePreference)}
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

      <button className={menuItemClass} onClick={onAdvancedClick}>
        <span>{'Advanced'}</span>
        <IconChevron className={'size-4 -rotate-90'} />
      </button>
    </div>
  )
}

function AdvancedView({ onBack }: { onBack: () => void }): ReactElement {
  const themePreference = useThemePreference()
  const isDarkTheme = themePreference !== 'light'
  const { mutateVaultList, enableVaultListFetch, isLoadingVaultList } = useYearn()
  const { toast } = yToast()
  const [isRefreshingVaults, setIsRefreshingVaults] = useState(false)

  const backButtonClass = cl(
    'flex size-7 items-center justify-center rounded-full transition-colors',
    isDarkTheme
      ? 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
      : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700'
  )

  const menuItemClass = cl(
    'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isDarkTheme
      ? 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
  )

  const handleRefreshVaultList = useCallback(async () => {
    enableVaultListFetch()
    setIsRefreshingVaults(true)
    try {
      await mutateVaultList()
      toast({ content: 'Vault list refreshed', type: 'success' })
    } catch (error) {
      console.error('[AccountDropdown] Failed to refresh vault list', error)
      toast({ content: 'Failed to refresh vault list', type: 'error' })
    } finally {
      setIsRefreshingVaults(false)
    }
  }, [enableVaultListFetch, mutateVaultList, toast])

  return (
    <div className={'flex flex-col'}>
      <div className={'mb-4 flex items-center'}>
        <button onClick={onBack} className={backButtonClass}>
          <IconArrowLeft className={'size-4'} />
        </button>
        <h2 className={'flex-1 text-center text-base font-semibold text-text-primary'}>{'Advanced'}</h2>
        <div className={'w-7'} />
      </div>

      <button
        className={menuItemClass}
        onClick={handleRefreshVaultList}
        disabled={isRefreshingVaults || isLoadingVaultList}
      >
        <span>{'Refresh vault list'}</span>
        <span className={'text-xs text-text-secondary'}>
          {isRefreshingVaults || isLoadingVaultList ? 'Refreshing…' : 'Run'}
        </span>
      </button>
    </div>
  )
}

export function AccountDropdown({ isOpen, onClose }: TAccountDropdownProps): ReactElement {
  const [view, setView] = useState<TView>('account')

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => setView('account'), 200)
    }
  }, [isOpen])

  return (
    <DropdownPanel isOpen={isOpen} onClose={onClose} anchor={'right'} className={'w-80 max-md:w-full'}>
      {view === 'account' ? (
        <AccountView onSettingsClick={() => setView('settings')} onClose={onClose} />
      ) : view === 'settings' ? (
        <SettingsView onBack={() => setView('account')} onAdvancedClick={() => setView('advanced')} />
      ) : (
        <AdvancedView onBack={() => setView('settings')} />
      )}
    </DropdownPanel>
  )
}
