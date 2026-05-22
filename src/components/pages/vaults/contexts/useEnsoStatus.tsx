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

type TEnsoStatusResponse = {
  status?: string
}

export function isEnsoStatusLive(data: TEnsoStatusResponse): boolean {
  return data.status === 'ok'
}

const defaultContext: EnsoStatusContext = {
  isEnsoFailed: false,
  setEnsoFailed: () => undefined
}

const EnsoStatusContext = createContext<EnsoStatusContext>(defaultContext)

export function EnsoStatusProvider({ children }: { children: ReactNode }): ReactElement {
  const [isEnsoFailed, setIsEnsoFailed] = useState(false)

  // Check Enso endpoint liveness on mount without reading private configuration state.
  useEffect(() => {
    fetch('/api/enso/status')
      .then((res) => {
        if (!res.ok) throw new Error('Enso status check failed')
        return res.json() as Promise<TEnsoStatusResponse>
      })
      .then((data) => {
        if (!isEnsoStatusLive(data)) {
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
