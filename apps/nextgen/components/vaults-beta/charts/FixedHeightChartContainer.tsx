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
  return (
    <div
      className={`${className} relative h-[var(--chart-height)] md:h-[var(--chart-height-md)]`}
      style={
        {
          '--chart-height': `${heightPx}px`,
          '--chart-height-md': `${heightMdPx}px`
        } as CSSProperties
      }
    >
      <div
        className={'absolute inset-0'}
        style={
          {
            '--chart-1': '#2578ff',
            '--chart-2': '#46a2ff',
            '--chart-3': '#94adf2',
            '--chart-4': '#b0b5bf'
          } as CSSProperties
        }
      >
        <div className={'h-full w-full'}>
          <style>{`
            .aspect-video {
              aspect-ratio: auto !important;
              height: 100% !important;
            }
          `}</style>
          {children}
        </div>
      </div>
    </div>
  )
}
