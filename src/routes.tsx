import type { ReactElement } from 'react'
import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'

// Lazy load all page components
const HomePage = lazy(() => import('../pages/index'))
const AppsPage = lazy(() => import('../pages/apps/index'))
const PortfolioPage = lazy(() => import('../pages/portfolio/index'))
const VaultsPage = lazy(() => import('../pages/vaults/index'))
const VaultsDetailPage = lazy(() => import('../pages/vaults/[chainID]/[address]'))

// Loading component
const PageLoader = (): ReactElement => (
  <div className={'relative flex min-h-dvh flex-col px-4 text-center'}>
    <div className={'mt-[20%] flex h-10 items-center justify-center'}>
      <span className={'loader'} />
    </div>
  </div>
)

// External redirect component
const ExternalRedirect = ({ to }: { to: string }): ReactElement => {
  window.location.href = to
  return <PageLoader />
}

// Route configuration for reference
export const routeConfig = {
  home: '/',
  apps: '/apps',
  vaults: {
    index: '/vaults',
    detail: '/vaults/:chainID/:address'
  },
  external: {
    ybribe: '/ybribe/*',
    ycrv: '/ycrv/*',
    veyfi: '/veyfi/*',
    twitter: '/twitter',
    telegram: '/telegram',
    medium: '/medium',
    governance: '/governance',
    snapshot: '/snapshot',
    github: '/github'
  }
}

// Main routes component
export function AppRoutes(): ReactElement {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Home page */}
        <Route path="/" element={<HomePage />} />

        {/* Apps page */}
        <Route path="/apps" element={<AppsPage />} />

        {/* Portfolio page */}
        <Route path="/portfolio" element={<PortfolioPage />} />

        {/* Unified Vaults routes */}
        <Route path="/vaults">
          <Route index element={<VaultsPage />} />
          <Route path=":chainID/:address" element={<VaultsDetailPage />} />
        </Route>

        {/* Legacy redirects to new /vaults routes */}
        <Route path="/v2" element={<Navigate to="/vaults?type=v2" replace />} />
        <Route path="/v2/*" element={<Navigate to="/vaults?type=v2" replace />} />
        <Route path="/v3" element={<Navigate to="/vaults" replace />} />
        <Route path="/v3/*" element={<Navigate to="/vaults" replace />} />
        <Route path="/vaults" element={<Navigate to="/vaults" replace />} />
        <Route path="/vaults/*" element={<Navigate to="/vaults" replace />} />

        {/* External redirects */}
        <Route path="/ybribe/*" element={<ExternalRedirect to="https://ybribe.yearn.fi" />} />
        <Route path="/ycrv/*" element={<ExternalRedirect to="https://ycrv.yearn.fi" />} />
        <Route path="/veyfi/*" element={<ExternalRedirect to="https://veyfi.yearn.fi" />} />
        <Route path="/twitter" element={<ExternalRedirect to="https://twitter.com/yearnfi" />} />
        <Route path="/telegram" element={<ExternalRedirect to="https://t.me/yearnfinance/" />} />
        <Route path="/medium" element={<ExternalRedirect to="https://medium.com/iearn" />} />
        <Route path="/governance" element={<ExternalRedirect to="https://gov.yearn.fi/" />} />
        <Route path="/snapshot" element={<ExternalRedirect to="https://snapshot.org/#/veyfi.eth" />} />
        <Route path="/github" element={<ExternalRedirect to="https://github.com/yearn/yearn.fi" />} />

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
