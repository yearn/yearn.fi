import type { ReactElement } from 'react'
import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes as RouterRoutes, useParams } from 'react-router'

// Lazy load all page components
const HomePage = lazy(() => import('@pages/landing'))
const PortfolioPage = lazy(() => import('@pages/portfolio/index'))
const VaultsPage = lazy(() => import('@pages/vaults/index'))
const VaultsDetailPage = lazy(() => import('@pages/vaults/[chainID]/[address]'))
const IconListPage = lazy(() => import('@pages/icon-list/index'))
const CurationPage = lazy(() => import('@pages/curation/index'))
const CurationReportPage = lazy(() => import('@pages/curation/report/[slug]'))
const CurationTestPage = lazy(() => import('@pages/curation/test-1'))

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

const CurationReportRedirect = (): ReactElement => {
  const { slug } = useParams()
  if (!slug) {
    return <Navigate to="/curation" replace />
  }
  return <Navigate to={`/curation/report/${slug}`} replace />
}

// Main routes component
export function Routes(): ReactElement {
  return (
    <Suspense fallback={<PageLoader />}>
      <RouterRoutes>
        {/* Home page */}
        <Route path="/" element={<HomePage />} />

        {/* Portfolio page */}
        <Route path="/portfolio" element={<PortfolioPage />} />

        {/* Icon inventory page */}
        <Route path="/icon-list" element={<IconListPage />} />

        {/* Curation pages */}
        <Route path="/curation">
          <Route index element={<CurationPage />} />
          <Route path="report/:slug" element={<CurationReportPage />} />
        </Route>
        <Route path="/curation-test-1" element={<CurationTestPage />} />

        {/* Unified Vaults routes */}
        <Route path="/vaults">
          <Route index element={<VaultsPage />} />
          <Route path=":chainID/:address" element={<VaultsDetailPage />} />
        </Route>

        {/* Legacy redirects to new /vaults routes */}
        <Route path="/v2" element={<Navigate to="/vaults?type=lp" replace />} />
        <Route path="/v2/*" element={<Navigate to="/vaults?type=lp" replace />} />
        <Route path="/v3" element={<Navigate to="/vaults" replace />} />
        {/* Legacy v3 vault detail alias */}
        <Route path="/v3/:chainID/:address" element={<VaultsDetailPage />} />
        <Route path="/v3/*" element={<Navigate to="/vaults" replace />} />

        {/* Legacy risk-score path */}
        <Route path="/report/:slug" element={<CurationReportRedirect />} />

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
      </RouterRoutes>
    </Suspense>
  )
}
