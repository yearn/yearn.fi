import type { ReactElement } from 'react'
import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

// Lazy load all page components
const HomePage = lazy(() => import('../pages/index'))
const AppsPage = lazy(() => import('../pages/apps/index'))
const VaultsPage = lazy(() => import('../pages/vaults/index'))
const VaultsAboutPage = lazy(() => import('../pages/vaults/about'))
const VaultsDetailPage = lazy(() => import('../pages/vaults/[chainID]/[address]'))
const V3Page = lazy(() => import('../pages/v3/index'))
const V3AboutPage = lazy(() => import('../pages/v3/about'))
const V3DetailPage = lazy(() => import('../pages/v3/[chainID]/[address]'))
const VaultsBetaPage = lazy(() => import('../pages/vaults-beta/index'))
const VaultsBetaDetailPage = lazy(() => import('../pages/vaults-beta/[chainID]/[address]'))
const VaultsBetaSearchPage = lazy(() => import('../pages/vaults-beta/search/[query]'))

const isVaultsBetaEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_VAULTS_BETA !== 'false'

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
    about: '/vaults/about',
    detail: '/vaults/:chainID/:address',
    factory: '/vaults/factory/*'
  },
  v3: {
    index: '/v3',
    about: '/v3/about',
    detail: '/v3/:chainID/:address',
    chainOnly: '/v3/:chainID'
  },
  vaultsBeta: {
    index: '/vaults-beta',
    detail: '/vaults-beta/:chainID/:address',
    search: '/vaults-beta/search/:query'
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

        {/* Vaults routes */}
        <Route path="/vaults">
          <Route index element={<VaultsPage />} />
          <Route path="about" element={<VaultsAboutPage />} />
          <Route path=":chainID/:address" element={<VaultsDetailPage />} />
          <Route path="factory/*" element={<ExternalRedirect to="https://factory.yearn.fi" />} />
        </Route>

        {/* V3 routes */}
        <Route path="/v3" element={<V3Page />} />
        <Route path="/v3/about" element={<V3AboutPage />} />
        <Route path="/v3/:chainID/:address" element={<V3DetailPage />} />
        {/* Redirect /v3/:chainId without address to /v3 */}
        <Route path="/v3/:chainID" element={<Navigate to="/v3" replace />} />

        {/* Vaults Beta routes */}
        {isVaultsBetaEnabled && (
          <Route path="/vaults-beta">
            <Route index element={<VaultsBetaPage />} />
            <Route path=":chainID/:address" element={<VaultsBetaDetailPage />} />
            <Route path="search/:query" element={<VaultsBetaSearchPage />} />
          </Route>
        )}

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
