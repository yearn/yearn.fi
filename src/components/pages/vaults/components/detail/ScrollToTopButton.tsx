import { IconChevron } from '@shared/icons/IconChevron'
import { cl } from '@shared/utils'
import type { ReactElement } from 'react'
import { useCallback, useEffect, useState } from 'react'

type TProps = {
  className?: string
}

export function ScrollToTopButton({ className }: TProps): ReactElement | null {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handleScroll = (): void => {
      setIsVisible(window.scrollY > 300)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return (): void => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const scrollToTop = useCallback((): void => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  if (!isVisible) {
    return null
  }

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Scroll to top"
      className={cl(
        'fixed z-50 size-12 rounded-full',
        'bg-surface border border-border',
        'flex items-center justify-center',
        'shadow-lg transition-all duration-200',
        'hover:bg-surface-secondary active:scale-95',
        className
      )}
    >
      <IconChevron direction="up" size={20} className="text-text-primary" />
    </button>
  )
}
