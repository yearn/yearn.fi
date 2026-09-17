import { useThemePreference } from '@hooks/useThemePreference'
import { useAppSettings } from '@pages/vaults/contexts/useAppSettings'
import { yToast } from '@shared/components/yToast'
import { useNotifications } from '@shared/contexts/useNotifications'
import { useWalletStatus } from '@shared/contexts/useWallet'
import { useWalletVaultTotals } from '@shared/contexts/useWalletVaultTotals'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { useYearn } from '@shared/contexts/useYearn'
import { IconChevron } from '@shared/icons/IconChevron'
import { cl, formatUSD } from '@shared/utils'
import { truncateHex } from '@shared/utils/tools.address'
import { AccountDropdown as SharedAccountDropdown } from '@yearn/site-header/account'
import { useRouter } from 'next/navigation'
import { type RefObject, useCallback, useState } from 'react'

function AdvancedSettings() {
  const isDarkTheme = useThemePreference() !== 'light'
  const { mutateVaultList, enableVaultListFetch, isLoadingVaultList } = useYearn()
  const { shouldHideDust, onSwitchHideDust } = useAppSettings()
  const { toast } = yToast()
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [isRefreshingVaults, setIsRefreshingVaults] = useState(false)

  const menuItemClass = cl(
    'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
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
    <>
      <button
        className={menuItemClass}
        onClick={() => setIsAdvancedOpen((prev) => !prev)}
        aria-expanded={isAdvancedOpen}
        aria-controls={'account-dropdown-advanced'}
      >
        <span>{'Advanced'}</span>
        <IconChevron className={cl('size-4 transition-transform', isAdvancedOpen ? 'rotate-0' : '-rotate-90')} />
      </button>
      {isAdvancedOpen && (
        <div
          id={'account-dropdown-advanced'}
          className={cl(
            'mt-2 rounded-lg border p-2',
            isDarkTheme ? 'border-border bg-surface-secondary' : 'border-neutral-200 bg-neutral-50'
          )}
        >
          <div className={cl(menuItemClass, 'w-full justify-between')}>
            <span>{'Show dust'}</span>
            <button
              type={'button'}
              role={'switch'}
              aria-checked={!shouldHideDust}
              aria-label={!shouldHideDust ? 'Hide dust positions' : 'Show dust positions'}
              onClick={onSwitchHideDust}
              className={cl(
                'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors',
                !shouldHideDust ? 'border-primary bg-primary/20' : 'border-border bg-surface'
              )}
            >
              <span
                className={cl(
                  'block size-3 rounded-full transition-transform',
                  !shouldHideDust ? 'translate-x-[18px] bg-primary' : 'translate-x-[3px] bg-text-secondary'
                )}
              />
            </button>
          </div>
          <button
            className={cl(menuItemClass, 'w-full justify-between')}
            onClick={handleRefreshVaultList}
            disabled={isRefreshingVaults || isLoadingVaultList}
          >
            <span>{'Refresh vault list'}</span>
            <span className={'text-xs text-text-secondary'}>
              {isRefreshingVaults || isLoadingVaultList ? 'Refreshing…' : 'Run'}
            </span>
          </button>
        </div>
      )}
    </>
  )
}

type TDropdownProps = { isOpen: boolean; onClose: () => void; triggerRef?: RefObject<HTMLElement | null> }

export function AccountDropdown({ isOpen, onClose, triggerRef }: TDropdownProps) {
  return isOpen ? <ConnectedAccountDropdown onClose={onClose} triggerRef={triggerRef} /> : null
}

function ConnectedAccountDropdown({ onClose, triggerRef }: Omit<TDropdownProps, 'isOpen'>) {
  const { address, ens, clusters, onDesactivate } = useWeb3()
  const { isLoading: isWalletLoading } = useWalletStatus()
  const { totalValue } = useWalletVaultTotals()
  const { cachedEntries } = useNotifications()
  const { toast } = yToast()
  const router = useRouter()
  const navigate = (href: string) => {
    router.push(href)
    onClose()
  }
  return (
    <SharedAccountDropdown
      isOpen
      triggerRef={triggerRef}
      onClose={onClose}
      account={{
        address,
        displayName: ens || clusters?.name || (address ? truncateHex(address, 4) : 'Not connected'),
        isWalletLoading,
        portfolioValue: (
          <>
            <span>{formatUSD(Math.floor(totalValue), 0, 0)}</span>
            <span className="text-text-secondary">
              {totalValue > 0 ? `.${(totalValue % 1).toFixed(2).substring(2)}` : ''}
            </span>
          </>
        ),
        recentActivity: cachedEntries
          .toSorted((a, b) => (b.timeFinished ?? 0) - (a.timeFinished ?? 0))
          .slice(0, 3)
          .map((activity, index) => ({
            ...activity,
            id: activity.id ?? `legacy-${index}`,
            timestamp: activity.timeFinished
          })),
        onDisconnect: () => {
          onDesactivate()
          onClose()
        },
        onViewPortfolio: () => navigate('/portfolio'),
        onViewAllActivity: () => navigate('/portfolio?tab=activity'),
        onCopied: () => toast({ content: 'Address copied', type: 'success' })
      }}
      advancedSettings={<AdvancedSettings />}
    />
  )
}
