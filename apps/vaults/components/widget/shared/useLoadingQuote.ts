import { useEffect, useState } from 'react'

/**
 * Combined loading state to prevent flickering between debouncing and route loading.
 * Keeps loading state active for a short time after debouncing ends to prevent gaps.
 */
export const useLoadingQuote = (isDebouncing: boolean, isLoadingRoute: boolean): boolean => {
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)

  useEffect(() => {
    if (isDebouncing || isLoadingRoute) {
      setIsLoadingQuote(true)
      return
    }

    // Add a small delay before hiding loading state to prevent flickering
    const timeout = setTimeout(() => {
      setIsLoadingQuote(false)
    }, 100)
    return () => clearTimeout(timeout)
  }, [isDebouncing, isLoadingRoute])

  return isLoadingQuote
}
