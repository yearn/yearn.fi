import { cl } from '@lib/utils'
import type { ReactElement } from 'react'
import type { ImageProps } from '/src/components/Image'
import Image from '/src/components/Image'

function ImageWithFallback(
  props: Omit<ImageProps, 'onError' | 'onLoadStart' | 'onLoadComplete'> & { altSrc?: string }
): ReactElement {
  const { alt, src, altSrc, className, ...rest } = props

  // Check if className contains size classes that should override width/height
  const hasSizeClasses = className && /\b(size-|w-|h-)/i.test(className)

  return (
    <Image
      alt={alt}
      src={altSrc || src}
      fallbackSrc="/placeholder.png"
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
            })
      }}
      {...rest}
    />
  )
}

export { ImageWithFallback }
