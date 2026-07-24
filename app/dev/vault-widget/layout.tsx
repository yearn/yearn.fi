import type { ReactElement, ReactNode } from 'react'
import App from '@/App'

export default function VaultWidgetParityLayout({ children }: { children: ReactNode }): ReactElement {
  return <App>{children}</App>
}
