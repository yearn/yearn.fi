import homeManifest from '@lib/data/home-manifest.json'
import landingManifest from '@lib/data/landing-manifest.json'
import vaultsManifest from '@lib/data/vaults-manifest.json'
import type { TDict } from '@lib/types'
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
    const appMapping: TDict<TCurrentApp> = {
      '/vaults': {
        name: 'Vaults',
        manifest: vaultsManifest
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
    return { name: 'Home', manifest: homeManifest }
  }, [pathname])
}
