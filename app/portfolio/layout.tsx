import type { ReactElement, ReactNode } from 'react'
import App from '@/App'

export default function PortfolioLayout({ children }: { children: ReactNode }): ReactElement {
  return <App>{children}</App>
}
