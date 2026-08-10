function getPathSegments(pathname: string): string[] {
  const [pathOnly] = pathname.split(/[?#]/)
  return (pathOnly || '/').split('/').filter(Boolean)
}

export function isVaultDetailPathname(pathname: string): boolean {
  const [section, chainID, address, ...rest] = getPathSegments(pathname)
  return (
    rest.length === 0 &&
    (section === 'vaults' || section === 'v3') &&
    /^\d+$/.test(chainID ?? '') &&
    /^0x[0-9a-fA-F]{40}$/.test(address ?? '')
  )
}

export function isVaultsListPathname(pathname: string): boolean {
  const [section, ...rest] = getPathSegments(pathname)
  return rest.length === 0 && (section === 'vaults' || section === 'v3')
}

export function shouldLoadAppTokenLists(pathname: string): boolean {
  return !isVaultDetailPathname(pathname) && !isVaultsListPathname(pathname)
}
