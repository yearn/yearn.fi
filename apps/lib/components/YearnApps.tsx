import { LogoGimme } from '@lib/icons/LogoGimme'
import type { ReactElement } from 'react'
import Image from '/src/components/Image'

import { LogoYearn } from '../icons/LogoYearn'

const BASE_YEARN_ASSET_URI = import.meta.env?.VITE_BASE_YEARN_ASSETS_URI ?? ''

type TColorProps = {
  front?: string
  back?: string
  gradient?: { start: string; end: string }
}

function yearnGlyph(colorProps: TColorProps = {}): ReactElement {
  return (
    <LogoYearn
      className={'size-10! max-h-10! max-w-10!'}
      front={colorProps.front}
      back={colorProps.back}
      gradient={colorProps.gradient}
    />
  )
}

export type TAppTile = {
  name: string
  href: string
  description?: string
  icon?: ReactElement
  hosts?: string[]
  pathnames?: string[]
}

export type TAppGroup = {
  title: string
  items: TAppTile[]
}

const CORE_APPS: TAppTile[] = [
  {
    name: 'V3 Vaults',
    href: '/v3',
    description: 'Single asset vaults',
    icon: yearnGlyph({ gradient: { start: '#FB245A', end: '#0657F9' } }),
    pathnames: ['/v3'],
    hosts: ['yearn.fi']
  },
  {
    name: 'V2 Vaults',
    href: '/vaults',
    description: 'LP and Factory Vaults',
    icon: yearnGlyph({ back: 'text-[#f472b6]', front: 'text-white' }),
    pathnames: ['/vaults'],
    hosts: ['yearn.fi']
  },
  {
    name: 'yCRV',
    href: 'https://ycrv.yearn.fi',
    description: 'CRV Liquid Locker',
    icon: (
      <Image
        alt={'yCRV'}
        className={'size-10! max-h-10! max-w-10!'}
        width={64}
        height={64}
        src={`${BASE_YEARN_ASSET_URI}/tokens/1/0xfcc5c47be19d06bf83eb04298b026f81069ff65b/logo-128.png`}
        loading={'eager'}
        priority
      />
    ),
    hosts: ['ycrv.yearn.fi']
  },
  {
    name: 'veYFI',
    href: 'https://veyfi.yearn.fi',
    description: 'Lock YFI & vote',
    icon: (
      <Image
        alt={'veYFI'}
        className={'size-10! max-h-10! max-w-10!'}
        width={64}
        height={64}
        src={`${BASE_YEARN_ASSET_URI}/tokens/1/0x41252e8691e964f7de35156b68493bab6797a275/logo-128.png`}
        loading={'eager'}
        priority
      />
    ),
    hosts: ['veyfi.yearn.fi']
  },
  {
    name: 'yETH',
    href: 'https://yeth.yearn.fi',
    description: 'ETH LST Aggregator',
    icon: (
      <Image
        alt={'yETH'}
        className={'size-10! max-h-10! max-w-10!'}
        width={64}
        height={64}
        src={`${BASE_YEARN_ASSET_URI}/tokens/1/0x1bed97cbc3c24a4fb5c069c6e311a967386131f7/logo-128.png`}
        loading={'eager'}
        priority
      />
    ),
    hosts: ['yeth.yearn.fi']
  },
  {
    name: 'YearnX',
    href: 'https://yearn.space',
    description: 'Yearn Partner Pages',
    icon: yearnGlyph({ gradient: { start: '#3b82f6', end: '#9333ea' } }),
    hosts: ['yearn.space']
  },
  {
    name: 'Vaults Beta',
    href: '/vaults-beta',
    description: 'Experimental site',
    icon: yearnGlyph({ back: 'text-white', front: 'text-blue-500' }),
    pathnames: ['/vaults-beta'],
    hosts: ['yearn.fi']
  },
  {
    name: 'Landing Page',
    href: '/',
    description: 'Learn about Yearn',
    icon: yearnGlyph({ gradient: { start: '#1E40AF', end: '#0EA5E9' } }),
    pathnames: ['/']
  }
]

