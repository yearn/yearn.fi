import { Dialog, Transition, TransitionChild } from '@headlessui/react'
import { setThemePreference, useThemePreference } from '@hooks/useThemePreference'
import { BottomDrawer } from '@pages/vaults/components/detail/BottomDrawer'
import { useWallet } from '@shared/contexts/useWallet'
import { useWeb3 } from '@shared/contexts/useWeb3'
import { IconChevron } from '@shared/icons/IconChevron'
import { IconClose } from '@shared/icons/IconClose'
import { IconDiscord } from '@shared/icons/IconDiscord'
import { IconLinkOut } from '@shared/icons/IconLinkOut'
import { IconMoon } from '@shared/icons/IconMoon'
import { IconSettings } from '@shared/icons/IconSettings'
import { IconSun } from '@shared/icons/IconSun'
import { IconTwitter } from '@shared/icons/IconTwitter'
import { IconWallet } from '@shared/icons/IconWallet'
import { LogoCuration } from '@shared/icons/LogoCuration'
import { LogoGithub } from '@shared/icons/LogoGithub'
import { LogoYearn } from '@shared/icons/LogoYearn'
import { LogoYearnMark } from '@shared/icons/LogoYearnMark'
import { TypeMarkYearn } from '@shared/icons/TypeMarkYearn'
import { cl, formatUSD } from '@shared/utils'
import { truncateHex } from '@shared/utils/tools.address'
import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import Link from '/src/components/Link'
import { IconTelegram } from '../icons/IconTelegram'

type TNavItem = {
  name: string
  href: string
}

type TNavTile = TNavItem & {
  description?: string
  icon?: ReactElement
  iconWrapperClass?: string
}

const BASE_YEARN_ASSET_URI = import.meta.env?.VITE_BASE_YEARN_ASSETS_URI ?? ''

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href)
}

type TSectionKey = 'products' | 'info' | 'community' | 'tools'

type TMobileNavMenuProps = {
  isOpen: boolean
  onClose: () => void
  pathname: string
  isDarkTheme: boolean
  onThemeToggle: () => void
  notificationStatus: 'pending' | 'submitted' | 'success' | 'error' | null
  walletIdentity?: string
}

function MobileNavTile({
  item,
  isDark,
  onClick
}: {
  item: TNavTile
  isDark: boolean
  onClick: () => void
}): ReactElement {
  const hasIcon = Boolean(item.icon)
  const iconWrapperClass =
    item.iconWrapperClass ?? cl(isDark ? 'bg-[#0a0a0a] text-neutral-200' : 'bg-white text-neutral-700')

  return (
    <Link href={item.href} onClick={onClick} className={'w-full'}>
      <div
        className={cl(
          'group/nav-item flex items-center rounded-lg p-2 transition-colors',
          hasIcon ? 'gap-3' : 'gap-0',
          isDark ? 'hover:bg-white/10' : 'hover:bg-neutral-100'
        )}
      >
        {hasIcon && (
          <div className={cl('flex size-8 items-center justify-center rounded-lg', iconWrapperClass)}>{item.icon}</div>
        )}
        <div className={cl('flex-1', hasIcon ? '' : 'pl-1')}>
          <div className={'flex w-full items-center justify-between gap-2'}>
            <span className={cl('truncate text-sm font-semibold', isDark ? 'text-white' : 'text-neutral-900')}>
              {item.name}
            </span>
            {isExternalHref(item.href) && (
              <IconLinkOut
                className={cl(
                  'size-3 opacity-0 transition-opacity group-hover/nav-item:opacity-100',
                  isDark ? 'text-neutral-400' : 'text-neutral-500'
                )}
              />
            )}
          </div>
          {item.description && (
            <p className={cl('text-xs', isDark ? 'text-neutral-400' : 'text-neutral-500')}>{item.description}</p>
          )}
        </div>
      </div>
    </Link>
  )
}

