import type { ReactElement } from 'react'
import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

// Lazy load all page components, and expose loaders for prefetching
export const loadHomePage = () => import('../pages/index')
export const loadAppsPage = () => import('../pages/apps/index')
export const loadVaultsPage = () => import('../pages/vaults/index')
export const loadVaultsAboutPage = () => import('../pages/vaults/about')
export const loadVaultsDetailPage = () => import('../pages/vaults/[chainID]/[address]')
export const loadV3Page = () => import('../pages/v3/index')
export const loadV3AboutPage = () => import('../pages/v3/about')
export const loadV3DetailPage = () => import('../pages/v3/[chainID]/[address]')
export const loadVaultsBetaPage = () => import('../pages/vaults-beta/index')
export const loadVaultsBetaSearchPage = () => import('../pages/vaults-beta/search/[query]')

const HomePage = lazy(loadHomePage)
const AppsPage = lazy(loadAppsPage)
const VaultsPage = lazy(loadVaultsPage)
const VaultsAboutPage = lazy(loadVaultsAboutPage)
const VaultsDetailPage = lazy(loadVaultsDetailPage)
const V3Page = lazy(loadV3Page)
const V3AboutPage = lazy(loadV3AboutPage)
const V3DetailPage = lazy(loadV3DetailPage)
const VaultsBetaPage = lazy(loadVaultsBetaPage)
const VaultsBetaSearchPage = lazy(loadVaultsBetaSearchPage)

// Prefetch helper for internal routes. Import in Link to warm chunks.
export function preloadRoute(pathname: string): void {
  // Normalize and strip trailing slashes
  const p = pathname.replace(/\/$/, '')
  try {
    if (p === '' || p === '/') return void loadHomePage()
    if (p === '/apps') return void loadAppsPage()
    if (p === '/vaults') return void loadVaultsPage()
    if (p === '/vaults/about') return void loadVaultsAboutPage()
    if (p.startsWith('/vaults/')) return void loadVaultsDetailPage()
    if (p === '/v3') return void loadV3Page()
    if (p === '/v3/about') return void loadV3AboutPage()
    if (p.startsWith('/v3/')) return void loadV3DetailPage()
    if (p === '/vaults-beta') return void loadVaultsBetaPage()
    if (p.startsWith('/vaults-beta/search/')) return void loadVaultsBetaSearchPage()
  } catch {
    // Best-effort prefetch; ignore failures
  }
}

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
        <Route path="/vaults-beta">
          <Route index element={<VaultsBetaPage />} />
          <Route path="search/:query" element={<VaultsBetaSearchPage />} />
        </Route>

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
