import { PublicHeader } from '@shared/components/PublicHeader'
import type { ReactElement, ReactNode } from 'react'
import { AppFrame } from '@/AppFrame'
import { AppPublicProviders } from '@/AppPublicProviders'

function PublicApp({ children }: { children: ReactNode }): ReactElement {
  return (
    <main className={'font-aeonik size-full min-h-screen'}>
      <AppPublicProviders>
        <AppFrame header={<PublicHeader />}>{children}</AppFrame>
      </AppPublicProviders>
    </main>
  )
}

export default PublicApp
