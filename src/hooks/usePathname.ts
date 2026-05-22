import { useLocation } from '@/navigation/client'

export function usePathname(): string {
  const location = useLocation()
  return location.pathname
}
