import { cl } from '@shared/utils'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

type TOverflowMarqueeTextProps = {
  children: ReactNode
  className?: string
}

type TMarqueeStyle = CSSProperties & {
  '--token-marquee-distance': string
  '--token-marquee-duration': string
}

function getMarqueeDuration(distance: number): string {
  return `${Math.min(14, Math.max(8, 6 + distance / 24))}s`
}

export function OverflowMarqueeText({ children, className }: TOverflowMarqueeTextProps): ReactElement {
  const viewportRef = useRef<HTMLSpanElement>(null)
  const contentRef = useRef<HTMLSpanElement>(null)
  const [overflowDistance, setOverflowDistance] = useState(0)

  // ResizeObserver is the only reliable way to animate exactly the clipped text distance.
  useEffect(() => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content) return

    const measureOverflow = (): void => {
      setOverflowDistance(Math.max(0, content.scrollWidth - viewport.clientWidth))
    }

    measureOverflow()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measureOverflow)
      return () => window.removeEventListener('resize', measureOverflow)
    }

    const observer = new ResizeObserver(measureOverflow)
    observer.observe(viewport)
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  const marqueeStyle: TMarqueeStyle = {
    '--token-marquee-distance': `${overflowDistance}px`,
    '--token-marquee-duration': getMarqueeDuration(overflowDistance)
  }

  return (
    <span ref={viewportRef} className={cl('min-w-0 flex-1 overflow-hidden whitespace-nowrap', className)}>
      <span
        ref={contentRef}
        className={cl('inline-block min-w-max', overflowDistance > 0 ? 'token-selector-marquee' : undefined)}
        style={marqueeStyle}
      >
        {children}
      </span>
    </span>
  )
}
