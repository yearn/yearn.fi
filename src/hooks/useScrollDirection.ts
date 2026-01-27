import { useEffect, useRef, useState } from 'react'

export type TScrollDirection = 'up' | 'down' | null

type UseScrollDirectionOptions = {
  threshold?: number
  topThreshold?: number
}

export function useScrollDirection(options: UseScrollDirectionOptions = {}): TScrollDirection {
  const { threshold = 10, topThreshold = 50 } = options
  const [direction, setDirection] = useState<TScrollDirection>(null)
  const lastScrollY = useRef(0)
  const accumulatedDelta = useRef(0)

  useEffect(() => {
    if (typeof window === 'undefined') return

    let rafId = 0

    const updateDirection = (): void => {
      const scrollY = window.scrollY

      // Always show buttons when at top of page
      if (scrollY <= topThreshold) {
        setDirection(null)
        lastScrollY.current = scrollY
        accumulatedDelta.current = 0
        return
      }

      const delta = scrollY - lastScrollY.current

      // Accumulate scroll delta in the same direction
      if ((delta > 0 && accumulatedDelta.current >= 0) || (delta < 0 && accumulatedDelta.current <= 0)) {
        accumulatedDelta.current += delta
      } else {
        // Direction changed, reset accumulator
        accumulatedDelta.current = delta
      }

      // Only change direction when threshold is exceeded
      if (accumulatedDelta.current > threshold) {
        setDirection('down')
        accumulatedDelta.current = 0
      } else if (accumulatedDelta.current < -threshold) {
        setDirection('up')
        accumulatedDelta.current = 0
      }

      lastScrollY.current = scrollY
    }

    const onScroll = (): void => {
      cancelAnimationFrame(rafId)
      rafId = window.requestAnimationFrame(updateDirection)
    }

    lastScrollY.current = window.scrollY
    window.addEventListener('scroll', onScroll, { passive: true })

    return (): void => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', onScroll)
    }
  }, [threshold, topThreshold])

  return direction
}
