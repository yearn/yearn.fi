import type { ReactElement, ReactNode } from 'react'
import App from '@/App'

export default function V3VaultDetailsLayout({ children }: { children: ReactNode }): ReactElement {
  return <App>{children}</App>
}
