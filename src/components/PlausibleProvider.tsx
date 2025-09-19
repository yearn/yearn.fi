import Plausible from 'plausible-tracker'
import type { ReactElement, ReactNode } from 'react'
import { useEffect } from 'react'

interface PlausibleProviderProps {
  domain: string
  enabled?: boolean
  children: ReactNode
}

const plausible = Plausible({
  domain: 'yearn.fi'
})

export function PlausibleProvider({ enabled = true, children }: PlausibleProviderProps): ReactElement {
  useEffect(() => {
    if (enabled) {
      // Enable automatic pageview tracking
      plausible.enableAutoPageviews()
    }
  }, [enabled])

  return <>{children}</>
}

export default PlausibleProvider
