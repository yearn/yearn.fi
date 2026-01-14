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
    <div className={'flex w-full max-w-[1180px] flex-col items-center justify-center px-4 pb-16 md:py-16'}>
      <div
        className={
          'flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-3 px-4 py-6 md:justify-between md:gap-0 md:px-8'
        }
      >
        {footerLinks.flatMap((link, index) => [
          <Link
            key={link.path}
            href={link.path}
            target={'_blank'}
            className={'flex items-center gap-1 text-neutral-900 transition-colors hover:text-white'}
          >
            <span className={'text-sm md:text-lg'}>{link.label}</span>
            <span>{'↗'}</span>
          </Link>,
          index < footerLinks.length - 1 && (
            <span key={`spacer-${link.path}`} className={'hidden size-1 rounded-full bg-white/30 md:block'} />
          )
        ])}
      </div>
    </div>
  )
}
