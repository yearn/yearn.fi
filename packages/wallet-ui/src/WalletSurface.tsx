'use client'

import { type CSSProperties, type ReactNode, type RefObject, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type TWalletSurfaceProps = {
  children: ReactNode
  desktopRight?: string
  desktopTop?: string
  dialogId: string
  isOpen: boolean
  onClose: () => void
  restoreFocus?: boolean | RefObject<boolean>
  themeClassName?: string
  title: string
  triggerSelector?: string
}

const MOBILE_QUERY = '(max-width: 639px)'
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function isVisible(element: HTMLElement): boolean {
  return !element.closest('[inert], [hidden]') && element.checkVisibility?.({ checkVisibilityCSS: true }) !== false
}

function OpenWalletSurface({
  children,
  desktopRight = '1rem',
  desktopTop = '6rem',
  dialogId,
  onClose,
  restoreFocus = true,
  themeClassName = '',
  title,
  triggerSelector = '[data-wallet-drawer-trigger], [data-wallet-account-trigger], [data-mobile-nav-trigger]'
}: Omit<TWalletSurfaceProps, 'isOpen'>) {
  const rootRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef(onClose)
  const restoreFocusRef = useRef(restoreFocus)
  const previousFocusRef = useRef(
    document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement
      : Array.from(document.querySelectorAll<HTMLElement>(triggerSelector)).find(isVisible)
  )
  const titleId = useId()
  const [mobileViewport, setMobileViewport] = useState(() => window.matchMedia(MOBILE_QUERY).matches)
  closeRef.current = onClose
  restoreFocusRef.current = restoreFocus

  // Viewport changes and focus/scroll ownership are browser lifecycles, outside React state.
  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY)
    const update = () => setMobileViewport(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  // Install dismissal and focus behavior only while this surface owns the browser focus.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const previousOverscroll = document.body.style.overscrollBehavior
    const siblings = mobileViewport
      ? Array.from(document.body.children)
          .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== rootRef.current)
          .map((element) => ({ element, inert: element.inert }))
      : []
    siblings.forEach(({ element }) => {
      element.inert = true
    })
    if (mobileViewport) {
      document.body.style.overflow = 'hidden'
      document.body.style.overscrollBehavior = 'none'
    }
    const focusFrame = requestAnimationFrame(() => dialogRef.current?.focus())
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element) || dialogRef.current?.contains(target) || target.closest(triggerSelector)) {
        return
      }
      // Let a clicked desktop control receive focus; a mobile backdrop returns to the trigger.
      restoreFocusRef.current = mobileViewport
      closeRef.current()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) {
        return
      }
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => isVisible(element) && element.getAttribute('aria-hidden') !== 'true'
      )
      const first = focusable[0]
      const last = focusable.at(-1)
      const onDialog = document.activeElement === dialogRef.current
      const movesOutside =
        (event.shiftKey && (document.activeElement === first || onDialog)) ||
        (!event.shiftKey && document.activeElement === last)

      if (!mobileViewport) {
        if (movesOutside) {
          event.preventDefault()
          const outsideControls = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
            (element) => !rootRef.current?.contains(element) && isVisible(element)
          )
          const triggerIndex = previousFocusRef.current ? outsideControls.indexOf(previousFocusRef.current) : -1
          const nextFocus = event.shiftKey ? previousFocusRef.current : outsideControls[triggerIndex + 1]
          restoreFocusRef.current = false
          closeRef.current()
          ;(nextFocus ?? previousFocusRef.current)?.focus()
        }
        return
      }
      if (!first || !last) {
        event.preventDefault()
        dialogRef.current.focus()
      } else if (movesOutside || !dialogRef.current.contains(document.activeElement)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(focusFrame)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      siblings.forEach(({ element, inert }) => {
        element.inert = inert
      })
      document.body.style.overflow = previousOverflow
      document.body.style.overscrollBehavior = previousOverscroll
      if (typeof restoreFocusRef.current === 'boolean' ? restoreFocusRef.current : restoreFocusRef.current.current) {
        const trigger =
          previousFocusRef.current?.isConnected && isVisible(previousFocusRef.current)
            ? previousFocusRef.current
            : Array.from(document.querySelectorAll<HTMLElement>(triggerSelector)).find(isVisible)
        trigger?.focus()
      }
    }
  }, [mobileViewport, triggerSelector])

  return createPortal(
    <div ref={rootRef} className={themeClassName}>
      {mobileViewport && <div aria-hidden className="wallet-ui-backdrop fixed inset-0 z-[9999] bg-modal-overlay" />}
      <section
        id={dialogId}
        ref={dialogRef}
        data-wallet-drawer
        role="dialog"
        tabIndex={-1}
        aria-modal={mobileViewport || undefined}
        aria-labelledby={titleId}
        style={{ '--wallet-ui-desktop-right': desktopRight, '--wallet-ui-desktop-top': desktopTop } as CSSProperties}
        className="wallet-ui-panel fixed inset-x-0 bottom-0 z-[10000] flex max-h-[calc(100svh-0.75rem)] flex-col overflow-hidden rounded-t-2xl border border-b-0 border-border bg-surface text-text-primary shadow-lg focus:outline-none sm:inset-x-auto sm:top-[var(--wallet-ui-desktop-top)] sm:right-[var(--wallet-ui-desktop-right)] sm:bottom-auto sm:w-[23rem] sm:rounded-2xl sm:border"
      >
        <div aria-hidden className="flex justify-center pt-2 sm:hidden">
          <span className="h-1 w-9 rounded-full bg-text-primary/15" />
        </div>
        <header className="flex items-center justify-between px-4 pt-3 pb-3">
          <h2 id={titleId} className="text-base font-medium tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            aria-label={`Close ${title === 'Connect a wallet' ? 'wallet picker' : 'account panel'}`}
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-text-secondary transition hover:bg-app hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-4 fill-none stroke-current" strokeWidth="2">
              <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </section>
    </div>,
    document.body
  )
}

export function WalletSurface({ isOpen, ...props }: TWalletSurfaceProps) {
  return isOpen ? <OpenWalletSurface {...props} /> : null
}
