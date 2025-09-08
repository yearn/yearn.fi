import { APPS, AppName, type TManifest } from '@lib/components/Apps'
import type { TMenu } from '@lib/components/Header'
import type { TDict } from '@lib/types'
import { VaultsHeader } from '@vaults-v2/components/header/VaultsHeader'
import landingManifest from '@lib/data/landing-manifest.json'
import homeManifest from '@lib/data/home-manifest.json'
import type { ReactElement } from 'react'
import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'

type TCurrentApp = {
  name: AppName | 'Home' | string
  manifest: TManifest
  header?: ReactElement
  menu: TMenu[]
}

export function useCurrentApp(): TCurrentApp {
  const location = useLocation()
  const pathname = location.pathname

  return useMemo((): TCurrentApp => {
    const appMapping: TDict<TCurrentApp> = {
      '/v3': {
        ...APPS[AppName.VAULTSV3],
        header: <VaultsHeader pathname={pathname} />
      },
      '/vaults': {
        ...APPS[AppName.VAULTS],
        header: <VaultsHeader pathname={pathname} />
      },
      '/landing': {
        name: 'Home',
        manifest: landingManifest,
        menu: []
      }
    }

    const currentApp = Object.keys(appMapping).find((path): boolean => pathname.startsWith(path))
    if (currentApp) {
      return appMapping[currentApp]
    }
    return { name: 'Home', manifest: homeManifest, menu: [] }
  }, [pathname])
}