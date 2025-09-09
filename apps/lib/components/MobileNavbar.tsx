import { IconDiscord } from '@lib/icons/IconDiscord'
import { IconParagraph } from '@lib/icons/IconParagraph'
import { IconTwitter } from '@lib/icons/IconTwitter'
import { cl } from '@lib/utils'
import { iconsDict, LANDING_SIDEBAR_LINKS, MENU_TABS } from '@lib/utils/constants'
import type { ReactElement } from 'react'
import Link from '/src/components/Link'
import { usePathname } from '/src/hooks/usePathname'

export function MobileNavbar({ onClose }: { onClose: VoidFunction }): ReactElement {
  const pathName = usePathname()

  const currentTab = pathName?.startsWith('/vaults/') ? pathName?.split('/')[2] : 'vaults'

  return (
    <div
      className={
        'flex h-full w-screen flex-col justify-end border-t border-gray-600/50 bg-linear-to-b from-gray-900 to-[#1A1A1A]'
      }
    >
      <div className={'flex flex-col items-start gap-y-2 bg-transparent p-6 pb-4'}>
        {MENU_TABS.map((tab) => (
          <Link
            key={tab.route}
            className={cl(
              'text-base flex items-center gap-x-2 py-2 text-gray-400',
              currentTab === tab.route ? 'text-neutral-900' : 'text-gray-400'
            )}
            onClick={onClose}
            href={tab.route === 'apps' ? `/${tab.route}` : `/apps/${tab.route}`}
          >
            <div className={'flex size-6 items-center justify-center'}>
              {iconsDict[tab.route as keyof typeof iconsDict]}
            </div>
            <p>{tab.title}</p>
          </Link>
        ))}
      </div>

      <div className={'w-full border-t border-gray-700 p-6 pb-[104px]'}>
        <div className={'flex w-full justify-between'}>
          {LANDING_SIDEBAR_LINKS.slice(0, 5).map((link) => (
            <Link key={link.href} href={link.href} className={'text-sm text-gray-400'} target={'_blank'}>
              {link.title}
            </Link>
          ))}
        </div>

        <div className={'mt-6 flex gap-x-6'}>
          <Link target={'_blank'} href={'https://discord.com/invite/yearn'}>
            <IconDiscord />
          </Link>
          <Link target={'_blank'} href={'https://paragraph.xyz/@yearn'}>
            <IconParagraph />
          </Link>
          <Link target={'_blank'} href={'https://twitter.com/yearnfi'}>
            <IconTwitter />
          </Link>
        </div>
      </div>
    </div>
  )
}
