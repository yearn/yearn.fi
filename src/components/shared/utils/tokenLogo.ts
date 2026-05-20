const APPROVED_TOKEN_LOGO_HOSTS = ['cdn.jsdelivr.net', 'token-assets.yearn.fi', 'tokens.1inch.io'] as const

function getHostname(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }

  try {
    return new URL(value).hostname.toLowerCase()
  } catch {
    return undefined
  }
}

function getApprovedLogoHosts(): Set<string> {
  const configuredAssetsHost = getHostname(import.meta.env.VITE_BASE_YEARN_ASSETS_URI)
  return new Set([...APPROVED_TOKEN_LOGO_HOSTS, ...(configuredAssetsHost ? [configuredAssetsHost] : [])])
}

export function sanitizeTokenLogoURI(logoURI: string | undefined): string | undefined {
  if (!logoURI) {
    return undefined
  }

  try {
    const url = new URL(logoURI)
    if (url.protocol !== 'https:' || !getApprovedLogoHosts().has(url.hostname.toLowerCase())) {
      return undefined
    }
    return url.toString()
  } catch {
    return undefined
  }
}
