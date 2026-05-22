type TokenLogoSourceParams = {
  address?: string
  chainId?: number
  logoURI?: string
  size?: 32 | 128
}

const APPROVED_TOKEN_LOGO_HOSTS = ['token-assets.yearn.fi', 'cdn.jsdelivr.net', 'raw.githubusercontent.com'] as const

function getApprovedTokenLogoHosts(): Set<string> {
  const baseAssetHost = getUrlHost(import.meta.env.VITE_BASE_YEARN_ASSETS_URI)

  return new Set([...APPROVED_TOKEN_LOGO_HOSTS, ...(baseAssetHost ? [baseAssetHost] : [])])
}

function getUrlHost(value?: string): string | undefined {
  if (!value) {
    return undefined
  }

  try {
    return new URL(value).hostname.toLowerCase()
  } catch {
    return undefined
  }
}

function isLocalAssetPath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')
}

export function sanitizeTokenLogoURI(logoURI?: string): string | undefined {
  const trimmedLogoURI = logoURI?.trim()
  if (!trimmedLogoURI) {
    return undefined
  }

  if (isLocalAssetPath(trimmedLogoURI)) {
    return trimmedLogoURI
  }

  try {
    const parsedLogoURI = new URL(trimmedLogoURI)
    const protocol = parsedLogoURI.protocol.toLowerCase()
    const hostname = parsedLogoURI.hostname.toLowerCase()

    if ((protocol === 'http:' || protocol === 'https:') && getApprovedTokenLogoHosts().has(hostname)) {
      return trimmedLogoURI
    }
  } catch {
    return undefined
  }

  return undefined
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
  const sanitizedLogoURI = sanitizeTokenLogoURI(logoURI)

  if (!sanitizedLogoURI) {
    return { src: fallbackSrc }
  }

  return {
    src: sanitizedLogoURI,
    altSrc: fallbackSrc && fallbackSrc !== sanitizedLogoURI ? fallbackSrc : undefined
  }
}
