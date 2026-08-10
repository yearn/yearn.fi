import AppHeader from '@shared/components/Header'
import { YearnVaultWidgetRuntimeProvider } from '@shared/contexts/YearnVaultWidgetRuntimeProvider'
import type { ReactElement, ReactNode } from 'react'
import { AppFrame } from '@/AppFrame'
import { AppProviders } from '@/AppProviders'

function App({ children }: { children: ReactNode }): ReactElement {
  return (
    <main className={'font-aeonik size-full min-h-screen'}>
      <AppProviders>
        <YearnVaultWidgetRuntimeProvider>
          <AppFrame header={<AppHeader />}>{children}</AppFrame>
        </YearnVaultWidgetRuntimeProvider>
      </AppProviders>
    </main>
  )
}

export default App
