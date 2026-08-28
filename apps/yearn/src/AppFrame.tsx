import { ScrollToTopButton } from '@pages/vaults/components/detail/ScrollToTopButton'
import { cl } from '@shared/utils/cl'
import type { ReactElement, ReactNode } from 'react'

type TAppFrameProps = {
  children: ReactNode
  header: ReactElement
}

export function AppFrame({ children, header }: TAppFrameProps): ReactElement {
  return (
    <>
      <div className={'sticky top-0 z-60 w-full max-md:fixed max-md:inset-x-0'}>{header}</div>
      <div id={'app'} className={cl('mx-auto mb-0 flex', 'max-md:pt-[var(--header-height)]')}>
        <div className={'block size-full min-h-max'}>{children}</div>
      </div>
      <ScrollToTopButton className="bottom-20 right-4 md:bottom-6 md:right-6" />
    </>
  )
}
