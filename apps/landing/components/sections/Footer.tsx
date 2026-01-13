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
          'flex w-full flex-wrap items-center justify-center gap-6 rounded-[24px] border border-white/10 bg-black/30 px-8 py-6 md:gap-12'
        }
      >
        {footerLinks.map((link) => (
          <Link
            key={link.path}
            href={link.path}
            target={'_blank'}
            className={'flex items-center gap-1 text-neutral-900 transition-colors hover:text-white'}
          >
            <span className={'text-base md:text-lg'}>{link.label}</span>
            <span>{'↗'}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
