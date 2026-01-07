import { ImageWithFallback } from '@lib/components/ImageWithFallback'
import vaultsManifest from '@lib/data/vaults-manifest.json'
import { LogoYearn } from '@lib/icons/LogoYearn'
import { VAULTS_BETA_MENU, VAULTS_MENU } from '@vaults-v2/constants/menu'
import { VAULTS_V3_MENU } from '@vaults-v3/constants/menu'
import type { ReactElement } from 'react'
import Image from '/src/components/Image'
import type { TMenu } from './Header'

export enum AppName {
  VAULTSV3 = 'V3',
  VAULTS = 'Vaults',
  BETA = 'Beta',
  YCRV = 'yCRV',
  VEYFI = 'veYFI',
  YETH = 'yETH',
  YPRISMA = 'yPrisma',
  JUICED = 'Juiced',
  GIMME = 'Gimme'
}

export type TManifestIcon = {
  src: string
  sizes: string
  type: string
  purpose?: string
}

export interface TManifest {
  name?: string
  short_name?: string
  description?: string
  iconPath?: string
  locale?: string
  uri?: string
  og?: string
  twitter?: string
  github?: string
  icons?: TManifestIcon[]
  theme_color?: string
  background_color?: string
  title_color?: string
  start_url?: string
  display?: string
  orientation?: string
}

type TApp = {
  name: AppName | string
  href: string
  menu: TMenu[]
  manifest: TManifest
  icon: ReactElement
  isDisabled?: boolean
}

export const APPS: { [key in AppName]: TApp } = {
  V3: {
    name: AppName.VAULTSV3,
    href: '/vaults',
    menu: VAULTS_V3_MENU,
    manifest: vaultsManifest,
    isDisabled: false,
    icon: <LogoYearn className={'size-8'} back={'text-pink-400'} front={'text-white'} />
  },
  Juiced: {
    name: `${AppName.JUICED} Vaults`,
    href: 'https://juiced.yearn.fi',
    menu: [],
    manifest: {},
    icon: (
      <Image
        className={'size-8'}
        src={'/juiced.png'}
        width={64}
        height={64}
        alt={'juiced'}
        loading={'eager'}
        priority
      />
    )
  },
  Gimme: {
    name: `${AppName.GIMME} Vaults`,
    href: 'https://gimme.mom',
    menu: [],
    manifest: {},
    icon: (
      <Image className={'size-8'} src={'/gimme.png'} width={64} height={64} alt={'gimme'} loading={'eager'} priority />
    )
  },
  Vaults: {
    name: `${AppName.VAULTS} V2`,
    href: '/vaults?type=lp',
    menu: VAULTS_MENU,
    manifest: vaultsManifest,
    icon: <LogoYearn className={'size-8'} back={'text-pink-400'} front={'text-white'} />
  },
  Beta: {
    name: `${AppName.BETA} Vaults`,
    href: '/vaults-beta',
    menu: VAULTS_BETA_MENU,
    manifest: vaultsManifest,
    icon: <LogoYearn className={'size-8'} back={'text-primary'} front={'text-white'} />
  },
  veYFI: {
    name: AppName.VEYFI,
    menu: [],
    href: 'https://veyfi.yearn.fi',
    manifest: {},
    icon: (
      <ImageWithFallback
        alt={'veYFI'}
        className={'size-8'}
        width={64}
        height={64}
        src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/1/0x41252e8691e964f7de35156b68493bab6797a275/logo-128.png`}
        loading={'eager'}
        priority
      />
    )
  },
  yCRV: {
    name: AppName.YCRV,
    href: 'https://ycrv.yearn.fi',
    menu: [],
    manifest: {},
    icon: (
      <ImageWithFallback
        alt={'yCRV'}
        width={64}
        height={64}
        className={'size-8'}
        src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/1/0xfcc5c47be19d06bf83eb04298b026f81069ff65b/logo-128.png`}
        loading={'eager'}
        priority
      />
    )
  },
  yETH: {
    name: AppName.YETH,
    href: 'https://yeth.yearn.fi',
    menu: [],
    manifest: {},
    icon: (
      <ImageWithFallback
        alt={'yETH'}
        width={64}
        height={64}
        className={'size-8'}
        src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/1/0x1bed97cbc3c24a4fb5c069c6e311a967386131f7/logo-128.png`}
        loading={'eager'}
        priority
      />
    )
  },
  yPrisma: {
    name: AppName.YPRISMA,
    href: 'https://yPrisma.yearn.fi',
    menu: [],
    manifest: {},
    icon: (
      <ImageWithFallback
        alt={'yPrisma'}
        width={64}
        height={64}
        className={'size-8'}
        src={`${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/1/0xe3668873d944e4a949da05fc8bde419eff543882/logo-128.png`}
        loading={'eager'}
        priority
      />
    )
  }
}
