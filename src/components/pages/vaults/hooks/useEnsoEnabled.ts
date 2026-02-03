export function useEnsoEnabled(): boolean {
  return import.meta.env.VITE_ENSO_DISABLED !== 'true'
}