const TOOLS: TAppTile[] = [
  {
    name: 'PowerGlove',
    href: 'https://powerglove.yearn.fi',
    description: 'Analytics',
    icon: yearnGlyph({ back: 'text-neutral-100', front: 'text-primary' }),
    hosts: ['powerglove.yearn.fi']
  },
  {
    name: 'Seafood',
    href: 'https://seafood.yearn.watch',
    description: 'Legacy dashboards',
    icon: yearnGlyph({ back: 'text-[#14b8a6]', front: 'text-[#0f172a]' }),
    hosts: ['seafood.yearn.watch']
  },
  {
    name: 'APR Oracle',
    href: 'https://oracle.yearn.fi',
    description: 'Query APY oracles',
    icon: yearnGlyph({ back: 'text-[#6366F1]', front: 'text-white' }),
    hosts: ['oracle.yearn.fi']
  },
  {
    name: 'Kong',
    href: 'https://kong.yearn.fi',
    description: 'Yearn Indexer',
    icon: yearnGlyph({ back: 'text-[#312e81]', front: 'text-[#fbbf24]' }),
    hosts: ['kong.yearn.fi']
  },
  {
    name: 'yFactory',
    href: 'https://factory.yearn.fi',
    description: 'Deploy vaults',
    icon: yearnGlyph({ back: 'text-neutral-0', front: 'text-neutral-900' }),
    hosts: ['factory.yearn.fi']
  },
  {
    name: 'yCMS',
    href: 'https://cms.yearn.fi',
    description: 'Vault metadata',
    icon: yearnGlyph({ back: 'text-neutral-900', front: 'text-neutral-0' }),
    hosts: ['cms.yearn.fi']
  },
  {
    name: 'Brand Assets',
    href: 'https://brand.yearn.fi',
    description: 'Yearn Brand Resources',
    icon: yearnGlyph({ back: 'text-[#0F172A]', front: 'text-[#38BDF8]' }),
    hosts: ['brand.yearn.fi']
  },
  {
    name: 'Token Assets',
    href: 'https://token-assets.yearn.fi',
    description: 'Token asset tools',
    icon: yearnGlyph({ back: 'text-[#0F172A]', front: 'text-[#38BDF8]' }),
    hosts: ['token-assets.yearn.fi']
  }
]

const RESOURCES: TAppTile[] = [
  {
    name: 'Docs',
    href: 'https://docs.yearn.fi/',
    description: 'Guides & references',
    icon: yearnGlyph({ back: 'text-[#0ea5e9]', front: 'text-white' })
  },
  {
    name: 'Support',
    href: 'https://discord.gg/yearn',
    description: 'Yearn Discord',
    icon: yearnGlyph({ back: 'text-[#0f172a]', front: 'text-[#38bdf8]' })
  },
  {
    name: 'Blog',
    href: 'https://blog.yearn.fi/',
    description: 'Product updates',
    icon: yearnGlyph({ back: 'text-[#1f2937]', front: 'text-[#fde68a]' })
  },
  {
    name: 'Discourse',
    href: 'https://gov.yearn.fi/',
    description: 'Governance forum',
    icon: yearnGlyph({ back: 'text-[#1e3a8a]', front: 'text-[#facc15]' })
  }
]

const DEPRECATED: TAppTile[] = [
  {
    name: 'yPrisma',
    href: 'https://yprisma.yearn.fi',
    description: 'Liquidity for Prisma',
    icon: (
      <Image
        alt={'yPrisma'}
        className={'size-10! max-h-10! max-w-10!'}
        width={64}
        height={64}
        src={`${BASE_YEARN_ASSET_URI}/tokens/1/0xe3668873d944e4a949da05fc8bde419eff543882/logo-128.png`}
        loading={'eager'}
        priority
      />
    ),
    hosts: ['yprisma.yearn.fi']
  },
  {
    name: 'GIMME',
    href: 'https://gimme.mom',
    description: 'Easy Mode',
    icon: <LogoGimme className={'size-10! max-h-10! max-w-10!'} />,
    hosts: ['gimme.mom']
  }
]

export const APP_GROUPS: TAppGroup[] = [
  {
    title: 'Apps',
    items: CORE_APPS
  },
  {
    title: 'Analytics and Tools',
    items: TOOLS
  },
  {
    title: 'Resources',
    items: RESOURCES
  },
  {
    title: 'Deprecated Projects',
    items: DEPRECATED
  }
]
