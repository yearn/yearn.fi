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
  rootMargin?: string
  threshold?: number | number[]
  enabled?: boolean
}

export function useScrollSpy<Key extends string>({
  sections,
  activeKey,
  onActiveKeyChange,
  rootMargin = '0px',
  threshold = 0,
  enabled = true
}: UseScrollSpyOptions<Key>): void {
  const activeKeyRef = useRef<Key | undefined>(activeKey)

  useEffect(() => {
    activeKeyRef.current = activeKey
  }, [activeKey])

  useEffect(() => {
    if (!enabled || sections.length === 0) return
    if (typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        const candidates = entries
          .map((entry) => {
            const target = entry.target as HTMLElement
            const key = target.dataset.scrollSpyKey as Key | undefined
            if (!key) return null
            return {
              key,
              isIntersecting: entry.isIntersecting,
              top: entry.boundingClientRect.top
            }
          })
          .filter(Boolean) as ScrollSpyCandidate<Key>[]

        const nextKey = pickActiveScrollSpyKey(candidates, activeKeyRef.current)
        if (nextKey && nextKey !== activeKeyRef.current) {
          onActiveKeyChange(nextKey)
        }
      },
      { rootMargin, threshold }
    )

    sections.forEach((section) => {
      if (section.ref.current) {
        observer.observe(section.ref.current)
      }
    })

    return () => observer.disconnect()
  }, [enabled, onActiveKeyChange, rootMargin, sections, threshold])

  useEffect(() => {
    if (!enabled || sections.length === 0) return
    if (typeof window === 'undefined') return

    const handleScroll = (): void => {
      const scrollTop = window.scrollY || window.pageYOffset
      const scrollHeight = Math.max(document.documentElement?.scrollHeight ?? 0, document.body?.scrollHeight ?? 0)
      const lastSection = sections[sections.length - 1]
      const lastElement = lastSection?.ref.current
      const lastHeight = lastElement?.offsetHeight ?? lastElement?.getBoundingClientRect?.().height ?? 0
      const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0
      if (scrollHeight <= viewportHeight) return

      const bottomThreshold = Math.max(lastHeight, 1)
      const distanceFromBottom = scrollHeight - (scrollTop + viewportHeight)
      const isNearBottom = distanceFromBottom <= bottomThreshold

      const lastKey = lastSection?.key
      const previousKey = sections[sections.length - 2]?.key

      if (isNearBottom) {
        if (lastKey && lastKey !== activeKeyRef.current) {
          onActiveKeyChange(lastKey)
        }
        return
      }

      if (lastKey && previousKey && activeKeyRef.current === lastKey) {
        onActiveKeyChange(previousKey)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => window.removeEventListener('scroll', handleScroll)
  }, [enabled, onActiveKeyChange, sections])
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
