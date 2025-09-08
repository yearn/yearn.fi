import { useEffect, useState } from 'react'

/**
 * Detects if the primary input is coarse (touch) or lacks hover capability.
 * Used to switch tooltip behavior to tap/popover on mobile.
 */
export function useIsCoarsePointer(): boolean {
  const [isCoarse, setIsCoarse] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia === 'undefined') return
    const mq = window.matchMedia('(hover: none), (pointer: coarse)')
    const update = (): void => setIsCoarse(mq.matches)
    update()
    mq.addEventListener?.('change', update)
    return () => mq.removeEventListener?.('change', update)
  }, [])

  return isCoarse
}

