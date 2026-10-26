'use client'

import { Dialog, Transition, TransitionChild } from '@headlessui/react'
import { IconChevron } from '@yearn/site-header/icons/IconChevron'
import { IconClose } from '@yearn/site-header/icons/IconClose'
import { IconDiscord } from '@yearn/site-header/icons/IconDiscord'
import { IconLinkOut } from '@yearn/site-header/icons/IconLinkOut'
import { IconMoon } from '@yearn/site-header/icons/IconMoon'
import { IconSettings } from '@yearn/site-header/icons/IconSettings'
import { IconStack } from '@yearn/site-header/icons/IconStack'
import { IconSun } from '@yearn/site-header/icons/IconSun'
import { IconTelegram } from '@yearn/site-header/icons/IconTelegram'
import { IconTwitter } from '@yearn/site-header/icons/IconTwitter'
import { IconWallet } from '@yearn/site-header/icons/IconWallet'
import { LogoCuration } from '@yearn/site-header/icons/LogoCuration'
import { LogoGithub } from '@yearn/site-header/icons/LogoGithub'
import { LogoYearn } from '@yearn/site-header/icons/LogoYearn'
import { LogoYearnMark } from '@yearn/site-header/icons/LogoYearnMark'
import { TypeMarkYearn } from '@yearn/site-header/icons/TypeMarkYearn'
import { cl } from '@yearn/site-header/utils'
import Image from 'next/image'
import Link from 'next/link'
import type { ReactElement, ReactNode } from 'react'
import { useState } from 'react'

type TNavItem = {
  name: string
  href: string
}

type TNavTile = TNavItem & {
  description?: string
  icon?: ReactElement
  iconWrapperClass?: string
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href)
}

type TSectionKey = 'products' | 'info' | 'community' | 'tools'

