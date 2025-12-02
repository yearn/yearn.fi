import type { ImgHTMLAttributes } from 'react'

export interface ImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
  width?: number | string
  height?: number | string
  fill?: boolean
  priority?: boolean
  quality?: number
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
  loader?: (params: { src: string; width: number; quality?: number }) => string
  unoptimized?: boolean
}

import type { CSSProperties, ReactElement } from 'react'
import { useEffect, useRef, useState } from 'react'

export interface CustomImageProps extends ImageProps {
  fallbackSrc?: string
  onLoadStart?: () => void
  onLoadComplete?: () => void
  onError?: () => void
}

function Image(props: CustomImageProps): ReactElement {
  const {
    src,
    alt = '',
    width,
    height,
    fallbackSrc = '/placeholder.png',
    onLoadComplete,
    onError,
    loading = 'lazy',
    className = '',
    style,
    fill,
    priority,
    ...rest
  } = props

  const [imageSrc, setImageSrc] = useState<string | typeof src>(src)
  const [isVisible, setIsVisible] = useState(loading !== 'lazy' || priority === true)
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const imageRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Set up IntersectionObserver for lazy loading
  useEffect(() => {
    if (loading !== 'lazy' || priority || !imageRef.current) return

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
  }, [loading, priority])

  // Reset states when src changes
  useEffect(() => {
    setImageSrc(src)
    setHasError(false)
    setIsLoading(true)
  }, [src])

  const handleLoadComplete = (): void => {
    setIsLoading(false)
    setHasError(false)
    onLoadComplete?.()
  }

  const handleError = (): void => {
    setHasError(true)
    setIsLoading(false)

    // Try fallback if available and not already using it
    if (fallbackSrc && imageSrc !== fallbackSrc) {
      setImageSrc(fallbackSrc)
    }

    onError?.()
  }

  const containerStyle: CSSProperties = {
    position: fill ? 'relative' : 'static',
    display: fill ? 'block' : 'inline-block',
    width: fill ? '100%' : undefined,
    height: fill ? '100%' : undefined,
    ...style
  }

  const imageClassName = [
    className,
    isLoading && !hasError ? 'opacity-0' : 'opacity-100',
    'transition-opacity duration-300 ease-in-out'
  ]
    .filter(Boolean)
    .join(' ')

  // Error state
  const errorPlaceholder = hasError && imageSrc === fallbackSrc && (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded">
      <span className="text-gray-400 dark:text-gray-500 text-sm">Failed to load image</span>
    </div>
  )

  return (
    <div ref={imageRef} style={containerStyle} className="relative overflow-hidden">
      {errorPlaceholder}
      {isVisible && (
        <img
          src={imageSrc as string}
          alt={alt}
          className={imageClassName}
          onLoad={handleLoadComplete}
          onError={handleError}
          width={!fill ? width : undefined}
          height={!fill ? height : undefined}
          style={
            fill
              ? {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }
              : undefined
          }
          decoding="async"
          {...rest}
        />
      )}
    </div>
  )
}

export default Image
