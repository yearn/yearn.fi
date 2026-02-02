import { cl } from '@shared/utils'
import type { CSSProperties, ReactNode } from 'react'

type FixedHeightChartContainerProps = {
  children: ReactNode
  className?: string
  heightPx?: number
  heightMdPx?: number
}

export function FixedHeightChartContainer({
  children,
  className = '',
  heightPx = 150,
  heightMdPx = heightPx
}: FixedHeightChartContainerProps) {
  const heightVars = {
    '--chart-height': `${heightPx}px`,
    '--chart-height-md': `${heightMdPx}px`
  } as CSSProperties

  return (
    <div
      className={cl(
        'fixed-height-chart-container relative h-[var(--chart-height)] md:h-[var(--chart-height-md)]',
        className
      )}
      style={heightVars}
    >
      <div className={'absolute inset-0 overflow-visible'}>
        <div className={'h-full w-full overflow-visible'}>
          <style>{`
            .fixed-height-chart-container .aspect-video {
              aspect-ratio: auto !important;
              height: 100% !important;
            }
            .fixed-height-chart-container .recharts-tooltip-wrapper {
              overflow: visible !important;
            }
          `}</style>
          {children}
        </div>
      </div>
    </div>
  )
}