export type TMobileNavMenuProps = {
  isOpen: boolean
  onClose: () => void
  pathname?: string
  isDarkTheme: boolean
  onThemeToggle?: () => void
  notificationStatus?: 'pending' | 'submitted' | 'success' | 'error' | null
  walletIdentity?: string
  onWalletClick: () => void
  onSettingsClick?: () => void
  siteBaseUrl?: string
  assetBaseUrl?: string
  navigation?: ReactNode
  footer?: ReactNode
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
    <Link
      href={item.href}
      prefetch={isExternalHref(item.href) ? undefined : false}
      onClick={onClick}
      target={isExternalHref(item.href) ? '_blank' : undefined}
      rel={isExternalHref(item.href) ? 'noopener noreferrer' : undefined}
      className={'w-full'}
    >
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

export function MobileNavMenu(props: TMobileNavMenuProps): ReactElement | null {
  return props.isOpen ? <OpenMobileNavMenu {...props} /> : null
}

function OpenMobileNavMenu({
  isOpen,
  onClose,
  pathname = '',
  isDarkTheme,
  onThemeToggle,
  notificationStatus,
  walletIdentity,
  onWalletClick,
  onSettingsClick,
  siteBaseUrl = '',
  assetBaseUrl = 'https://cdn.jsdelivr.net/gh/yearn/tokenassets@main',
  navigation,
  footer
}: TMobileNavMenuProps): ReactElement {
  const [expandedSections, setExpandedSections] = useState<Record<TSectionKey, boolean>>({
    products: false,
    info: false,
    community: false,
    tools: false
  })
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
      href: `${siteBaseUrl}/vaults`,
      description: 'Yield-Generating Vaults',
      icon: <LogoYearnMark className={'size-6 text-primary'} />
    },
    {
      name: 'Curation',
      href: 'https://curation.yearn.fi',
      description: 'Lending Market Curation',
      icon: <LogoCuration className={'size-11'} back={'text-transparent'} front={'text-primary'} />
    },
    {
      name: 'yCRV',
      href: 'https://ycrv.yearn.fi',
      description: 'veCRV Liquid Locker',
      icon: (
        <Image
          width={24}
          height={24}
          unoptimized
          alt={'yCRV'}
          className={'size-6'}
          src={`${assetBaseUrl}/tokens/1/0xfcc5c47be19d06bf83eb04298b026f81069ff65b/logo-128.png`}
          loading={'eager'}
          decoding={'async'}
        />
      )
    },
    {
      name: 'yYB',
      href: 'https://yyb.yearn.fi',
      description: 'veYB Liquid Locker',
      icon: (
        <Image
          width={24}
          height={24}
          unoptimized
          alt={'yYB'}
          className={'size-6'}
          src={`${siteBaseUrl}/yYB-logo.svg`}
          loading={'eager'}
          decoding={'async'}
        />
      )
    },
    {
      name: 'stYFI',
      href: 'https://styfi.yearn.fi',
      description: 'YFI Staking',
      icon: (
        <Image
          width={24}
          height={24}
          unoptimized
          alt={'stYFI'}
          className={'size-6'}
          src={`${siteBaseUrl}/stYFI-logo.svg`}
          loading={'eager'}
          decoding={'async'}
        />
      )
    }
  ]

  const resourceInfoItems: TNavTile[] = [
    {
      name: 'Docs',
      href: 'https://docs.yearn.fi/',
      description: 'Yearn Knowledge Base',
      icon: (
        <Image
          width={24}
          height={24}
          unoptimized
          alt={'GitBook'}
          className={neutralImageClass}
          src={`${siteBaseUrl}/GitBook%20-%20Icon%20-%20Dark.svg`}
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
        <Image
          width={24}
          height={24}
          unoptimized
          alt={'Blog'}
          className={neutralImageClass}
          src={`${siteBaseUrl}/paragraph.svg`}
          loading={'eager'}
          decoding={'async'}
        />
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
      name: 'Partners',
      href: 'https://partners.yearn.fi/',
      description: 'Build on Yearn',
      icon: <IconStack className={cl('size-5', neutralIconForeground)} />
    },
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
        <Image
          width={24}
          height={24}
          unoptimized
          alt={'Discourse'}
          className={neutralImageClass}
          src={`${siteBaseUrl}/discourse-icon.svg`}
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

  const handleToggleSection = (key: TSectionKey): void => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <Transition show={isOpen} as={'div'}>
      <Dialog
        aria-label="Navigation menu"
        as={'div'}
        className={'fixed inset-0 z-[100] overflow-y-auto'}
        onClose={onClose}
      >
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
              <a href={`${siteBaseUrl}/`} onClick={onClose} className={'flex items-center'}>
                <TypeMarkYearn className={'h-8 w-auto'} color={isDarkTheme ? '#FFFFFF' : '#0657F9'} />
              </a>
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
                  {navigation}
                  <Link
                    href={`${siteBaseUrl}/vaults`}
                    prefetch={false}
                    onClick={onClose}
                    className={navItemClass(pathname.startsWith('/vaults'), false)}
                  >
                    <span>{'Vaults'}</span>
                  </Link>
                  <Link
                    href={`${siteBaseUrl}/portfolio`}
                    prefetch={false}
                    onClick={onClose}
                    className={navItemClass(pathname.startsWith('/portfolio'), false)}
                  >
                    <span>{'Portfolio'}</span>
                  </Link>
                </div>

                <div className={'h-px w-full bg-border'} />

                <div className={'flex flex-col gap-1'}>
                  <button
                    onClick={onWalletClick}
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

                  {onThemeToggle && (
                    <button
                      onClick={onThemeToggle}
                      className={
                        'flex min-h-[44px] w-full items-center gap-3 rounded-lg px-4 text-lg font-medium text-text-primary transition-colors hover:bg-surface-tertiary'
                      }
                    >
                      {isDarkTheme ? <IconSun className={'size-5'} /> : <IconMoon className={'size-5'} />}
                      <span>{isDarkTheme ? 'Light mode' : 'Dark mode'}</span>
                    </button>
                  )}

                  {onSettingsClick && (
                    <button
                      onClick={onSettingsClick}
                      className={
                        'flex min-h-[44px] w-full items-center gap-3 rounded-lg px-4 text-lg font-medium text-text-primary transition-colors hover:bg-surface-tertiary'
                      }
                    >
                      <IconSettings className={'size-5'} />
                      <span>{'Settings'}</span>
                    </button>
                  )}
                </div>

                <div className={'h-px w-full bg-border'} />

                <div className={'flex flex-col gap-1'}>
                  <div className={'flex flex-col gap-1'}>
                    <button type={'button'} onClick={() => handleToggleSection('products')} className={navSectionClass}>
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
                    rel={'noopener noreferrer'}
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
                    rel={'noopener noreferrer'}
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
                    rel={'noopener noreferrer'}
                    className={
                      'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-surface-secondary p-2.5 transition-colors hover:bg-surface-tertiary'
                    }
                    aria-label={'Twitter'}
                  >
                    <IconTwitter className={cl('size-6', isDarkTheme ? 'text-white' : 'text-text-primary')} />
                  </Link>
                </div>
              </div>
              <div className={'mt-1.5'}>{footer}</div>
            </div>
          </div>
        </TransitionChild>
      </Dialog>
    </Transition>
  )
}
