import { cl } from '@lib/utils'
import type { FC, MouseEvent, ReactElement } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Created as .tooltip & .tooltiptext can be lower in DOM and not render on top of other elements.
// Use this when tooltip is not in the same component as the trigger.

export const Tooltip: FC<{
  className?: string
  children: ReactElement
  tooltip: string | ReactElement
}> = ({ children, tooltip, className }) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const closeTimeoutRef = useRef<number | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)

  const cancelScheduledClose = useCallback((): void => {
    if (closeTimeoutRef.current !== null) {
      if (typeof window !== 'undefined') {
        window.clearTimeout(closeTimeoutRef.current)
      } else {
        clearTimeout(closeTimeoutRef.current)
      }
      closeTimeoutRef.current = null
    }
  }, [])

  const scheduleClose = useCallback((): void => {
    cancelScheduledClose()
    if (typeof window === 'undefined') {
      setIsTooltipVisible(false)
      return
    }
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsTooltipVisible(false)
      closeTimeoutRef.current = null
    }, 100)
  }, [cancelScheduledClose])

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        if (typeof window !== 'undefined') {
          window.clearTimeout(closeTimeoutRef.current)
        } else {
          clearTimeout(closeTimeoutRef.current)
        }
      }
    }
  }, [])

  const showTooltip = useCallback((): void => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setTooltipPosition({
        x: rect.left + rect.width / 2,
        y: rect.bottom
      })
      setIsTooltipVisible(true)
    }
  }, [])

  const handleMouseEnter = useCallback((): void => {
    cancelScheduledClose()
    showTooltip()
  }, [cancelScheduledClose, showTooltip])

  const handleMouseLeave = useCallback(
    (event: MouseEvent<HTMLDivElement>): void => {
      const nextTarget = event.relatedTarget as Node | null
      if (tooltipRef.current && nextTarget && tooltipRef.current.contains(nextTarget)) {
        return
      }
      scheduleClose()
    },
    [scheduleClose]
  )

  const handleTooltipMouseEnter = useCallback((): void => {
    cancelScheduledClose()
  }, [cancelScheduledClose])

  const handleTooltipMouseLeave = useCallback(
    (event: MouseEvent<HTMLDivElement>): void => {
      const nextTarget = event.relatedTarget as Node | null
      if (triggerRef.current && nextTarget && triggerRef.current.contains(nextTarget)) {
        return
      }
      scheduleClose()
    },
    [scheduleClose]
  )

  useEffect(() => {
    if (!isTooltipVisible) {
      return
    }

    const handleScrollOrResize = (): void => {
      cancelScheduledClose()
      setIsTooltipVisible(false)
    }

    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [cancelScheduledClose, isTooltipVisible])

  return (
    <div
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cl('flex w-fit items-center justify-end gap-4 md:justify-center relative h-6', className)}
    >
      {children}

      {isTooltipVisible &&
        typeof window !== 'undefined' &&
        createPortal(
          <div
            onMouseEnter={handleTooltipMouseEnter}
            onMouseLeave={handleTooltipMouseLeave}
            ref={(node): void => {
              tooltipRef.current = node
            }}
            onClick={(event): void => {
              event.stopPropagation()
            }}
            style={{
              position: 'fixed',
              left: tooltipPosition.x,
              top: tooltipPosition.y,
              paddingTop: 8,
              transform: 'translateX(-50%)',
              zIndex: 9999,
              pointerEvents: 'auto'
            }}
          >
            {tooltip}
          </div>,
          document.body
        )}
    </div>
  )
}
