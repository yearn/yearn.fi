import {
  createContext,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react'

interface EnsoStatusContext {
  isEnsoFailed: boolean
  setEnsoFailed: (failed: boolean) => void
}

const defaultContext: EnsoStatusContext = {
  isEnsoFailed: false,
  setEnsoFailed: () => undefined
}

const EnsoStatusContext = createContext<EnsoStatusContext>(defaultContext)

export function EnsoStatusProvider({ children }: { children: ReactNode }): ReactElement {
  const [isEnsoFailed, setIsEnsoFailed] = useState(false)

  // Check if Enso API is configured on mount
  useEffect(() => {
    fetch('/api/enso/status')
      .then((res) => res.json())
      .then((data) => {
        if (!data.configured) {
          setIsEnsoFailed(true)
        }
      })
      .catch(() => {
        setIsEnsoFailed(true)
      })
  }, [])

  const setEnsoFailed = useCallback((failed: boolean) => {
    setIsEnsoFailed(failed)
  }, [])

  const value = useMemo(
    () => ({
      isEnsoFailed,
      setEnsoFailed
    }),
    [isEnsoFailed, setEnsoFailed]
  )

  return <EnsoStatusContext.Provider value={value}>{children}</EnsoStatusContext.Provider>
}

export function useEnsoStatus(): EnsoStatusContext {
  return useContext(EnsoStatusContext)
}
