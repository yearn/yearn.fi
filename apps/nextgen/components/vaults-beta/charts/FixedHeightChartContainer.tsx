import type { ReactNode } from 'react'

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
    <div className={`${className} relative h-[${heightPx}px] md:h-[${heightMdPx}px]`}>
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
