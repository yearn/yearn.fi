import { cl } from '@shared/utils'
import type { ReactElement } from 'react'
import { createElement } from 'react'
import Image from '/src/components/Image'
import {
  BROKEN_ASSET_NOTES,
  DUPLICATE_GROUPS,
  DUPLICATE_TONE_CLASS,
  getIconProps,
  ICON_ENTRIES,
  ICON_OVERRIDES,
  PUBLIC_ICON_ASSETS,
  type TUsageMap
} from './data'

export default function IconListPage({ usageMap }: { usageMap: TUsageMap }): ReactElement {
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
                    {(!usage || usage.length === 0) && (
                      <p className={'text-xs text-text-secondary'}>{'No imports found in src.'}</p>
                    )}
                    {usage && usage.length > 0 && (
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
                    {(!usage || usage.length === 0) && (
                      <p className={'text-xs text-text-secondary'}>{'No imports found in src.'}</p>
                    )}
                    {usage && usage.length > 0 && (
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
