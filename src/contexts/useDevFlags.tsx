import type { ReactElement, ReactNode } from 'react'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

type DevFlagsContextValue = {
  headerCompressionEnabled: boolean
  setHeaderCompressionEnabled: (value: boolean) => void
}

const DEFAULT_FLAGS: DevFlagsContextValue = {
  headerCompressionEnabled: true,
  setHeaderCompressionEnabled: () => undefined
}

const DevFlagsContext = createContext<DevFlagsContextValue | undefined>(undefined)

const HEADER_COMPRESSION_STORAGE_KEY = 'dev-header-compression-enabled'
const ENABLE_TOOLBAR =
  !import.meta.env.PROD || import.meta.env.VITE_ENABLE_DEV_TOOLBAR === 'true' || import.meta.env.MODE !== 'production'

export function DevFlagsProvider({ children }: { children: ReactNode }): ReactElement {
  const [headerCompressionEnabled, setHeaderCompressionEnabled] = useState<boolean>(true)

  useEffect(() => {
    if (!ENABLE_TOOLBAR) {
      return
    }

    try {
      const stored = window.localStorage.getItem(HEADER_COMPRESSION_STORAGE_KEY)
      if (stored === 'true') {
        setHeaderCompressionEnabled(true)
      } else if (stored === 'false') {
        setHeaderCompressionEnabled(false)
      }
    } catch {
      // no-op
    }
  }, [])

  useEffect(() => {
    if (!ENABLE_TOOLBAR) {
      return
    }

    try {
      window.localStorage.setItem(HEADER_COMPRESSION_STORAGE_KEY, headerCompressionEnabled ? 'true' : 'false')
    } catch {
      // no-op
    }
  }, [headerCompressionEnabled])

  const value = useMemo(
    () => ({
      headerCompressionEnabled,
      setHeaderCompressionEnabled
    }),
    [headerCompressionEnabled]
  )

  return <DevFlagsContext.Provider value={value}>{children}</DevFlagsContext.Provider>
}

export function useDevFlags(): DevFlagsContextValue {
  const context = useContext(DevFlagsContext)
  if (!context) {
    return DEFAULT_FLAGS
  }
  return context
}
