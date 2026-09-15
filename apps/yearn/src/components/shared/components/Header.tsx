'use client'

import { setThemePreference, useThemePreference } from '@hooks/useThemePreference'
import { AccountDropdown } from '@shared/components/AccountDropdown'
import { HeaderNavMenu } from '@shared/components/HeaderNavMenu'
import { MobileNavMenu } from '@shared/components/MobileNavMenu'
import { toast } from '@shared/components/yToast'
import { useNotifications } from '@shared/contexts/useNotifications'
import { useTenderlyPanel } from '@shared/contexts/useTenderlyPanel'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { IconBurgerPlain } from '@shared/icons/IconBurgerPlain'
import { IconMoon } from '@shared/icons/IconMoon'
import { IconSun } from '@shared/icons/IconSun'
import { IconWallet } from '@shared/icons/IconWallet'
import { TypeMarkYearn } from '@shared/icons/TypeMarkYearn'
import { cl } from '@shared/utils'
import { normalizePathname } from '@shared/utils/routes'
import { truncateHex } from '@shared/utils/tools.address'
import { useWalletDrawer } from '@yearn/wallet-ui/context'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { KeyboardEvent, MouseEvent, ReactElement } from 'react'
import { useMemo, useState } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import {
  canToggleTenderlyMode,
  isTenderlyModeConfigured,
  isTenderlyModeEnabled,
  persistTenderlyModeEnabled,
  resolveConnectedTenderlyExecutionChain,
  tenderlyConfiguredRuntime
} from '@/config/tenderly'

type TWalletSelectorProps = {
  onAccountClick: () => void
  isAccountOpen: boolean
  notificationStatus: 'pending' | 'submitted' | 'success' | 'error' | null
}

function WalletSelector({ onAccountClick, isAccountOpen, notificationStatus }: TWalletSelectorProps): ReactElement {
  const { isActive, address, ens, clusters, openLoginModal } = useWeb3()
  const { dialogId: walletDrawerId, isOpen: isWalletDrawerOpen } = useWalletDrawer()
  const isDisconnected = !(isActive || address || ens || clusters)

  const walletIdentity = useMemo((): string | undefined => {
    if (ens) return ens
    if (clusters) return clusters.name
    if (address) return truncateHex(address, 4)
    return undefined
  }, [ens, clusters, address])

  const notificationDotColor = useMemo((): string => {
    switch (notificationStatus) {
      case 'error':
        return 'bg-red'
      case 'success':
        return 'bg-[#0C9000]'
      case 'pending':
      case 'submitted':
        return 'bg-primary animate-pulse'
      default:
        return ''
    }
  }, [notificationStatus])

  function handleClick(): void {
    if (isActive || address || ens || clusters) {
      onAccountClick()
      return
    }
    openLoginModal()
  }

  return (
    <button
      type={'button'}
      data-wallet-account-trigger={!isDisconnected || undefined}
      data-wallet-drawer-trigger={isDisconnected ? true : undefined}
      aria-controls={isDisconnected ? walletDrawerId : 'yearn-wallet-account'}
      aria-expanded={isDisconnected ? isWalletDrawerOpen : isAccountOpen}
      aria-haspopup="dialog"
      aria-label={walletIdentity ? `Open wallet account ${walletIdentity}` : 'Connect wallet'}
      title={walletIdentity}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={handleClick}
      className={
        'relative flex h-11 w-11 shrink-0 cursor-pointer items-center rounded-lg focus-visible:outline-2 focus-visible:outline-primary md:w-36'
      }
    >
      {walletIdentity && notificationStatus && (
        <span className={cl('absolute -right-0.5 -top-0.5 size-2 rounded-full', notificationDotColor)} />
      )}
      <span
        suppressHydrationWarning
        className={cl(
          'inline-flex h-8 w-full items-center justify-center gap-2 rounded-lg px-3 text-sm font-normal transition-colors duration-150 motion-reduce:transition-none',
          walletIdentity
            ? 'bg-surface-secondary text-text-secondary hover:text-text-primary'
            : 'text-text-secondary md:bg-text-primary md:text-surface md:hover:bg-text-primary/90'
        )}
      >
        <IconWallet className={'size-4 shrink-0'} />
        <span className={'hidden min-w-0 truncate md:block'}>{walletIdentity || 'Connect wallet'}</span>
      </span>
    </button>
  )
}

