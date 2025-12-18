export function normalizePathname(pathname: string): string {
  if (pathname.length <= 1) return pathname
  return pathname.replace(/\/+$/, '')
}

export function isVaultsIndexPath(pathname: string): boolean {
  return normalizePathname(pathname) === '/vaults'
}
