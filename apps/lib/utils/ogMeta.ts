import homeManifest from '../data/home-manifest.json'
import landingManifest from '../data/landing-manifest.json'
import vaultsManifest from '../data/vaults-manifest.json'

export type Manifest = Partial<typeof homeManifest> & {
  twitter?: string
  theme_color?: string
  title_color?: string
}

export type RouteMeta = {
  title: string
  description: string
  og: string
  uri: string
  themeColor: string
  twitterHandle: string
  titleColor: string
}

const OG_BASE_URL = 'https://og.yearn.fi'
const DEFAULT_ORIGIN = 'https://yearn.fi'
const DEFAULT_DESCRIPTION = "DeFi's Yield Aggregator."
const DEFAULT_TWITTER = '@yearnfi'

export function selectManifest(pathname: string): Manifest {
  if (pathname.startsWith('/landing')) {
    return landingManifest
  }
  if (pathname.startsWith('/v3') || pathname.startsWith('/vaults')) {
    return vaultsManifest
  }
  return homeManifest
}

export function resolveRouteMeta({
  pathname,
  manifest,
  origin
}: {
  pathname: string
  manifest: Manifest
  origin?: string
}): RouteMeta {
  const resolvedOrigin = origin ?? DEFAULT_ORIGIN
  const resolvedPath = normalisePath(pathname)

  const title = manifest.name ?? 'Yearn'
  const description = manifest.description ?? DEFAULT_DESCRIPTION
  const themeColor = manifest.theme_color ?? '#000000'
  const titleColor = manifest.title_color ?? '#ffffff'
  const twitterHandle = manifest.twitter ?? DEFAULT_TWITTER

  const manifestUri = manifest.uri ? replaceOrigin(manifest.uri, resolvedOrigin) : resolvedOrigin
  const manifestOg = manifest.og ? replaceOrigin(manifest.og, resolvedOrigin) : `${resolvedOrigin}/og.png`

  const { og, uri } = resolveDynamicRouteMeta({
    pathname: resolvedPath,
    origin: resolvedOrigin,
    manifestOg,
    manifestUri
  })

  return {
    title,
    description,
    og,
    uri,
    themeColor,
    twitterHandle,
    titleColor
  }
}

function resolveDynamicRouteMeta({
  pathname,
  origin,
  manifestOg,
  manifestUri
}: {
  pathname: string
  origin: string
  manifestOg: string
  manifestUri: string
}): { og: string; uri: string } {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 3 && (segments[0] === 'v3' || segments[0] === 'vaults')) {
    const [_, chainId, address] = segments
    if (chainId && address) {
      return {
        og: `${OG_BASE_URL}/api/og/yearn/vault/${chainId}/${address}`,
        uri: `${origin}${pathname}`
      }
    }
  }

  return {
    og: manifestOg,
    uri: manifestUri
  }
}

function replaceOrigin(url: string, origin: string): string {
  if (url.startsWith(DEFAULT_ORIGIN)) {
    return `${origin}${url.slice(DEFAULT_ORIGIN.length)}`
  }
  return url
}

function normalisePath(pathname: string): string {
  return pathname === '' ? '/' : pathname
}