function getConfiguredTenderlyMappingsLabel(): string {
  return tenderlyConfiguredRuntime.configuredCanonicalChainIds
    .map((canonicalChainId) => {
      const executionChainId = tenderlyConfiguredRuntime.configuredByCanonicalId[canonicalChainId]?.executionChainId
      return executionChainId ? `${canonicalChainId} -> ${executionChainId}` : String(canonicalChainId)
    })
    .join(', ')
}

function TenderlyBadge(): ReactElement | null {
  const { isPanelAvailable, isOpen, togglePanel } = useTenderlyPanel()
  const { chain } = useAccount()
  const { switchChainAsync, isPending: isSwitchingChain } = useSwitchChain()
  const isTenderlyConfigured = isTenderlyModeConfigured()

  if (!isTenderlyConfigured && !isTenderlyModeEnabled()) {
    return null
  }

  const isTenderlyActive = isTenderlyModeEnabled()
  const configuredMappings = getConfiguredTenderlyMappingsLabel()
  const canToggleMode = canToggleTenderlyMode()
  const canToggleControls = isTenderlyActive && isPanelAvailable
  const connectedTenderlyExecutionChain = resolveConnectedTenderlyExecutionChain(chain?.id)

  const handleBadgeClick = (): void => {
    if (!canToggleControls) {
      return
    }

    togglePanel()
  }

  const handleBadgeKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!canToggleControls) {
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      togglePanel()
    }
  }

  const handleToggleMode = async (
    event: KeyboardEvent<HTMLButtonElement> | MouseEvent<HTMLButtonElement>
  ): Promise<void> => {
    event.stopPropagation()
    if (isSwitchingChain) {
      return
    }

    if (isTenderlyActive && connectedTenderlyExecutionChain) {
      try {
        await switchChainAsync({ chainId: connectedTenderlyExecutionChain.canonicalChainId })
      } catch {
        toast({
          content: `Switch to ${connectedTenderlyExecutionChain.canonicalChainName} was cancelled. Tenderly is still on.`,
          type: 'warning'
        })
        return
      }
    }

    persistTenderlyModeEnabled(!isTenderlyActive)
    window.location.reload()
  }

  return (
    <div
      onClick={handleBadgeClick}
      onKeyDown={handleBadgeKeyDown}
      role={canToggleControls ? 'button' : undefined}
      tabIndex={canToggleControls ? 0 : undefined}
      title={
        canToggleControls
          ? `Tenderly mode enabled${configuredMappings ? ` (${configuredMappings})` : ''}. Click to ${isOpen ? 'hide' : 'show'} controls.`
          : `Use ${isTenderlyActive ? 'Tenderly RPCs and vnets' : 'normal RPCs'}${configuredMappings ? ` (${configuredMappings})` : ''}`
      }
      className={cl(
        'inline-flex min-h-[32px] items-center gap-2 rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition-all',
        canToggleControls ? 'cursor-pointer hover:border-text-primary/60' : 'cursor-default',
        'border-border bg-surface-secondary'
      )}
    >
      <span className={cl('transition-colors', isTenderlyActive ? 'text-text-primary' : 'text-text-tertiary')}>
        {'Tenderly'}
      </span>
      {canToggleMode && (
        <button
          type="button"
          onClick={handleToggleMode}
          onKeyDown={(event): void => {
            event.stopPropagation()
          }}
          role="switch"
          aria-checked={isTenderlyActive}
          aria-busy={isSwitchingChain}
          aria-label={isTenderlyActive ? 'Disable Tenderly mode' : 'Enable Tenderly mode'}
          disabled={isSwitchingChain}
          className={cl(
            'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors',
            isSwitchingChain ? 'cursor-wait opacity-70' : '',
            isTenderlyActive ? 'border-text-primary/70 bg-text-primary/15' : 'border-border bg-surface'
          )}
        >
          <span
            className={cl(
              'block size-3 rounded-full transition-transform',
              isTenderlyActive ? 'translate-x-[18px] bg-text-primary' : 'translate-x-[3px] bg-text-secondary'
            )}
          />
        </button>
      )}
    </div>
  )
}

