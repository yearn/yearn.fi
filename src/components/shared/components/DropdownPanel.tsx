import { useThemePreference } from '@hooks/useThemePreference'
import { cl } from '@shared/utils'
import type { ReactElement, ReactNode } from 'react'
import { useEffect, useRef } from 'react'

type TDropdownPanelProps = {
  isOpen: boolean
  onClose: () => void
  anchor?: 'left' | 'right'
  className?: string
  children: ReactNode
  forceDark?: boolean
}

export function DropdownPanel({
  isOpen,
  onClose,
  anchor = 'left',
  className,
  children,
  forceDark
}: TDropdownPanelProps): ReactElement | null {
  const dropdownRef = useRef<HTMLDivElement>(null)
  const themePreference = useThemePreference()
  const isDarkTheme = forceDark ?? themePreference !== 'light'

  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent): void {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={dropdownRef}
      className={cl(
        'absolute top-full mt-2 rounded-lg border p-4 shadow-xl z-[100]',
        'max-md:fixed max-md:inset-x-0 max-md:top-[var(--header-height)] max-md:mt-0 max-md:rounded-none max-md:border-x-0 max-md:border-t',
        anchor === 'left' ? 'left-0' : 'right-0',
        isDarkTheme ? 'border-white/10 bg-[#0a0a0a]' : 'border-neutral-200 bg-white',
        className
      )}
    >
      {children}
    </div>
  )
}
