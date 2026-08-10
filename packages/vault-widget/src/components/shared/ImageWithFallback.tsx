'use client'

import { cl } from '@yearn/vault-widget/internal/utils'
import type { ImgHTMLAttributes, ReactElement } from 'react'
import { useState } from 'react'

export type ImageWithFallbackProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  altSrc?: string
  fallbackSrc?: string
  src?: string
}

type ImageWithFallbackInnerProps = ImageWithFallbackProps & {
  sources: string[]
}

function ImageWithFallbackInner({ sources, alt, className, width, height, ...rest }: ImageWithFallbackInnerProps) {
  const [sourceIndex, setSourceIndex] = useState(0)
  const activeSource = sources[sourceIndex]
  const hasSizeClasses = Boolean(className && /\b(size-|w-|h-)/i.test(className))

  if (!activeSource) {
    return null
  }

  return (
    <img
      {...rest}
      alt={alt}
      src={activeSource}
      width={width}
      height={height}
      loading={rest.loading ?? 'eager'}
      className={cl('animate-fadeIn', className)}
      onError={() => setSourceIndex((current) => Math.min(current + 1, sources.length))}
      style={{
        ...(hasSizeClasses
          ? {}
          : {
              minWidth: width,
              minHeight: height,
              maxWidth: width,
              maxHeight: height
            }),
        ...rest.style
      }}
    />
  )
}

export function ImageWithFallback({
  src,
  altSrc,
  fallbackSrc = '/placeholder.png',
  ...rest
}: ImageWithFallbackProps): ReactElement | null {
  const sources = [...new Set([src, altSrc, fallbackSrc].filter((source): source is string => Boolean(source)))]

  return <ImageWithFallbackInner key={sources.join('|')} sources={sources} {...rest} />
}
