import type { CSSProperties, ReactNode } from 'react'

type FixedHeightChartContainerProps = {
  children: ReactNode
  className?: string
}

export function FixedHeightChartContainer({ children, className = '' }: FixedHeightChartContainerProps) {
  return (
    <div className={`${className} relative h-[150px] md:h-[300px]`}>
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
