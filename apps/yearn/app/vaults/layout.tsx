import type { ReactElement, ReactNode } from 'react'
import App from '@/App'

export default function VaultsLayout({ children }: { children: ReactNode }): ReactElement {
  return <App>{children}</App>
}
