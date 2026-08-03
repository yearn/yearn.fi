import type { ReactElement, SVGProps } from 'react'
import { ICON_MODULES } from './iconRegistry'

export type TIconProps = SVGProps<SVGSVGElement> & {
  color?: string
  back?: string
  front?: string
  gradient?: { start: string; end: string }
}

export type TIconEntry = {
  key: string
  name: string
  path: string
  displayPath: string
  Component: (props: TIconProps) => ReactElement
}

export type TPublicIconAsset = {
  name: string
  path: string
  src: string
}

export type TUsageMap = Record<string, string[]>

export const BROKEN_ASSET_NOTES: Record<string, string> = {
  'public/yearn-logo.svg': 'Broken: file is empty.',
  'public/v3Mark.svg': 'Broken: SVG contains JSX syntax.'
}

export const ICON_OVERRIDES: Record<string, { note: string; props?: Partial<TIconProps>; forceFill?: boolean }> = {
  IconExpand: { note: 'Override: forced fill for visibility.', forceFill: true },
  IconMinimize: { note: 'Override: forced fill for visibility.', forceFill: true },
  LogoYearn: {
    note: 'Override: front/back colors set for contrast.',
    props: { back: 'text-neutral-900', front: 'text-neutral-0' }
  }
}

export const DUPLICATE_GROUPS = [
  {
    id: 'close',
    label: 'Duplicate: close icon',
    tone: 'primary',
    members: new Set(['CloseIcon', 'IconClose', 'IconCross'])
  }
]

export const DUPLICATE_TONE_CLASS: Record<string, string> = {
  primary: 'border-amber-300/70 bg-amber-50/60',
  secondary: 'border-fuchsia-300/70 bg-fuchsia-50/60'
}

