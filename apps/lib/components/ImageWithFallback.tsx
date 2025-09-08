import { cl } from '@lib/utils'
import { useUpdateEffect } from '@react-hookz/web'
import type { ImageProps } from 'next/image'
import Image from 'next/image'
import type { CSSProperties, ReactElement } from 'react'
import { useState } from 'react'

function ImageWithFallback(props: ImageProps & { altSrc?: string }): ReactElement {
  const { alt, src, altSrc, className, ...rest } = props
  const [imageSrc, setImageSrc] = useState(altSrc ? src : `${src}?fallback=true`)
  const [imageStyle, setImageStyle] = useState<CSSProperties>({})

  useUpdateEffect((): void => {
    setImageSrc(altSrc ? src : `${src}?fallback=true`)
    setImageStyle({})
  }, [src])

  // Check if className contains size classes that should override width/height
  const hasSizeClasses = className && /\b(size-|w-|h-)/i.test(className)

  return (
    <Image
      alt={alt}
      src={imageSrc}
      loading={'eager'}
      className={cl('animate-fadeIn', className)}
      style={{
        ...(hasSizeClasses
          ? {}
          : {
              minWidth: props.width,
              minHeight: props.height,
              maxWidth: props.width,
              maxHeight: props.height
            }),
        ...imageStyle
      }}
      onError={(): void => {
        if (altSrc && imageSrc !== `${altSrc}?fallback=true`) {
          console.warn('using placeholder')
          setImageSrc(`${altSrc}?fallback=true`)
          return
        }
        setImageSrc('/placeholder.png')
        setImageStyle({ filter: 'opacity(0.2)' })
      }}
      {...rest}
    />
  )
}

export { ImageWithFallback }
