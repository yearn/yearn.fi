import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useRef, useState } from 'react'

type UseHeaderCompressionOptions = {
  enabled?: boolean
}

type UseHeaderCompressionReturn = {
  isCompressed: boolean
  setIsCompressed: Dispatch<SetStateAction<boolean>>
}

export function useHeaderCompression({ enabled = true }: UseHeaderCompressionOptions = {}): UseHeaderCompressionReturn {
  const [isCompressed, setIsCompressed] = useState(false)
  const isCompressedRef = useRef(isCompressed)
  const blockScrollUntilCompressedRef = useRef(true)
  const touchStartYRef = useRef<number | null>(null)

  useEffect(() => {
    isCompressedRef.current = isCompressed
  }, [isCompressed])

  useEffect(() => {
    if (!enabled) {
      blockScrollUntilCompressedRef.current = false
      setIsCompressed(false)
      return
    }

    blockScrollUntilCompressedRef.current = true

    const getDirection = (event: WheelEvent | TouchEvent): 'up' | 'down' | null => {
      if (event instanceof WheelEvent) {
        if (event.deltaY > 0) return 'down'
        if (event.deltaY < 0) return 'up'
        return null
      }
      if (touchStartYRef.current === null) return null
      const deltaY = touchStartYRef.current - (event.touches[0]?.clientY ?? touchStartYRef.current)
      if (deltaY > 0) return 'down'
      if (deltaY < 0) return 'up'
      return null
    }

    const consumeScrollWhileExpanding = (event: WheelEvent | TouchEvent): void => {
      const direction = getDirection(event)
      if (!direction) {
        return
      }

      const atTop = window.scrollY <= 0
      const compressed = isCompressedRef.current

      if (!atTop) {
        blockScrollUntilCompressedRef.current = false
        return
      }

      if (direction === 'up' && compressed) {
        blockScrollUntilCompressedRef.current = true
        setIsCompressed(false)
        event.preventDefault()
        return
      }

      if (!compressed && blockScrollUntilCompressedRef.current && direction === 'down') {
        blockScrollUntilCompressedRef.current = false
        setIsCompressed(true)
        event.preventDefault()
      }
    }

    const handleTouchStart = (event: TouchEvent): void => {
      touchStartYRef.current = event.touches[0]?.clientY ?? null
    }

    window.addEventListener('wheel', consumeScrollWhileExpanding, { passive: false })
    window.addEventListener('touchmove', consumeScrollWhileExpanding, { passive: false })
    window.addEventListener('touchstart', handleTouchStart, { passive: true })

    return (): void => {
      window.removeEventListener('wheel', consumeScrollWhileExpanding)
      window.removeEventListener('touchmove', consumeScrollWhileExpanding)
      window.removeEventListener('touchstart', handleTouchStart)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const isEditableElement = (element: EventTarget | null): boolean => {
      if (!(element instanceof HTMLElement)) {
        return false
      }
      const tag = element.tagName.toLowerCase()
      if (['input', 'textarea', 'select', 'option', 'button'].includes(tag)) {
        return true
      }
      return element.isContentEditable
    }

    const consumeKeyboardScrollWhileExpanding = (event: KeyboardEvent): void => {
      if (!blockScrollUntilCompressedRef.current && !isCompressedRef.current) {
        return
      }

      if (window.scrollY > 0) {
        blockScrollUntilCompressedRef.current = false
        return
      }

      if (isEditableElement(event.target)) {
        return
      }

      const isDownKey =
        event.key === 'ArrowDown' ||
        event.key === 'PageDown' ||
        event.key === 'End' ||
        (event.key === ' ' && !event.shiftKey)

      const isUpKey =
        event.key === 'ArrowUp' ||
        event.key === 'PageUp' ||
        event.key === 'Home' ||
        (event.key === ' ' && event.shiftKey)

      if (isCompressedRef.current && isUpKey) {
        blockScrollUntilCompressedRef.current = true
        setIsCompressed(false)
        event.preventDefault()
        return
      }

      if (blockScrollUntilCompressedRef.current && !isCompressedRef.current && isDownKey) {
        blockScrollUntilCompressedRef.current = false
        setIsCompressed(true)
        event.preventDefault()
      }
    }

    window.addEventListener('keydown', consumeKeyboardScrollWhileExpanding)
    return (): void => window.removeEventListener('keydown', consumeKeyboardScrollWhileExpanding)
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const handleScroll = (): void => {
      const scrollTop = window.scrollY

      if (scrollTop === 0) {
        blockScrollUntilCompressedRef.current = !isCompressedRef.current
        return
      }

      const shouldCompress = scrollTop > 0
      setIsCompressed((prev) => (prev === shouldCompress ? prev : shouldCompress))
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return (): void => window.removeEventListener('scroll', handleScroll)
  }, [enabled])

  return { isCompressed, setIsCompressed }
}
