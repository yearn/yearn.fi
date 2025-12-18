import type { ReactNode } from 'react'

type FixedHeightChartContainerProps = {
  children: ReactNode
  className?: string
}

export function FixedHeightChartContainer({ children, className = '' }: FixedHeightChartContainerProps) {
  return (
    <div className={`${className} relative h-[150px] md:h-[300px]`}>
      <div className={'absolute inset-0'}>
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