function AppHeader(): ReactElement {
  const pathname = usePathname() || '/'
  const [isAccountSidebarOpen, setIsAccountSidebarOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { notificationStatus } = useNotifications()
  const { address, ens, clusters } = useWeb3()
  const themePreference = useThemePreference()
  const isDarkTheme = themePreference !== 'light'

  const isHomePage = normalizePathname(pathname) === '/'

  const walletIdentity = useMemo((): string | undefined => {
    if (ens) return ens
    if (clusters?.name) return clusters.name
    if (address) return truncateHex(address, 4)
    return undefined
  }, [ens, clusters, address])

  return (
    <div
      id={'head'}
      className={cl('sticky inset-x-0 top-0 z-50 w-full backdrop-blur-md', isHomePage ? 'bg-transparent' : 'bg-app')}
    >
      <div className={'mx-auto w-full max-w-[1232px] px-4'}>
        <header className={'flex h-[var(--header-height)] w-full items-center justify-between px-0'}>
          <div className={'flex items-center justify-start gap-x-6 px-1 py-2 md:py-1'} data-tour="vaults-header-nav">
            <a href={'/'} className={'flex items-center gap-1 transition-colors hover:opacity-80'}>
              <TypeMarkYearn className={'h-8 w-auto'} color={isHomePage || isDarkTheme ? '#FFFFFF' : '#0657F9'} />
            </a>
            <div className={'hidden items-center gap-3 pb-0.5 md:flex'}>
              <HeaderNavMenu isHomePage={isHomePage} isDarkTheme={isDarkTheme} />
            </div>
          </div>
          <div className={'flex items-center justify-end gap-2'}>
            {!isHomePage && (
              <>
                <div className={'flex items-center justify-end gap-2'} data-tour="vaults-header-user">
                  <div className="hidden md:block">
                    <TenderlyBadge />
                  </div>
                  <div className={'hidden md:flex gap-4'}>
                    <Link href={'/vaults'} prefetch={false}>
                      <span
                        className={
                          'text-base font-medium text-text-secondary transition-colors hover:text-text-primary'
                        }
                      >
                        {'Vaults'}
                      </span>
                    </Link>

                    <Link href={'/portfolio'} prefetch={false}>
                      <span
                        className={
                          'text-base font-medium text-text-secondary transition-colors hover:text-text-primary'
                        }
                      >
                        {'Portfolio'}
                      </span>
                    </Link>
                  </div>
                  <button
                    className={
                      'hidden md:block min-h-[44px] min-w-[44px] rounded-full p-2.5 text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'
                    }
                    onClick={() => setThemePreference(isDarkTheme ? 'light' : 'soft-dark')}
                    title={isDarkTheme ? 'Switch to light mode' : 'Switch to dark mode'}
                    aria-label={isDarkTheme ? 'Switch to light mode' : 'Switch to dark mode'}
                  >
                    {isDarkTheme ? <IconSun className={'size-5'} /> : <IconMoon className={'size-5'} />}
                  </button>
                  <div className={'relative'}>
                    <WalletSelector
                      isAccountOpen={isAccountSidebarOpen}
                      onAccountClick={() => setIsAccountSidebarOpen(!isAccountSidebarOpen)}
                      notificationStatus={notificationStatus}
                    />
                    <AccountDropdown isOpen={isAccountSidebarOpen} onClose={() => setIsAccountSidebarOpen(false)} />
                  </div>
                </div>
                <button
                  className={cl(
                    'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2.5 transition-colors md:hidden',
                    isHomePage ? 'text-white hover:bg-white/10' : 'text-text-primary hover:bg-surface-secondary'
                  )}
                  onClick={() => setIsMobileMenuOpen(true)}
                  data-mobile-nav-trigger
                  data-wallet-drawer-trigger={isHomePage || undefined}
                  aria-label={'Open navigation menu'}
                >
                  <IconBurgerPlain className={'size-6'} />
                </button>
              </>
            )}
          </div>
        </header>
      </div>
      <MobileNavMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        pathname={pathname}
        isDarkTheme={isDarkTheme}
        onThemeToggle={() => setThemePreference(isDarkTheme ? 'light' : 'soft-dark')}
        notificationStatus={notificationStatus}
        walletIdentity={walletIdentity}
      />
    </div>
  )
}

export default AppHeader
