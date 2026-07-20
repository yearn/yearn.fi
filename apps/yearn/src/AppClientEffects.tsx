'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useLayoutEffect } from 'react'
import { initializePlausible } from '@/hooks/usePlausible'
import { disableServiceWorkerDev } from '@/utils/disableServiceWorkerDev'

export function AppClientEffects(): null {
  const pathname = usePathname()

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    initializePlausible()

    if (process.env.NODE_ENV === 'development') {
      void disableServiceWorkerDev()
    }
  }, [])

  return null
}
