'use client'

import { cl } from '@shared/utils'
import type { ImgHTMLAttributes, ReactElement } from 'react'
import { useState } from 'react'
import { env } from '@/env'

type TTokenLogoV2Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'alt' | 'onError' | 'src'> & {
  src?: string
  altSrc?: string
  tokenSymbol?: string
  tokenName?: string
  chainId?: number
  priority?: boolean
}

type TTokenLogoV2InnerProps = Omit<TTokenLogoV2Props, 'src' | 'altSrc'> & {
  sources: string[]
  fallbackText: string
}

function getFallbackText({ tokenSymbol, tokenName }: Pick<TTokenLogoV2Props, 'tokenName' | 'tokenSymbol'>): string {
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

function getFontSizeClass({ fallbackText, width }: { fallbackText: string; width?: number | string }): string {
  const sizeInPx = typeof width === 'number' ? width : 32
  const isTwoLetters = fallbackText.length === 2

  if (isTwoLetters && sizeInPx >= 40) {
    return 'text-base'
  }
  if (isTwoLetters && sizeInPx >= 28) {
    return 'text-sm'
  }
  if (isTwoLetters) {
    return 'text-xs'
  }
  if (sizeInPx >= 40) {
    return 'text-lg'
  }
  if (sizeInPx >= 28) {
    return 'text-base'
  }
  return 'text-sm'
}

function TokenLogoV2Inner(props: TTokenLogoV2InnerProps): ReactElement {
  const {
    sources,
    fallbackText,
    tokenSymbol,
    tokenName,
    chainId,
    className,
    width = 32,
    height = 32,
    priority,
    loading,
    fetchPriority,
    ...rest
  } = props
  const [sourceIndex, setSourceIndex] = useState(0)
  const activeSrc = sources[sourceIndex]
  const showFallback = !activeSrc
  const fontSizeClass = getFontSizeClass({ fallbackText, width })
  const sizeStyle = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height
  }
  const chainIconSize = Math.max(12, Math.floor((typeof width === 'number' ? width : 32) * 0.45))
  const handleError = (): void => {
    setSourceIndex((previousIndex) => Math.min(previousIndex + 1, sources.length))
  }

  return (
    <div className="relative inline-block" style={sizeStyle}>
      <div className="relative overflow-hidden" style={{ width: '100%', height: '100%' }}>
        {showFallback ? (
          <div
            className={cl(
              'absolute inset-0 flex items-center justify-center rounded-full border-2 border-gray-400 bg-surface-secondary font-bold text-gray-400',
              fontSizeClass,
              className
            )}
            style={sizeStyle}
          >
            {fallbackText}
          </div>
        ) : (
          // biome-ignore lint/performance/noImgElement: token logos need deterministic SSR output plus custom error fallback.
          <img
            src={activeSrc}
            alt={tokenSymbol || tokenName || 'Token'}
            className={cl('absolute inset-0 h-full w-full object-contain', className)}
            onError={handleError}
            width={width}
            height={height}
            decoding="async"
            loading={priority ? 'eager' : loading}
            fetchPriority={priority ? 'high' : fetchPriority}
            {...rest}
          />
        )}
      </div>
      {chainId ? (
        <div
          className="absolute flex items-center justify-center rounded-full border border-gray-200 bg-white"
          style={{
            width: `${chainIconSize}px`,
            height: `${chainIconSize}px`,
            bottom: '-2px',
            right: '-2px'
          }}
        >
          {/* biome-ignore lint/performance/noImgElement: chain badge shares the token logo fallback primitive. */}
          <img
            src={`${env.NEXT_PUBLIC_BASE_YEARN_ASSETS_URI}/chains/${chainId}/logo.svg`}
            alt="Network"
            width={chainIconSize - 4}
            height={chainIconSize - 4}
            className="object-contain"
          />
        </div>
      ) : null}
    </div>
  )
}

function TokenLogoV2(props: TTokenLogoV2Props): ReactElement {
  const { src, altSrc, tokenSymbol, tokenName, ...rest } = props
  const sources = [src, altSrc].filter((source): source is string => Boolean(source))
  const uniqueSources = [...new Set(sources)]
  const fallbackText = getFallbackText({ tokenSymbol, tokenName })
  const sourceKey = uniqueSources.join('|')

  return (
    <TokenLogoV2Inner
      key={sourceKey}
      sources={uniqueSources}
      fallbackText={fallbackText}
      tokenSymbol={tokenSymbol}
      tokenName={tokenName}
      {...rest}
    />
  )
}

export { TokenLogoV2 }
