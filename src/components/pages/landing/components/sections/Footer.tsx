import type { ReactElement } from 'react'
import Link from '/src/components/Link'

const footerLinks = [
  { path: 'https://docs.yearn.fi/', label: 'Docs' },
  { path: 'https://discord.gg/yearn', label: 'Support' },
  { path: 'https://blog.yearn.fi/', label: 'Blog' },
  { path: 'https://gov.yearn.fi/', label: 'Discourse' },
  { path: 'https://github.com/yearn', label: 'Github' },
  { path: 'https://x.com/yearnfi', label: 'X (Twitter)' }
]

export function Footer(): ReactElement {
  return (
    <div
      className={'flex w-full max-w-[1180px] flex-col items-center justify-center px-4 pb-12 pt-4 sm:pb-16 md:py-16'}
    >
      <div
        className={
          'flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-2 px-2 py-4 sm:gap-x-4 sm:gap-y-3 sm:px-4 sm:py-6 md:justify-between md:gap-0 md:px-8'
        }
      >
        {footerLinks.map((link) => (
          <Link
            key={link.path}
            href={link.path}
            target={'_blank'}
            className={
              'flex min-h-[44px] items-center gap-1 px-1 text-neutral-900 transition-colors hover:text-white sm:min-h-0 sm:px-0'
            }
          >
            <span className={'text-sm sm:text-base md:text-lg'}>{link.label}</span>
            <span>{'↗'}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
