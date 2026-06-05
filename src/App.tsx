import { ScrollToTopButton } from '@pages/vaults/components/detail/ScrollToTopButton'
import AppHeader from '@shared/components/Header'
import { cl } from '@shared/utils/cl'
import type { ReactElement, ReactNode } from 'react'
import { AppProviders } from '@/AppProviders'

function App({ children }: { children: ReactNode }): ReactElement {
  return (
    <main className={'font-aeonik size-full min-h-screen'}>
      <AppProviders>
        <div className={'sticky top-0 z-60 w-full max-md:fixed max-md:inset-x-0'}>
          <AppHeader />
        </div>
        <div id={'app'} className={cl('mx-auto mb-0 flex', 'max-md:pt-[var(--header-height)]')}>
          <div className={'block size-full min-h-max'}>{children}</div>
        </div>
        <ScrollToTopButton className="bottom-20 right-4 md:bottom-6 md:right-6" />
      </AppProviders>
    </main>
  )
}

export default App
