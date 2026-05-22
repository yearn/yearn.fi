const FIRST_PARTY_HOSTS = new Set(['yearn.fi', 'www.yearn.fi'])
const DEFAULT_ORIGIN = 'https://yearn.fi'

function hasExplicitProtocolOrHost(url: string): boolean {
  return /^[a-z][a-z\d+.-]*:/i.test(url) || url.startsWith('//')
}

export function resolveLinkTarget(url: string): { href: string; isExternal: boolean } {
  try {
    const parsedUrl = new URL(url, DEFAULT_ORIGIN)
    const isWebUrl = parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
    const isExternal = !isWebUrl || !FIRST_PARTY_HOSTS.has(parsedUrl.hostname)

    if (!isExternal && hasExplicitProtocolOrHost(url)) {
      return {
        href: `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`,
        isExternal: false
      }
    }

    return { href: url, isExternal }
  } catch {
    return { href: url, isExternal: false }
  }
}
