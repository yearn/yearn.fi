import { plausible } from '@hooks/usePlausible'
import type { ReactElement, ReactNode } from 'react'
import { useEffect } from 'react'

interface PlausibleProviderProps {
  enabled?: boolean
  children: ReactNode
}

export function PlausibleProvider({ enabled = true, children }: PlausibleProviderProps): ReactElement {
  useEffect(() => {
    if (!enabled) return
    const cleanup = plausible.enableAutoPageviews()
    return cleanup
  }, [enabled])

  return <>{children}</>
}

export default PlausibleProvider
