import { useLocation } from 'react-router-dom'

export function usePathname(): string {
  const location = useLocation()
  return location.pathname
}
