import type { ReactElement, ReactNode } from 'react'
import App from '@/App'

export default function WalletLayout({ children }: { children: ReactNode }): ReactElement {
  return <App>{children}</App>
}