export function MobileNavMenu({
  isOpen,
  onClose,
  pathname,
  isDarkTheme,
  onThemeToggle,
  notificationStatus,
  walletIdentity
}: TMobileNavMenuProps): ReactElement {
  const [expandedSections, setExpandedSections] = useState<Record<TSectionKey, boolean>>({
    products: false,
    info: false,
    community: false,
    tools: false
  })
  const [isWalletDrawerOpen, setIsWalletDrawerOpen] = useState(false)
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false)
  const { isActive, openLoginModal, onDesactivate, address, ens, clusters } = useWeb3()
  const { cumulatedValueInV2Vaults, cumulatedValueInV3Vaults, isLoading: isWalletLoading } = useWallet()
  const themePreference = useThemePreference()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isOpen) {
      setExpandedSections({
        products: false,
        info: false,
        community: false,
        tools: false
      })
    }
  }, [isOpen])

  function navItemClass(isActive: boolean, isExternal: boolean): string {
    return cl(
      'flex min-h-[44px] w-full items-center rounded-lg px-4 text-lg font-medium transition-colors',
      isExternal ? 'justify-between' : '',
      isActive ? 'bg-primary/10 text-text-primary' : 'text-text-primary hover:bg-surface-tertiary'
    )
  }

  const navSectionClass = cl(
    'flex min-h-[44px] w-full items-center justify-between rounded-lg px-4 text-lg font-medium transition-colors',
    'text-text-primary hover:bg-surface-tertiary'
  )

  const notificationDotColor = (() => {
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
  })()

  const neutralImageClass = cl('size-5 grayscale', isDarkTheme ? 'invert brightness-125' : 'opacity-90')
  const neutralIconForeground = isDarkTheme ? 'text-white' : 'text-neutral-700'
  const products: TNavTile[] = [
    {
      name: 'yVaults',
      href: '/vaults',
      description: 'Yield-Generating Vaults',
      icon: <LogoYearnMark className={'size-6 text-primary'} />
    },
    {
      name: 'Curation',
      href: 'https://app.morpho.org/ethereum/earn?v2=false&curators=yearn',
      description: 'Lending Market Curation',
      icon: <LogoCuration className={'size-11'} back={'text-transparent'} front={'text-primary'} />
    },
    {
      name: 'yCRV',
      href: 'https://ycrv.yearn.fi',
      description: 'veCRV Liquid Locker',
      icon: (
        <img
          alt={'yCRV'}
          className={'size-6'}
          src={`${BASE_YEARN_ASSET_URI}/tokens/1/0xfcc5c47be19d06bf83eb04298b026f81069ff65b/logo-128.png`}
          loading={'eager'}
          decoding={'async'}
        />
      )
    },
    {
      name: 'yYB',
      href: 'https://yyb.yearn.fi',
      description: 'veYB Liquid Locker',
      icon: <img alt={'yYB'} className={'size-6'} src={'/yYB-logo.svg'} loading={'eager'} decoding={'async'} />
    }
  ]

  const resourceInfoItems: TNavTile[] = [
    {
      name: 'Docs',
      href: 'https://docs.yearn.fi/',
      description: 'Yearn Knowledge Base',
      icon: (
        <img
          alt={'GitBook'}
          className={neutralImageClass}
          src={'/GitBook%20-%20Icon%20-%20Dark.svg'}
          loading={'eager'}
          decoding={'async'}
        />
      )
    },
    {
      name: 'X (Twitter)',
      href: 'https://x.com/yearnfi',
      description: 'Official Yearn News Feed',
      icon: <IconTwitter className={cl('size-5', neutralIconForeground)} />
    },
    {
      name: 'Github',
      href: 'https://github.com/yearn',
      description: 'Yearn Codebase',
      icon: <LogoGithub className={cl('size-5', neutralIconForeground)} />
    },
    {
      name: 'Blog',
      href: 'https://blog.yearn.fi/',
      description: 'Articles about Yearn',
      icon: (
        <img alt={'Blog'} className={neutralImageClass} src={'/paragraph.svg'} loading={'eager'} decoding={'async'} />
      )
    },
    {
      name: 'Brand Assets',
      href: 'https://brand.yearn.fi',
      description: 'Yearn Brand Resources',
      icon: (
        <LogoYearn
          width={20}
          height={20}
          className={'size-5'}
          back={isDarkTheme ? 'text-neutral-200' : 'text-neutral-700'}
          front={'text-white'}
        />
      )
    }
  ]

  const resourceCommunityItems: TNavTile[] = [
    {
      name: 'Support',
      href: 'https://discord.gg/yearn',
      description: 'Get help on the Yearn Discord Server',
      icon: <IconDiscord className={cl('size-5', neutralIconForeground)} />
    },
    {
      name: 'Telegram Chat',
      href: 'https://t.me/yearnfinance',
      description: 'Discuss Yearn on Telegram',
      icon: <IconTelegram className={cl('size-5', neutralIconForeground)} />
    },
    {
      name: 'Governance',
      href: 'https://gov.yearn.fi/',
      description: 'Yearn Discussion Forum',
      icon: (
        <img
          alt={'Discourse'}
          className={neutralImageClass}
          src={'/discourse-icon.svg'}
          loading={'eager'}
          decoding={'async'}
        />
      )
    }
  ]

  const resourceToolItems: TNavTile[] = [
    { name: 'PowerGlove', href: 'https://powerglove.yearn.fi', description: 'Vault Analytics' },
    { name: 'Kong', href: 'https://kong.yearn.fi', description: 'Vault Data' },
    { name: 'Kalani', href: 'https://kalani.yearn.fi', description: 'Vault Management Interface' },
    { name: 'yFactory', href: 'https://factory.yearn.fi', description: 'LP token Vault Creation' },
    { name: 'APR Oracle', href: 'https://oracle.yearn.fi', description: 'Projected Vault APY Tool' }
  ]

  const displayName = walletIdentity || ens || clusters?.name || (address ? truncateHex(address, 4) : 'Wallet')
  const totalValue = cumulatedValueInV2Vaults + cumulatedValueInV3Vaults

  const handleWalletClick = (): void => {
    onClose()
    setIsWalletDrawerOpen(true)
  }

  const handleSettingsClick = (): void => {
    onClose()
    setIsSettingsDrawerOpen(true)
  }

  const handleToggleSection = (key: TSectionKey): void => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleViewPortfolio = (): void => {
    navigate('/portfolio')
    setIsWalletDrawerOpen(false)
  }

  const handleViewRecentActivity = (): void => {
    navigate('/portfolio?tab=activity')
    setIsWalletDrawerOpen(false)
  }

  const handleConnectWallet = (): void => {
    setIsWalletDrawerOpen(false)
    openLoginModal()
  }

  const handleDisconnect = (): void => {
    onDesactivate()
    setIsWalletDrawerOpen(false)
  }

  function getVariantButtonClass(variant: string): string {
    if (themePreference === variant) {
      return 'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors bg-primary/10 text-primary'
    }
    return cl(
      'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      isDarkTheme
        ? 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
        : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
    )
  }

  return (
    <>
      <Transition show={isOpen} as={'div'}>
        <Dialog as={'div'} className={'fixed inset-0 z-[100] overflow-y-auto'} onClose={onClose}>
          <TransitionChild
            as={'div'}
            enter={'ease-out duration-300'}
            enterFrom={'opacity-0'}
            enterTo={'opacity-100'}
            leave={'ease-in duration-200'}
            leaveFrom={'opacity-100'}
            leaveTo={'opacity-0'}
          >
            <div className={'fixed inset-0 bg-modal-overlay backdrop-blur-sm'} />
          </TransitionChild>

          <TransitionChild
            as={'div'}
            enter={'ease-out duration-300'}
            enterFrom={'opacity-0 translate-y-4'}
            enterTo={'opacity-100 translate-y-0'}
            leave={'ease-in duration-200'}
            leaveFrom={'opacity-100 translate-y-0'}
            leaveTo={'opacity-0 translate-y-4'}
          >
            <div
              className={cl('relative flex min-h-screen w-full flex-col', isDarkTheme ? 'bg-[#0a0a0a]' : 'bg-surface')}
            >
              <div className={'flex h-[var(--header-height)] items-center justify-between border-b border-border px-4'}>
                <Link href={'/'} onClick={onClose} className={'flex items-center'}>
                  <TypeMarkYearn className={'h-8 w-auto'} color={isDarkTheme ? '#FFFFFF' : '#0657F9'} />
                </Link>
                <button
                  onClick={onClose}
                  className={
                    'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-text-primary transition-colors hover:bg-surface-secondary'
                  }
                  aria-label={'Close navigation menu'}
                >
                  <IconClose className={'size-6'} />
                </button>
              </div>

              <div className={'flex flex-1 flex-col px-4 py-6'}>
                <nav className={'flex flex-col gap-4'}>
                  <div className={'flex flex-col gap-1'}>
                    <Link
                      href={'/vaults'}
                      onClick={onClose}
                      className={navItemClass(pathname.startsWith('/vaults'), false)}
                    >
                      <span>{'Vaults'}</span>
                    </Link>
                    <Link
                      href={'/portfolio'}
                      onClick={onClose}
                      className={navItemClass(pathname.startsWith('/portfolio'), false)}
                    >
                      <span>{'Portfolio'}</span>
                    </Link>
                  </div>

                  <div className={'h-px w-full bg-border'} />

                  <div className={'flex flex-col gap-1'}>
                    <button
                      onClick={handleWalletClick}
                      className={
                        'relative flex min-h-[44px] w-full items-center gap-3 rounded-lg px-4 text-lg font-medium text-text-primary transition-colors hover:bg-surface-tertiary'
                      }
                    >
                      <IconWallet className={'size-5'} />
                      <span>{walletIdentity || 'Wallet'}</span>
                      {notificationStatus && (
                        <div className={cl('absolute right-4 size-2.5 rounded-full', notificationDotColor)} />
                      )}
                    </button>

                    <button
                      onClick={() => {
                        onThemeToggle()
                      }}
                      className={
                        'flex min-h-[44px] w-full items-center gap-3 rounded-lg px-4 text-lg font-medium text-text-primary transition-colors hover:bg-surface-tertiary'
                      }
                    >
                      {isDarkTheme ? <IconSun className={'size-5'} /> : <IconMoon className={'size-5'} />}
                      <span>{isDarkTheme ? 'Light mode' : 'Dark mode'}</span>
                    </button>

                    <button
                      onClick={handleSettingsClick}
                      className={
                        'flex min-h-[44px] w-full items-center gap-3 rounded-lg px-4 text-lg font-medium text-text-primary transition-colors hover:bg-surface-tertiary'
                      }
                    >
                      <IconSettings className={'size-5'} />
                      <span>{'Settings'}</span>
                    </button>
                  </div>

                  <div className={'h-px w-full bg-border'} />

                  <div className={'flex flex-col gap-1'}>
                    <div className={'flex flex-col gap-1'}>
                      <button
                        type={'button'}
                        onClick={() => handleToggleSection('products')}
                        className={navSectionClass}
                      >
                        <span>{'Products'}</span>
                        <IconChevron
                          className={cl('size-4 transition-transform', expandedSections.products ? 'rotate-180' : '')}
                        />
                      </button>
                      {expandedSections.products &&
                        products.map((item) => (
                          <MobileNavTile key={item.href} item={item} isDark={isDarkTheme} onClick={onClose} />
                        ))}
                    </div>

                    <div className={'flex flex-col gap-1'}>
                      <button type={'button'} onClick={() => handleToggleSection('info')} className={navSectionClass}>
                        <span>{'Information'}</span>
                        <IconChevron
                          className={cl('size-4 transition-transform', expandedSections.info ? 'rotate-180' : '')}
                        />
                      </button>
                      {expandedSections.info &&
                        resourceInfoItems.map((item) => (
                          <MobileNavTile key={item.href} item={item} isDark={isDarkTheme} onClick={onClose} />
                        ))}
                    </div>

                    <div className={'flex flex-col gap-1'}>
                      <button
                        type={'button'}
                        onClick={() => handleToggleSection('community')}
                        className={navSectionClass}
                      >
                        <span>{'Community'}</span>
                        <IconChevron
                          className={cl('size-4 transition-transform', expandedSections.community ? 'rotate-180' : '')}
                        />
                      </button>
                      {expandedSections.community &&
                        resourceCommunityItems.map((item) => (
                          <MobileNavTile key={item.href} item={item} isDark={isDarkTheme} onClick={onClose} />
                        ))}
                    </div>

                    <div className={'flex flex-col gap-1'}>
                      <button type={'button'} onClick={() => handleToggleSection('tools')} className={navSectionClass}>
                        <span>{'Tools'}</span>
                        <IconChevron
                          className={cl('size-4 transition-transform', expandedSections.tools ? 'rotate-180' : '')}
                        />
                      </button>
                      {expandedSections.tools &&
                        resourceToolItems.map((item) => (
                          <MobileNavTile key={item.href} item={item} isDark={isDarkTheme} onClick={onClose} />
                        ))}
                    </div>
                  </div>
                </nav>

                <div className={'my-6 h-px bg-border'} />

                <div className={'mt-auto pt-6'}>
                  <div className={'flex items-center justify-center gap-4'}>
                    <Link
                      href={'https://discord.com/invite/yearn'}
                      target={'_blank'}
                      className={
                        'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-surface-secondary p-2.5 transition-colors hover:bg-surface-tertiary'
                      }
                      aria-label={'Discord'}
                    >
                      <IconDiscord className={cl('size-6', isDarkTheme ? 'text-white' : 'text-text-primary')} />
                    </Link>
                    <Link
                      href={'https://github.com/yearn'}
                      target={'_blank'}
                      className={
                        'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-surface-secondary p-2.5 transition-colors hover:bg-surface-tertiary'
                      }
                      aria-label={'GitHub'}
                    >
                      <LogoGithub className={cl('size-6', isDarkTheme ? 'text-white' : 'text-text-primary')} />
                    </Link>
                    <Link
                      href={'https://x.com/yearnfi'}
                      target={'_blank'}
                      className={
                        'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-surface-secondary p-2.5 transition-colors hover:bg-surface-tertiary'
                      }
                      aria-label={'Twitter'}
                    >
                      <IconTwitter className={cl('size-6', isDarkTheme ? 'text-white' : 'text-text-primary')} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </TransitionChild>
        </Dialog>
      </Transition>
      <BottomDrawer isOpen={isWalletDrawerOpen} onClose={() => setIsWalletDrawerOpen(false)} title={'Wallet'}>
        <div className={'px-4 py-4'}>
          <div className={'mb-4 flex items-start justify-between'}>
            <div className={'flex flex-col'}>
              <p className={'text-sm font-medium text-text-primary'}>{displayName}</p>
              {!isActive ? (
                <p className={'text-sm text-text-secondary'}>{'Not connected'}</p>
              ) : isWalletLoading ? (
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
            {isActive && (
              <button
                onClick={handleDisconnect}
                className={cl(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  'text-text-secondary hover:bg-surface-tertiary hover:text-text-primary'
                )}
              >
                {'Disconnect'}
              </button>
            )}
          </div>

          {!isActive && (
            <button
              onClick={handleConnectWallet}
              className={cl(
                'flex w-full items-center justify-center rounded-lg border py-2.5 text-sm font-medium transition-colors',
                'border-border bg-surface text-text-primary hover:bg-surface-tertiary'
              )}
            >
              {'Connect wallet'}
            </button>
          )}

          {isActive && (
            <div className={'flex flex-col gap-2'}>
              <button
                onClick={handleViewPortfolio}
                className={cl(
                  'flex w-full items-center justify-center rounded-lg border py-2.5 text-sm font-medium transition-colors',
                  'border-border bg-surface text-text-primary hover:bg-surface-tertiary'
                )}
              >
                {'View portfolio'}
              </button>
              <button
                onClick={handleViewRecentActivity}
                className={cl(
                  'flex w-full items-center justify-center rounded-lg border py-2.5 text-sm font-medium transition-colors',
                  'border-border bg-surface text-text-primary hover:bg-surface-tertiary'
                )}
              >
                {'Recent activity'}
              </button>
            </div>
          )}
        </div>
      </BottomDrawer>
      <BottomDrawer isOpen={isSettingsDrawerOpen} onClose={() => setIsSettingsDrawerOpen(false)} title={'Settings'}>
        <div className={'px-4 py-4'}>
          <div className={'mb-4 flex items-center justify-between'}>
            <span className={'text-sm font-medium text-text-primary'}>{'Theme'}</span>
            <div className={cl('flex rounded-full p-0.5', isDarkTheme ? 'bg-surface-secondary' : 'bg-neutral-100')}>
              <button
                onClick={() => setThemePreference('light')}
                className={cl(
                  'flex items-center justify-center rounded-full px-3 py-1 text-sm font-medium transition-colors',
                  !isDarkTheme
                    ? 'bg-surface text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
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
                    <span>
                      {
                        {
                          'soft-dark': 'Soft Dark',
                          'blue-dark': 'Blue Dark',
                          midnight: 'Midnight'
                        }[variant]
                      }
                    </span>
                    {themePreference === variant && <IconChevron className={'size-4 -rotate-90'} />}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button className={getVariantButtonClass('advanced')}>
            <span>{'Advanced'}</span>
            <IconChevron className={'size-4 -rotate-90'} />
          </button>
        </div>
      </BottomDrawer>
    </>
  )
}
