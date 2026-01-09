import type { RefObject } from 'react'
import { useEffect, useRef } from 'react'

export type ScrollSpySection<Key extends string> = {
  key: Key
  ref: RefObject<HTMLElement | null>
}

type ScrollSpyCandidate<Key extends string> = {
  key: Key
  isIntersecting: boolean
  top: number
}

export type UseScrollSpyOptions<Key extends string> = {
  sections: ScrollSpySection<Key>[]
  activeKey: Key | undefined
  onActiveKeyChange: (key: Key) => void
  offsetTop?: number
  enabled?: boolean
}

export function useScrollSpy<Key extends string>({
  sections,
  activeKey,
  onActiveKeyChange,
  offsetTop = 0,
  enabled = true
}: UseScrollSpyOptions<Key>): void {
  const activeKeyRef = useRef<Key | undefined>(activeKey)

  useEffect(() => {
    activeKeyRef.current = activeKey
  }, [activeKey])

  useEffect(() => {
    if (!enabled || sections.length === 0) return
    if (typeof window === 'undefined') return

    let rafId = 0

    const updateActive = (): void => {
      const activationThreshold = 8
      const candidates = sections
        .map((section) => {
          const element = section.ref.current
          if (!element) return null
          const top = element.getBoundingClientRect().top - offsetTop
          return {
            key: section.key,
            isIntersecting: top <= activationThreshold,
            top
          }
        })
        .filter(Boolean) as ScrollSpyCandidate<Key>[]

      const nextKey = pickActiveScrollSpyKey(candidates, sections[0]?.key)
      if (nextKey && nextKey !== activeKeyRef.current) {
        onActiveKeyChange(nextKey)
      }
    }

    const onScroll = (): void => {
      cancelAnimationFrame(rafId)
      rafId = window.requestAnimationFrame(updateActive)
    }

    const onResize = (): void => {
      cancelAnimationFrame(rafId)
      rafId = window.requestAnimationFrame(updateActive)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    updateActive()

    return (): void => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [enabled, offsetTop, onActiveKeyChange, sections])
}

export function pickActiveScrollSpyKey<Key extends string>(
  candidates: ScrollSpyCandidate<Key>[],
  fallback?: Key
): Key | undefined {
  const intersecting = candidates.filter((candidate) => candidate.isIntersecting)
  if (intersecting.length === 0) return fallback

  let closest = intersecting[0]
  for (const candidate of intersecting.slice(1)) {
    if (Math.abs(candidate.top) < Math.abs(closest.top)) {
      closest = candidate
    }
  }

  return closest.key
}
