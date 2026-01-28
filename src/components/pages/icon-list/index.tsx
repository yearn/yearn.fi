import { cl } from '@shared/utils'
import type { ReactElement, SVGProps } from 'react'
import { createElement, useCallback, useEffect, useState } from 'react'
import Image from '/src/components/Image'

type TIconProps = SVGProps<SVGSVGElement> & {
  color?: string
  back?: string
  front?: string
  gradient?: { start: string; end: string }
}

type TIconEntry = {
  key: string
  name: string
  path: string
  displayPath: string
  Component: (props: TIconProps) => ReactElement
}

type TPublicIconAsset = {
  name: string
  path: string
  src: string
}

type TUsageMap = Record<string, string[]>

const ICON_MODULES = {
  ...import.meta.glob('/src/components/shared/icons/*.tsx', { eager: true }),
  ...import.meta.glob('/src/components/pages/**/Icons.tsx', { eager: true })
}

const SOURCE_MODULES = import.meta.glob('/src/**/*.{ts,tsx,css}', { as: 'raw' })

const BROKEN_ASSET_NOTES: Record<string, string> = {
  'public/yearn-logo.svg': 'Broken: file is empty.',
  'public/v3Mark.svg': 'Broken: SVG contains JSX syntax.'
}

const ICON_OVERRIDES: Record<string, { note: string; props?: Partial<TIconProps>; forceFill?: boolean }> = {
  IconExpand: { note: 'Override: forced fill for visibility.', forceFill: true },
  IconMinimize: { note: 'Override: forced fill for visibility.', forceFill: true },
  LogoYearn: {
    note: 'Override: front/back colors set for contrast.',
    props: { back: 'text-neutral-900', front: 'text-neutral-0' }
  }
}

const DUPLICATE_GROUPS = [
  {
    id: 'close',
    label: 'Duplicate: close icon',
    tone: 'primary',
    members: new Set(['CloseIcon', 'IconClose', 'IconCross'])
  }
]

const DUPLICATE_TONE_CLASS: Record<string, string> = {
  primary: 'border-amber-300/70 bg-amber-50/60',
  secondary: 'border-fuchsia-300/70 bg-fuchsia-50/60'
}

