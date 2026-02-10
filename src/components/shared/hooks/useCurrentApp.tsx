import landingManifest from '@shared/data/landing-manifest.json'
import vaultsManifest from '@shared/data/vaults-manifest.json'
import { getPartnerConfig } from '@shared/partners/registry'
import { resolvePartnerFromPath } from '@shared/partners/resolvePartnerFromPath'
import type { TDict } from '@shared/types'
import { useMemo } from 'react'
import { useLocation } from 'react-router'

type TCurrentApp = {
  name: 'Home' | 'Vaults' | string
  manifest: TManifest
}

export type TManifest = {
  name?: string
  short_name?: string
  description?: string
  iconPath?: string
  locale?: string
  uri?: string
  canonical?: string
  og?: string
  twitter?: string
  github?: string
  icons?: { src: string; sizes: string; type: string; purpose?: string }[]
  theme_color?: string
  background_color?: string
  title_color?: string
  start_url?: string
  display?: string
  orientation?: string
}

export function useCurrentApp(): TCurrentApp {
  const location = useLocation()
  const pathname = location.pathname

  return useMemo((): TCurrentApp => {
    const partnerSlug = resolvePartnerFromPath(pathname)
    if (partnerSlug) {
      const partnerConfig = getPartnerConfig(partnerSlug)
      if (partnerConfig) {
        return {
          name: partnerConfig.displayName,
          manifest: partnerConfig.manifest
        }
      }
    }

    const appMapping: TDict<TCurrentApp> = {
      '/vaults': {
        name: 'Vaults',
        manifest: vaultsManifest
      },
      '/partners': {
        name: 'Partners',
        manifest: {
          ...vaultsManifest,
          name: 'Yearn Partners',
          description: 'Explore partner-specific Yearn vault pages.',
          uri: 'https://yearn.fi/partners',
          canonical: 'https://yearn.fi/partners'
        }
      },
      '/landing': {
        name: 'Home',
        manifest: landingManifest
      }
    }

    const currentApp = Object.keys(appMapping).find((path): boolean => pathname.startsWith(path))
    if (currentApp) {
      return appMapping[currentApp]
    }
    return { name: 'Vaults', manifest: vaultsManifest }
  }, [pathname])
}