export const PUBLIC_ICON_ASSETS: TPublicIconAsset[] = [
  {
    name: 'GitBook - Icon - Dark.svg',
    path: 'public/GitBook - Icon - Dark.svg',
    src: '/GitBook%20-%20Icon%20-%20Dark.svg'
  },
  {
    name: 'discourse-icon.svg',
    path: 'public/discourse-icon.svg',
    src: '/discourse-icon.svg'
  },
  {
    name: '3d-logo-bw.png',
    path: 'public/3d-logo-bw.png',
    src: '/3d-logo-bw.png'
  },
  {
    name: '3d-logo.png',
    path: 'public/3d-logo.png',
    src: '/3d-logo.png'
  },
  {
    name: 'bearn-logo.png',
    path: 'public/bearn-logo.png',
    src: '/bearn-logo.png'
  },
  {
    name: 'factory-icon.svg',
    path: 'public/factory-icon.svg',
    src: '/factory-icon.svg'
  },
  {
    name: 'logo.svg',
    path: 'public/logo.svg',
    src: '/logo.svg'
  },
  {
    name: 'naughty-yearn-typemark-1.svg',
    path: 'public/naughty-yearn-typemark-1.svg',
    src: '/naughty-yearn-typemark-1.svg'
  },
  {
    name: 'resupply-logo.svg',
    path: 'public/resupply-logo.svg',
    src: '/resupply-logo.svg'
  },
  {
    name: 'v2.png',
    path: 'public/v2.png',
    src: '/v2.png'
  },
  {
    name: 'v3.png',
    path: 'public/v3.png',
    src: '/v3.png'
  },
  {
    name: 'v3Mark.svg',
    path: 'public/v3Mark.svg',
    src: '/v3Mark.svg'
  },
  {
    name: 'yearn-logo-text.svg',
    path: 'public/yearn-logo-text.svg',
    src: '/yearn-logo-text.svg'
  },
  {
    name: 'yearn-logo.svg',
    path: 'public/yearn-logo.svg',
    src: '/yearn-logo.svg'
  },
  {
    name: 'yearn-text.svg',
    path: 'public/yearn-text.svg',
    src: '/yearn-text.svg'
  },
  {
    name: 'yearn-typemark.svg',
    path: 'public/yearn-typemark.svg',
    src: '/yearn-typemark.svg'
  },
  {
    name: 'favicon.ico',
    path: 'public/favicon.ico',
    src: '/favicon.ico'
  },
  {
    name: 'android-icon-36x36.png',
    path: 'public/favicons/android-icon-36x36.png',
    src: '/favicons/android-icon-36x36.png'
  },
  {
    name: 'android-icon-48x48.png',
    path: 'public/favicons/android-icon-48x48.png',
    src: '/favicons/android-icon-48x48.png'
  },
  {
    name: 'android-icon-72x72.png',
    path: 'public/favicons/android-icon-72x72.png',
    src: '/favicons/android-icon-72x72.png'
  },
  {
    name: 'android-icon-96x96.png',
    path: 'public/favicons/android-icon-96x96.png',
    src: '/favicons/android-icon-96x96.png'
  },
  {
    name: 'android-icon-144x144.png',
    path: 'public/favicons/android-icon-144x144.png',
    src: '/favicons/android-icon-144x144.png'
  },
  {
    name: 'android-icon-192x192.png',
    path: 'public/favicons/android-icon-192x192.png',
    src: '/favicons/android-icon-192x192.png'
  },
  {
    name: 'android-icon-512x512.png',
    path: 'public/favicons/android-icon-512x512.png',
    src: '/favicons/android-icon-512x512.png'
  },
  {
    name: 'apple-icon.png',
    path: 'public/favicons/apple-icon.png',
    src: '/favicons/apple-icon.png'
  },
  {
    name: 'apple-icon-57x57.png',
    path: 'public/favicons/apple-icon-57x57.png',
    src: '/favicons/apple-icon-57x57.png'
  },
  {
    name: 'apple-icon-60x60.png',
    path: 'public/favicons/apple-icon-60x60.png',
    src: '/favicons/apple-icon-60x60.png'
  },
  {
    name: 'apple-icon-72x72.png',
    path: 'public/favicons/apple-icon-72x72.png',
    src: '/favicons/apple-icon-72x72.png'
  },
  {
    name: 'apple-icon-76x76.png',
    path: 'public/favicons/apple-icon-76x76.png',
    src: '/favicons/apple-icon-76x76.png'
  },
  {
    name: 'apple-icon-114x114.png',
    path: 'public/favicons/apple-icon-114x114.png',
    src: '/favicons/apple-icon-114x114.png'
  },
  {
    name: 'apple-icon-120x120.png',
    path: 'public/favicons/apple-icon-120x120.png',
    src: '/favicons/apple-icon-120x120.png'
  },
  {
    name: 'apple-icon-144x144.png',
    path: 'public/favicons/apple-icon-144x144.png',
    src: '/favicons/apple-icon-144x144.png'
  },
  {
    name: 'apple-icon-152x152.png',
    path: 'public/favicons/apple-icon-152x152.png',
    src: '/favicons/apple-icon-152x152.png'
  },
  {
    name: 'apple-icon-180x180.png',
    path: 'public/favicons/apple-icon-180x180.png',
    src: '/favicons/apple-icon-180x180.png'
  },
  {
    name: 'apple-icon-precomposed.png',
    path: 'public/favicons/apple-icon-precomposed.png',
    src: '/favicons/apple-icon-precomposed.png'
  },
  {
    name: 'favicon-16x16.png',
    path: 'public/favicons/favicon-16x16.png',
    src: '/favicons/favicon-16x16.png'
  },
  {
    name: 'favicon-32x32.png',
    path: 'public/favicons/favicon-32x32.png',
    src: '/favicons/favicon-32x32.png'
  },
  {
    name: 'favicon-96x96.png',
    path: 'public/favicons/favicon-96x96.png',
    src: '/favicons/favicon-96x96.png'
  },
  {
    name: 'favicon.ico',
    path: 'public/favicons/favicon.ico',
    src: '/favicons/favicon.ico'
  },
  {
    name: 'favicon.svg',
    path: 'public/favicons/favicon.svg',
    src: '/favicons/favicon.svg'
  },
  {
    name: 'ms-icon-70x70.png',
    path: 'public/favicons/ms-icon-70x70.png',
    src: '/favicons/ms-icon-70x70.png'
  },
  {
    name: 'ms-icon-144x144.png',
    path: 'public/favicons/ms-icon-144x144.png',
    src: '/favicons/ms-icon-144x144.png'
  },
  {
    name: 'ms-icon-150x150.png',
    path: 'public/favicons/ms-icon-150x150.png',
    src: '/favicons/ms-icon-150x150.png'
  },
  {
    name: 'ms-icon-310x310.png',
    path: 'public/favicons/ms-icon-310x310.png',
    src: '/favicons/ms-icon-310x310.png'
  }
]

export const normalizePath = (path: string): string => (path.startsWith('/src/') ? `src/${path.slice(5)}` : path)

export const ICON_ENTRIES: TIconEntry[] = Object.entries(ICON_MODULES)
  .flatMap(([path, module]) =>
    Object.entries(module)
      .filter(([, value]) => typeof value === 'function')
      .map(([name, Component]) => ({
        key: `${path}:${name}`,
        name,
        path,
        displayPath: normalizePath(path),
        Component: Component as TIconEntry['Component']
      }))
  )
  .sort((a, b) => a.path.localeCompare(b.path) || a.name.localeCompare(b.name))

export function getIconProps(name: string, override?: Partial<TIconProps>, forceFill?: boolean): TIconProps {
  const lower = name.toLowerCase()
  const baseClass = lower.includes('typemark') || lower.includes('logo') ? 'h-6 w-auto' : 'size-6'
  const className = forceFill ? `${baseClass} icon-force-fill` : baseClass

  if (lower.includes('typemark')) {
    return { className, ...override }
  }
  if (lower.includes('logo')) {
    return { className, ...override }
  }
  return { className, ...override }
}
