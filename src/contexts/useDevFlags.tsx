import type { ReactElement, ReactNode } from 'react'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type HeaderDisplayMode = 'collapsible' | 'full' | 'minimal' | 'sticky-name'

type DevFlagsContextValue = {
  headerDisplayMode: HeaderDisplayMode
  setHeaderDisplayMode: (value: HeaderDisplayMode) => void
  // Legacy support
  headerCompressionEnabled: boolean
  setHeaderCompressionEnabled: (value: boolean) => void
}

const DEFAULT_FLAGS: DevFlagsContextValue = {
  headerDisplayMode: 'collapsible',
  setHeaderDisplayMode: () => undefined,
  headerCompressionEnabled: true,
  setHeaderCompressionEnabled: () => undefined
}

const DevFlagsContext = createContext<DevFlagsContextValue | undefined>(undefined)

const HEADER_DISPLAY_MODE_STORAGE_KEY = 'dev-header-display-mode'
const ENABLE_TOOLBAR =
  !import.meta.env.PROD || import.meta.env.VITE_ENABLE_DEV_TOOLBAR === 'true' || import.meta.env.MODE !== 'production'

export function DevFlagsProvider({ children }: { children: ReactNode }): ReactElement {
  const [headerDisplayMode, setHeaderDisplayMode] = useState<HeaderDisplayMode>('collapsible')

  useEffect(() => {
    if (!ENABLE_TOOLBAR) {
      return
    }

    try {
      const stored = window.localStorage.getItem(HEADER_DISPLAY_MODE_STORAGE_KEY) as HeaderDisplayMode | null
      if (stored && ['collapsible', 'full', 'minimal', 'sticky-name'].includes(stored)) {
        setHeaderDisplayMode(stored)
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
      window.localStorage.setItem(HEADER_DISPLAY_MODE_STORAGE_KEY, headerDisplayMode)
    } catch {
      // no-op
    }
  }, [headerDisplayMode])

  // Legacy support - map new modes to old boolean
  const headerCompressionEnabled = useMemo(() => headerDisplayMode === 'collapsible', [headerDisplayMode])
  const setHeaderCompressionEnabled = useMemo(
    () => (value: boolean) => {
      setHeaderDisplayMode(value ? 'collapsible' : 'full')
    },
    []
  )

  const value = useMemo(
    () => ({
      headerDisplayMode,
      setHeaderDisplayMode,
      headerCompressionEnabled,
      setHeaderCompressionEnabled
    }),
    [headerDisplayMode, headerCompressionEnabled, setHeaderCompressionEnabled]
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
