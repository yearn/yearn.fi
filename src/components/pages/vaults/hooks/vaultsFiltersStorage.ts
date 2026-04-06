import { useLocalStorage } from '@shared/hooks/useLocalStorage'

export const VAULTS_FILTERS_STORAGE_KEY = 'yearn.fi/vaults-filters@1'

type TVaultsPersistedFilters = {
  showHiddenVaults?: boolean
}

export function usePersistedShowHiddenVaults(): boolean {
  const [snapshot] = useLocalStorage<TVaultsPersistedFilters>(VAULTS_FILTERS_STORAGE_KEY, {
    showHiddenVaults: false
  })

  return Boolean(snapshot?.showHiddenVaults)
}
