import { createContext, type ReactElement, type ReactNode, useCallback, useContext, useMemo, useState } from 'react'

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

const VALID_MODES: HeaderDisplayMode[] = ['collapsible', 'full', 'minimal', 'sticky-name']

function readStoredDisplayMode(): HeaderDisplayMode {
  if (!ENABLE_TOOLBAR) return 'collapsible'
  try {
    const stored = window.localStorage.getItem(HEADER_DISPLAY_MODE_STORAGE_KEY) as HeaderDisplayMode | null
    if (stored && VALID_MODES.includes(stored)) {
      return stored
    }
  } catch {
    // no-op
  }
  return 'collapsible'
}

function persistDisplayMode(mode: HeaderDisplayMode): void {
  if (!ENABLE_TOOLBAR) return
  try {
    window.localStorage.setItem(HEADER_DISPLAY_MODE_STORAGE_KEY, mode)
  } catch {
    // no-op
  }
}

export function DevFlagsProvider({ children }: { children: ReactNode }): ReactElement {
  const [headerDisplayMode, setHeaderDisplayModeRaw] = useState<HeaderDisplayMode>(readStoredDisplayMode)

  const setHeaderDisplayMode = useCallback((mode: HeaderDisplayMode) => {
    setHeaderDisplayModeRaw(mode)
    persistDisplayMode(mode)
  }, [])

  // Legacy support - map new modes to old boolean
  const headerCompressionEnabled = useMemo(() => headerDisplayMode === 'collapsible', [headerDisplayMode])
  const setHeaderCompressionEnabled = useMemo(
    () => (value: boolean) => {
      setHeaderDisplayMode(value ? 'collapsible' : 'full')
    },
    [setHeaderDisplayMode]
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
