import { createContext, useContext } from 'react'

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

export function useDevFlags(): DevFlagsContextValue {
  const context = useContext(DevFlagsContext)
  if (!context) {
    return DEFAULT_FLAGS
  }
  return context
}
