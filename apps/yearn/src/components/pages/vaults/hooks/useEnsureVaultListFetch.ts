import type { TKongVaultSnapshot } from '@shared/utils/schemas/kongVaultSnapshotSchema'
import { useEffect, useRef, useState } from 'react'

type TUseEnsureVaultListFetchProps = {
  hasVaultList: boolean
  isYvUsd: boolean
  snapshotVault?: TKongVaultSnapshot
  enableVaultListFetch: () => void
}

type TShouldEnableVaultListFetchProps = {
  hasTriggeredVaultListFetch: boolean
  hasVaultList: boolean
  isYvUsd: boolean
  snapshotVault?: TKongVaultSnapshot
}

export function shouldEnableVaultListFetch({
  hasTriggeredVaultListFetch,
  hasVaultList,
  isYvUsd,
  snapshotVault
}: TShouldEnableVaultListFetchProps): boolean {
  if (hasTriggeredVaultListFetch || hasVaultList) {
    return false
  }

  if (!isYvUsd && !snapshotVault) {
    return false
  }

  return true
}

export function useEnsureVaultListFetch({
  hasVaultList,
  isYvUsd,
  snapshotVault,
  enableVaultListFetch
}: TUseEnsureVaultListFetchProps): boolean {
  const hasTriggeredRef = useRef(false)
  const [hasTriggeredVaultListFetch, setHasTriggeredVaultListFetch] = useState(false)

  useEffect(() => {
    if (
      !shouldEnableVaultListFetch({
        hasTriggeredVaultListFetch: hasTriggeredRef.current,
        hasVaultList,
        isYvUsd,
        snapshotVault
      })
    ) {
      return
    }

    hasTriggeredRef.current = true
    setHasTriggeredVaultListFetch(true)
    enableVaultListFetch()
  }, [enableVaultListFetch, hasVaultList, isYvUsd, snapshotVault])

  return hasTriggeredVaultListFetch
}
