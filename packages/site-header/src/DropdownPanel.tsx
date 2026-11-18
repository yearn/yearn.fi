import { cl } from '@yearn/site-header/utils'
import type { ReactElement, ReactNode, RefObject } from 'react'
import { useEffect, useRef } from 'react'

export function getDropdownStyles(isDark: boolean) {
  return {
    panel: cl('rounded-lg border p-4', isDark ? 'border-white/10 bg-[#0a0a0a]' : 'border-neutral-200 bg-white'),
    item: cl(
      'flex items-center rounded-lg p-2 transition-colors',
      isDark ? 'hover:bg-white/10' : 'hover:bg-neutral-100'
    ),
    itemLabel: cl('text-sm font-semibold', isDark ? 'text-white' : 'text-neutral-900'),
    heading: cl(
      'pl-4 text-xs font-semibold uppercase tracking-[0.2em]',
      isDark ? 'text-neutral-400' : 'text-neutral-500'
    )
  }
}

type TDropdownPanelProps = {
  isOpen: boolean
  onClose: () => void
  anchor?: 'left' | 'right'
  className?: string
  children: ReactNode
  forceDark?: boolean
  inline?: boolean
  triggerRef?: RefObject<HTMLElement | null>
}

export function DropdownPanel({
  isOpen,
  onClose,
  anchor = 'left',
  className,
  children,
  forceDark,
  inline = false,
  triggerRef
}: TDropdownPanelProps): ReactElement | null {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const isDarkTheme = forceDark ?? false

  // Document-level dismissal events require lifecycle registration.
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent): void {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !triggerRef?.current?.contains(event.target as Node)
      ) {
        onClose()
      }
    }

    function handleEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose, triggerRef])

  if (!isOpen) return null

  return (
    <div
      ref={dropdownRef}
      className={cl(
        getDropdownStyles(isDarkTheme).panel,
        inline ? 'mt-3' : 'absolute top-full z-100 mt-2 shadow-xl',
        !inline &&
          'max-md:fixed max-md:inset-x-0 max-md:top-(--header-height) max-md:mt-0 max-md:rounded-none max-md:border-x-0 max-md:border-t',
        !inline && (anchor === 'left' ? 'left-0' : 'right-0'),
        className
      )}
    >
      {children}
    </div>
  )
}
