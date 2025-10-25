import { useLocation } from 'react-router'

export function usePathname(): string {
  const location = useLocation()
  return location.pathname
}
