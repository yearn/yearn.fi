import { cl } from '@lib/utils'
import type { ReactElement } from 'react'
import { useEffect, useRef, useState } from 'react'
import type { ImageProps } from '/src/components/Image'

interface TokenLogoProps extends Omit<ImageProps, 'alt' | 'src'> {
  src: string
  altSrc?: string
  tokenSymbol?: string
  tokenName?: string
}

function TokenLogo(props: TokenLogoProps): ReactElement {
  const { src, altSrc, tokenSymbol, tokenName, className, width = 32, height = 32, ...rest } = props
  const [imageSrc, setImageSrc] = useState<string>(altSrc || src)
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isVisible, setIsVisible] = useState(props.loading !== 'lazy' || props.priority === true)
  const imageRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Set up IntersectionObserver for lazy loading
  useEffect(() => {
    if (props.loading !== 'lazy' || props.priority || !imageRef.current) return

    const observerOptions: IntersectionObserverInit = {
      root: null,
      rootMargin: '50px',
      threshold: 0.01
    }

    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observerRef.current?.disconnect()
        }
      })
    }, observerOptions)

    observerRef.current.observe(imageRef.current)

    return () => {
      observerRef.current?.disconnect()
    }
  }, [props.loading, props.priority])

  // Reset states when src changes
  useEffect(() => {
    setImageSrc(altSrc || src)
    setHasError(false)
    setIsLoading(true)
  }, [src, altSrc])

  const handleLoad = (): void => {
    setIsLoading(false)
    setHasError(false)
  }

  const handleError = (): void => {
    setIsLoading(false)

    // Try altSrc first if we haven't already
    if (altSrc && imageSrc !== altSrc) {
      setImageSrc(altSrc)
      return
    }

    // If both src and altSrc failed, show fallback
    setHasError(true)
  }

  // Get fallback text based on token symbol prefix
  const getFallbackText = (): string => {
    const symbol = (tokenSymbol || tokenName || '?').toLowerCase()

    if (symbol.startsWith('yv')) {
      return 'YV'
    }
    if (symbol.startsWith('yg')) {
      return 'YG'
    }
    if (symbol.startsWith('ys')) {
      return 'YS'
    }

    return symbol.charAt(0).toUpperCase()
  }

  const fallbackText = getFallbackText()

  // Determine size classes based on width/height and number of characters
  const sizeInPx = typeof width === 'number' ? width : 32
  const isTwoLetters = fallbackText.length === 2

  // Smaller font for two-letter tokens (YV, YG, YS)
  const fontSize = isTwoLetters
    ? sizeInPx >= 40
      ? 'text-base'
      : sizeInPx >= 28
        ? 'text-sm'
        : 'text-xs'
    : sizeInPx >= 40
      ? 'text-lg'
      : sizeInPx >= 28
        ? 'text-base'
        : 'text-sm'

  const imageClassName = cl(
    'transition-opacity duration-300 ease-in-out',
    isLoading && !hasError ? 'opacity-0' : 'opacity-100',
    className
  )

  return (
    <div
      ref={imageRef}
      className="relative inline-block"
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height
      }}
    >
      {hasError ? (
        // Fallback with text (YV/YG/YS or first letter) - circle border with no background
        <div
          className={cl(
            'flex items-center justify-center rounded-full border-2 border-gray-400 text-gray-400 font-bold',
            fontSize,
            className
          )}
          style={{
            width: typeof width === 'number' ? `${width}px` : width,
            height: typeof height === 'number' ? `${height}px` : height
          }}
        >
          {fallbackText}
        </div>
      ) : (
        isVisible && (
          <img
            src={imageSrc}
            alt={tokenSymbol || tokenName || 'Token'}
            className={imageClassName}
            onLoad={handleLoad}
            onError={handleError}
            width={width}
            height={height}
            decoding="async"
            {...rest}
          />
        )
      )}
    </div>
  )
}

export { TokenLogo }
