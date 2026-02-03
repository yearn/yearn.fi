import { useEnsoStatus } from '@pages/vaults/contexts/useEnsoStatus'

export function useEnsoEnabled(): boolean {
  const { isEnsoFailed } = useEnsoStatus()
  const envDisabled = import.meta.env.VITE_ENSO_DISABLED === 'true'

  return !envDisabled && !isEnsoFailed
}
