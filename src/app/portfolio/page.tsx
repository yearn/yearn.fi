import { Suspense } from 'react'
import PortfolioPage from '@pages/portfolio/index'

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PortfolioPage />
    </Suspense>
  )
}
