type TokenLogoSourceParams = {
  address?: string
  chainId?: number
  logoURI?: string
  size?: 32 | 128
}

export function getDefaultTokenLogoSrc({
  address,
  chainId,
  size = 32
}: Omit<TokenLogoSourceParams, 'logoURI'>): string | undefined {
  if (!address || !chainId) {
    return undefined
  }

  return `${import.meta.env.VITE_BASE_YEARN_ASSETS_URI}/tokens/${chainId}/${address.toLowerCase()}/logo-${size}.png`
}

export function getTokenLogoSources({ address, chainId, logoURI, size = 32 }: TokenLogoSourceParams): {
  src: string
  altSrc?: string
} {
  const fallbackSrc = getDefaultTokenLogoSrc({ address, chainId, size }) ?? ''

  if (!logoURI) {
    return { src: fallbackSrc }
  }

  return {
    src: logoURI,
    altSrc: fallbackSrc && fallbackSrc !== logoURI ? fallbackSrc : undefined
  }
}