const PUBLIC_ICON_ASSETS: TPublicIconAsset[] = [
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

const normalizePath = (path: string): string => (path.startsWith('/src/') ? `src/${path.slice(5)}` : path)

const ICON_ENTRIES: TIconEntry[] = Object.entries(ICON_MODULES)
  .flatMap(([path, module]) => {
    const exports = module as Record<string, unknown>
    return Object.entries(exports)
      .filter(([, value]) => typeof value === 'function')
      .map(([name, Component]) => ({
        key: `${path}:${name}`,
        name,
        path,
        displayPath: normalizePath(path),
        Component: Component as TIconEntry['Component']
      }))
  })
  .sort((a, b) => a.path.localeCompare(b.path) || a.name.localeCompare(b.name))

function getIconProps(name: string, override?: Partial<TIconProps>, forceFill?: boolean): TIconProps {
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

function findMatches(sources: Record<string, string>, matchers: string[], excludePaths: string[]): string[] {
  return Object.entries(sources)
    .filter(([path]) => !excludePaths.includes(path))
    .filter(([, content]) => matchers.some((matcher) => content.includes(matcher)))
    .map(([path]) => normalizePath(path))
    .sort((a, b) => a.localeCompare(b))
}

export default function IconListPage(): ReactElement {
  const [usageMap, setUsageMap] = useState<TUsageMap>({})
  const [isLoadingUsage, setIsLoadingUsage] = useState(true)
  const [sourceCache, setSourceCache] = useState<Record<string, string> | null>(null)

  const loadSourceCache = useCallback(async (): Promise<Record<string, string>> => {
    if (sourceCache) return sourceCache
    const entries = await Promise.all(
      Object.entries(SOURCE_MODULES).map(async ([path, loader]) => [path, await loader()])
    )
    const nextCache = Object.fromEntries(entries) as Record<string, string>
    setSourceCache(nextCache)
    return nextCache
  }, [sourceCache])

  useEffect(() => {
    let isMounted = true

    const buildUsageMap = async (): Promise<void> => {
      setIsLoadingUsage(true)
      const sources = await loadSourceCache()
      if (!isMounted) return

      const nextMap: TUsageMap = {}

      ICON_ENTRIES.forEach((icon) => {
        const usageKey = `icon:${icon.key}`
        nextMap[usageKey] = findMatches(
          sources,
          [icon.name, `@shared/icons/${icon.name}`, `icons/${icon.name}`],
          ['/src/components/pages/icon-list/index.tsx', icon.path]
        )
      })

      PUBLIC_ICON_ASSETS.forEach((asset) => {
        const usageKey = `asset:${asset.path}`
        nextMap[usageKey] = findMatches(
          sources,
          [asset.name, asset.src, asset.src.replace(/^\//, '')],
          ['/src/components/pages/icon-list/index.tsx']
        )
      })

      setUsageMap(nextMap)
      setIsLoadingUsage(false)
    }

    void buildUsageMap()

    return () => {
      isMounted = false
    }
  }, [loadSourceCache])

  return (
    <div className={'min-h-[calc(100vh-var(--header-height))] w-full bg-app'}>
      <div className={'mx-auto w-full max-w-[1232px] px-4 py-12'}>
        <h1 className={'text-2xl font-semibold text-text-primary'}>{'Icon list'}</h1>
        <p className={'mt-2 text-sm text-text-secondary'}>
          {'Temporary route for auditing icon assets. Imports are scanned from src/*.ts(x) + src/*.css only.'}
        </p>
        <style>
          {
            '.icon-force-fill path { fill: #0f172a !important; fill-opacity: 1 !important; } .icon-force-fill line, .icon-force-fill rect { stroke: #0f172a !important; }'
          }
        </style>

        <div className={'mt-10'}>
          <h2 className={'text-sm font-semibold uppercase tracking-[0.2em] text-text-secondary'}>{'TSX icons'}</h2>
          <div className={'mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3'}>
            {ICON_ENTRIES.map((icon) => {
              const duplicateGroup = DUPLICATE_GROUPS.find((group) => group.members.has(icon.name))
              const duplicateClass = duplicateGroup ? DUPLICATE_TONE_CLASS[duplicateGroup.tone] : ''
              const override = ICON_OVERRIDES[icon.name]
              const usageKey = `icon:${icon.key}`
              const usage = usageMap[usageKey]
              const notes = [override?.note, duplicateGroup?.label].filter(Boolean)

              return (
                <div
                  key={icon.key}
                  className={cl(
                    'flex flex-col gap-3 rounded-2xl border px-4 py-3',
                    duplicateClass || 'border-border bg-surface'
                  )}
                >
                  <div className={'flex items-center gap-4'}>
                    <div
                      className={
                        'flex size-12 items-center justify-center rounded-xl border border-border bg-surface-secondary text-text-primary'
                      }
                    >
                      {createElement(icon.Component, getIconProps(icon.name, override?.props, override?.forceFill))}
                    </div>
                    <div className={'min-w-0 flex-1'}>
                      <p className={'truncate text-sm font-semibold text-text-primary'}>{icon.name}</p>
                      <p className={'truncate font-mono text-xs text-text-secondary'}>{icon.displayPath}</p>
                      {notes.length > 0 && <p className={'mt-1 text-xs text-text-secondary'}>{notes.join(' | ')}</p>}
                    </div>
                  </div>
                  <div className={'rounded-xl border border-border bg-surface-secondary px-3 py-2'}>
                    {isLoadingUsage && <p className={'text-xs text-text-secondary'}>{'Loading imports...'}</p>}
                    {!isLoadingUsage && usage && usage.length === 0 && (
                      <p className={'text-xs text-text-secondary'}>{'No imports found in src.'}</p>
                    )}
                    {!isLoadingUsage && usage && usage.length > 0 && (
                      <div className={'flex flex-col gap-1'}>
                        {usage.map((path) => (
                          <p key={path} className={'truncate font-mono text-xs text-text-secondary'}>
                            {path}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className={'mt-12'}>
          <h2 className={'text-sm font-semibold uppercase tracking-[0.2em] text-text-secondary'}>
            {'Public icons & logos'}
          </h2>
          <div className={'mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3'}>
            {PUBLIC_ICON_ASSETS.map((asset) => {
              const usageKey = `asset:${asset.path}`
              const usage = usageMap[usageKey]
              const brokenNote = BROKEN_ASSET_NOTES[asset.path]

              return (
                <div
                  key={asset.path}
                  className={cl(
                    'flex flex-col gap-3 rounded-2xl border px-4 py-3',
                    brokenNote ? 'border-red/50 bg-red/5' : 'border-border bg-surface'
                  )}
                >
                  <div className={'flex items-center gap-4'}>
                    <div
                      className={
                        'flex size-12 items-center justify-center rounded-xl border border-border bg-surface-secondary'
                      }
                    >
                      <Image src={asset.src} alt={asset.name} className={'max-h-8 max-w-8'} loading={'lazy'} />
                    </div>
                    <div className={'min-w-0 flex-1'}>
                      <p className={'truncate text-sm font-semibold text-text-primary'}>{asset.name}</p>
                      <p className={'truncate font-mono text-xs text-text-secondary'}>{asset.path}</p>
                      {brokenNote && <p className={'mt-1 text-xs text-red/80'}>{brokenNote}</p>}
                    </div>
                  </div>
                  <div className={'rounded-xl border border-border bg-surface-secondary px-3 py-2'}>
                    {isLoadingUsage && <p className={'text-xs text-text-secondary'}>{'Loading imports...'}</p>}
                    {!isLoadingUsage && usage && usage.length === 0 && (
                      <p className={'text-xs text-text-secondary'}>{'No imports found in src.'}</p>
                    )}
                    {!isLoadingUsage && usage && usage.length > 0 && (
                      <div className={'flex flex-col gap-1'}>
                        {usage.map((path) => (
                          <p key={path} className={'truncate font-mono text-xs text-text-secondary'}>
                            {path}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
