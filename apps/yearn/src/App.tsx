import AppHeader from '@shared/components/Header'
import type { ReactElement, ReactNode } from 'react'
import { AppFrame } from '@/AppFrame'
import { AppProviders } from '@/AppProviders'

function App({ children }: { children: ReactNode }): ReactElement {
  return (
    <main className={'font-aeonik size-full min-h-screen'}>
      <AppProviders>
        <AppFrame header={<AppHeader />}>{children}</AppFrame>
      </AppProviders>
    </main>
  )
}

export default App
