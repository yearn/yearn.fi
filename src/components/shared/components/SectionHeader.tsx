import type { FC, ReactElement } from 'react'
import Link from '/src/components/Link'

export const SectionHeader: FC<{
  tagline?: string
  title?: string
  description?: ReactElement | string
  cta?: { label: string; href: string }
  align?: 'left' | 'right' | 'center'
  isH1?: boolean
}> = ({ tagline, title, description, cta, align = 'left', isH1 = false }) => {
  return (
    <div
      className={`flex flex-col ${align === 'right' ? 'items-center md:items-end' : align === 'center' ? 'items-center' : 'items-center md:items-start'} gap-y-2 min-[375px]:gap-y-3 px-0 sm:gap-y-4 sm:px-2 md:px-0 w-full max-w-full`}
    >
      <div
        className={`flex flex-col w-full ${align === 'right' ? 'items-center md:items-end' : align === 'center' ? 'items-center' : 'items-center md:items-start'}`}
      >
        {!!tagline && (
          <p
            className={
              'mb-0.5 min-[375px]:mb-1 text-xs min-[375px]:text-sm font-medium text-light-blue-500 sm:mb-2 sm:text-base'
            }
          >
            {tagline}
          </p>
        )}
        {!!title &&
          (isH1 ? (
            <h1
              className={
                'text-center text-2xl min-[375px]:text-3xl font-medium leading-tight sm:text-4xl md:text-left md:text-6xl'
              }
            >
              {title}
            </h1>
          ) : (
            <h2 className={'text-center text-xl min-[375px]:text-2xl font-medium sm:text-3xl md:text-left md:text-5xl'}>
              {title}
            </h2>
          ))}
      </div>
      {!!description && (
        <p
          className={`text-steel-gray-500 ${isH1 ? 'text-sm min-[375px]:text-base sm:text-[18px] md:text-[24px]' : 'text-sm min-[375px]:text-base sm:text-[18px]'} max-w-full ${align === 'center' ? 'text-center' : 'text-center md:text-left'} max-w-[28ch] min-[375px]:max-w-[32ch] sm:max-w-[40ch] md:max-w-full`}
        >
          {description}
          {!!cta && (
            <span className={'hidden md:inline'}>
              <Link href={cta.href} className={'ml-2 text-white'}>
                {cta.label} {'→'}
              </Link>
            </span>
          )}
        </p>
      )}
      {!!cta && (
        <span className={'block min-h-[44px] pt-2 md:hidden'}>
          <Link href={cta.href} className={'text-neutral-900'}>
            {cta.label} {'→'}
          </Link>
        </span>
      )}
    </div>
  )
}
