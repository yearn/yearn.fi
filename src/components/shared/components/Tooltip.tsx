import { cl } from '@shared/utils'
import type { FC, MouseEvent, ReactElement } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Created as .tooltip & .tooltiptext can be lower in DOM and not render on top of other elements.
// Use this when tooltip is not in the same component as the trigger.

export const Tooltip: FC<{
  className?: string
  children: ReactElement
  tooltip: string | ReactElement
  openDelayMs?: number
  toggleOnClick?: boolean
  align?: 'center' | 'start' | 'left' | 'right'
  side?: 'top' | 'bottom' | 'left' | 'right'
  zIndex?: number
}> = ({
  children,
  tooltip,
  className,
  openDelayMs = 0,
  toggleOnClick = false,
  align = 'center',
  side = 'bottom',
  zIndex = 9999
}) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const closeTimeoutRef = useRef<number | null>(null)
  const openTimeoutRef = useRef<number | null>(null)
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

  const cancelScheduledOpen = useCallback((): void => {
    if (openTimeoutRef.current !== null) {
      if (typeof window !== 'undefined') {
        window.clearTimeout(openTimeoutRef.current)
      } else {
        clearTimeout(openTimeoutRef.current)
      }
      openTimeoutRef.current = null
    }
  }, [])

  const scheduleClose = useCallback((): void => {
    cancelScheduledClose()
    cancelScheduledOpen()
    if (typeof window === 'undefined') {
      setIsTooltipVisible(false)
      return
    }
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsTooltipVisible(false)
      closeTimeoutRef.current = null
    }, 100)
  }, [cancelScheduledClose, cancelScheduledOpen])

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        if (typeof window !== 'undefined') {
          window.clearTimeout(closeTimeoutRef.current)
        } else {
          clearTimeout(closeTimeoutRef.current)
        }
      }
      if (openTimeoutRef.current !== null) {
        if (typeof window !== 'undefined') {
          window.clearTimeout(openTimeoutRef.current)
        } else {
          clearTimeout(openTimeoutRef.current)
        }
      }
    }
  }, [])

  const showTooltip = useCallback((): void => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const resolvedAlign = align === 'start' || align === 'left' ? 'start' : align === 'right' ? 'end' : 'center'
      const isSideHorizontal = side === 'left' || side === 'right'
      const x = isSideHorizontal
        ? side === 'left'
          ? rect.left
          : rect.right
        : resolvedAlign === 'start'
          ? rect.left
          : resolvedAlign === 'end'
            ? rect.right
            : rect.left + rect.width / 2
      const y = isSideHorizontal
        ? resolvedAlign === 'start'
          ? rect.top
          : resolvedAlign === 'end'
            ? rect.bottom
            : rect.top + rect.height / 2
        : side === 'top'
          ? rect.top
          : rect.bottom
      setTooltipPosition({
        x,
        y
      })
      setIsTooltipVisible(true)
    }
  }, [align, side])

  const scheduleOpen = useCallback((): void => {
    cancelScheduledClose()
    cancelScheduledOpen()
    if (openDelayMs > 0 && typeof window !== 'undefined') {
      openTimeoutRef.current = window.setTimeout(showTooltip, openDelayMs)
      return
    }
    showTooltip()
  }, [cancelScheduledClose, cancelScheduledOpen, openDelayMs, showTooltip])

  const handleMouseEnter = useCallback((): void => {
    scheduleOpen()
  }, [scheduleOpen])

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

  const handleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>): void => {
      if (!toggleOnClick) {
        return
      }
      event.stopPropagation()
      cancelScheduledClose()
      cancelScheduledOpen()
      if (isTooltipVisible) {
        setIsTooltipVisible(false)
        return
      }
      showTooltip()
    },
    [cancelScheduledClose, cancelScheduledOpen, isTooltipVisible, showTooltip, toggleOnClick]
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
      onClick={handleClick}
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
              const target = event.target as HTMLElement | null
              if (target?.closest('[data-tooltip-close="true"]')) {
                setIsTooltipVisible(false)
              }
            }}
            style={{
              position: 'fixed',
              left: tooltipPosition.x,
              top: tooltipPosition.y,
              paddingTop: side === 'bottom' ? 8 : 0,
              paddingBottom: side === 'top' ? 8 : 0,
              paddingLeft: side === 'right' ? 8 : 0,
              paddingRight: side === 'left' ? 8 : 0,
              transform: (() => {
                const resolvedAlign =
                  align === 'start' || align === 'left' ? 'start' : align === 'right' ? 'end' : 'center'
                const horizontalShift =
                  resolvedAlign === 'start'
                    ? 'translateX(0)'
                    : resolvedAlign === 'end'
                      ? 'translateX(-100%)'
                      : 'translateX(-50%)'
                const verticalShift =
                  resolvedAlign === 'start'
                    ? 'translateY(0)'
                    : resolvedAlign === 'end'
                      ? 'translateY(-100%)'
                      : 'translateY(-50%)'

                if (side === 'left') {
                  return `translateX(-100%) ${verticalShift}`
                }
                if (side === 'right') {
                  return `translateX(0) ${verticalShift}`
                }
                return `${horizontalShift}${side === 'top' ? ' translateY(-100%)' : ''}`
              })(),
              zIndex,
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
