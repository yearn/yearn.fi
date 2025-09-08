import type { TApp } from '@lib/types/mixed'
import { cl } from '@lib/utils'
import Image from 'next/image'
import Link from 'next/link'
import type { ReactElement } from 'react'

export function FeaturedApp(props: { app: TApp }): ReactElement {
  return (
    <Link
      href={props.app.appURI}
      target={props.app.appURI.startsWith('/') ? '_self' : '_blank'}
      className={cl(
        'group relative flex cursor-pointer flex-col justify-end px-6 py-10 rounded-[12px] z-20 overflow-hidden outline-solid outline-1 outline-gray-700/50 h-[272px] min-w-[272px]'
      )}
    >
      <div
        className={'absolute inset-0 bottom-[100px] transition-all duration-200 group-hover:bottom-[100px] md:bottom-0'}
      >
        <Image
          src={props.app.logoURI}
          alt={props.app.name}
          priority
          width={2000}
          height={2000}
          className={'right-0 top-0 size-full bg-center object-cover  '}
        />
      </div>

      <div
        className={
          'pointer-events-none absolute bottom-0 left-0 z-30 h-[120px] w-full bg-gray-800 p-6 text-neutral-900 transition-all md:bottom-[-120px] md:group-hover:bottom-0'
        }
      >
        {props.app.description}
      </div>
    </Link>
  )
}
