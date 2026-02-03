import { useMediaQuery } from '@react-hookz/web'
import { Button } from '@shared/components/Button'
import { useLocalStorage } from '@shared/hooks/useLocalStorage'
import { cl } from '@shared/utils'
import type { ReactElement } from 'react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

type TourStep = {
  id: string
  title: string
  description: string
  selector: string
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'header-user',
    title: 'Your account',
    description: 'Wallet status, notifications, and settings are on the right.',
    selector: '[data-tour="vaults-header-user"]'
  },
  {
    id: 'row',
    title: 'A vault row',
    description: 'Click on a row to navigate to a vault page.',
    selector: '[data-tour="vaults-row"]'
  },
  {
    id: 'expand-button',
    title: 'Expand a vault',
    description: 'Use the chevron on a row to reveal extra details.',
    selector: '[data-tour="vaults-row-expand"]'
  },
  {
    id: 'expanded',
    title: 'Expanded view',
    description: 'Expanded rows reveal a deeper view of the vault.',
    selector: '[data-tour="vaults-row-expanded"]'
  },
  {
    id: 'expanded-strategy',
    title: 'Strategies',
    description: 'See how deposits are allocated across yield-generating strategies and track historical performance.',
    selector: '[data-tour="vaults-row-expanded-strategy"]'
  }
]

type VaultsWelcomeTourProps = {
  onTourStateChange?: (state: { isOpen: boolean; stepId?: string }) => void
}

export function VaultsWelcomeTour({ onTourStateChange }: VaultsWelcomeTourProps): ReactElement | null {
  const isDesktop = useMediaQuery('(min-width: 768px)', { initializeWithValue: false }) ?? false
  const [isDismissed, setIsDismissed] = useLocalStorage('yearn-vaults-welcome-dismissed', false)
  const [isTourOpen, setIsTourOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const lastTargetRectRef = useRef<DOMRect | null>(null)

  const step = TOUR_STEPS[stepIndex] ?? TOUR_STEPS[0]

  useEffect(() => {
    onTourStateChange?.({ isOpen: isTourOpen, stepId: isTourOpen ? step.id : undefined })
  }, [isTourOpen, onTourStateChange, step.id])

  const updateTargetRect = useCallback((): boolean => {
    if (typeof window === 'undefined') return false
    const element = document.querySelector(step.selector) as HTMLElement | null
    if (!element) {
      return false
    }
    const rect = element.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) {
      return false
    }
    lastTargetRectRef.current = rect
    setTargetRect(rect)
    return true
  }, [step.selector])

  useLayoutEffect(() => {
    if (!isTourOpen) {
      setTargetRect(null)
      return
    }
    let frame = 0
    let attempts = 0
    const maxAttempts = 12
    const attempt = (): void => {
      const found = updateTargetRect()
      if (found) return
      attempts += 1
      if (attempts < maxAttempts) {
        frame = requestAnimationFrame(attempt)
        return
      }
      if (!lastTargetRectRef.current) {
        setTargetRect(null)
      }
    }
    attempt()
    return () => {
      if (frame) cancelAnimationFrame(frame)
    }
  }, [isTourOpen, updateTargetRect])

  useEffect(() => {
    if (!isTourOpen) return
    const handleScroll = (): void => {
      updateTargetRect()
    }
    window.addEventListener('resize', handleScroll)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      window.removeEventListener('resize', handleScroll)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [isTourOpen, updateTargetRect])

  useEffect(() => {
    if (!isTourOpen) return
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsTourOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isTourOpen])

  const highlightRect = useMemo(() => {
    if (!targetRect || typeof window === 'undefined') return null
    const padding = 10
    const left = Math.max(8, targetRect.left - padding)
    const top = Math.max(8, targetRect.top - padding)
    const maxWidth = window.innerWidth - left - 8
    const maxHeight = window.innerHeight - top - 8
    const width = Math.min(targetRect.width + padding * 2, maxWidth)
    const height = Math.min(targetRect.height + padding * 2, maxHeight)
    return { left, top, width, height }
  }, [targetRect])

  const handleDismiss = (): void => {
    setIsDismissed(true)
  }

  const handleStartTour = (): void => {
    setStepIndex(0)
    setIsTourOpen(true)
  }

  const handleCloseTour = (): void => {
    setIsTourOpen(false)
  }

  const handleNext = (): void => {
    if (stepIndex >= TOUR_STEPS.length - 1) {
      setIsTourOpen(false)
      return
    }
    setStepIndex((prev) => Math.min(prev + 1, TOUR_STEPS.length - 1))
  }

  const handlePrevious = (): void => {
    setStepIndex((prev) => Math.max(prev - 1, 0))
  }

  if (!isDesktop) {
    return null
  }

  return (
    <>
      {!isDismissed && !isTourOpen ? (
        <div className="fixed bottom-4 right-4 z-60 max-w-[360px]">
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="text-sm font-semibold text-text-primary">
                  {"👋 Welcome to Yearn's new vaults site."}
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 ">
              <Button
                variant="filled"
                onClick={handleStartTour}
                classNameOverride="yearn--button--nextgen yearn--button-smaller font-semibold!"
              >
                {'Take a tour'}
              </Button>
              <Button
                as="a"
                href="https://legacy.yearn.fi/v3"
                target="_blank"
                rel="noreferrer noopener"
                variant="outlined"
                onClick={handleDismiss}
                classNameOverride="yearn--button--nextgen yearn--button-smaller font-semibold"
              >
                {'Legacy site'}
              </Button>
              <Button
                variant="outlined"
                onClick={handleDismiss}
                classNameOverride="yearn--button--nextgen yearn--button-smaller font-semibold"
              >
                {'Dismiss'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isTourOpen ? (
        <div className="fixed inset-0 z-[80]">
          <div className="absolute inset-0" />
          {highlightRect ? (
            <div
              className="absolute rounded-2xl border-2 border-primary/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
              style={{
                left: `${highlightRect.left}px`,
                top: `${highlightRect.top}px`,
                width: `${highlightRect.width}px`,
                height: `${highlightRect.height}px`
              }}
            />
          ) : null}
          <div
            role="dialog"
            aria-modal="true"
            className={cl(
              'absolute bottom-4 right-4 w-[min(360px,calc(100%-2rem))] rounded-2xl border border-border bg-surface p-5 text-text-primary shadow-2xl'
            )}
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary">
              {`Step ${stepIndex + 1} of ${TOUR_STEPS.length}`}
            </div>
            <div className="mt-2 text-lg font-semibold">{step.title}</div>
            <p className="mt-2 text-sm text-text-secondary">{step.description}</p>
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleCloseTour}
                className="text-xs font-medium text-text-secondary transition-colors hover:text-text-primary"
              >
                {'End tour'}
              </button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outlined"
                  onClick={handlePrevious}
                  isDisabled={stepIndex === 0}
                  classNameOverride="yearn--button--nextgen yearn--button-smaller"
                >
                  {'Back'}
                </Button>
                <Button
                  variant="filled"
                  onClick={handleNext}
                  classNameOverride="yearn--button--nextgen yearn--button-smaller"
                >
                  {stepIndex === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
