import type { ReactElement, ReactNode } from 'react'
import { useEffect } from 'react'
import Plausible from 'plausible-tracker'

interface PlausibleProviderProps {
  domain: string
  enabled?: boolean
  children: ReactNode
}

const plausible = Plausible({
  domain: 'yearn.fi',
  apiHost: '/proxy/plausible'
})

export function PlausibleProvider({ domain, enabled = true, children }: PlausibleProviderProps): ReactElement {
  useEffect(() => {
    if (enabled) {
      // Enable automatic pageview tracking
      plausible.enableAutoPageviews()
    }
  }, [enabled])

  return <>{children}</>
}

export default PlausibleProvider