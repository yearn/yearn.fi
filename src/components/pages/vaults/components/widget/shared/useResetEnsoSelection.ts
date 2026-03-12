import { type Dispatch, type SetStateAction, useEffect } from 'react'
import { type Address, isAddressEqual } from 'viem'

interface UseResetEnsoSelectionParams {
  ensoEnabled: boolean
  selectedToken?: Address
  selectedChainId?: number
  assetAddress: Address
  chainId: number
  showTokenSelector: boolean
  setSelectedToken: Dispatch<SetStateAction<Address | undefined>>
  setSelectedChainId: Dispatch<SetStateAction<number | undefined>>
  setShowTokenSelector: Dispatch<SetStateAction<boolean>>
}

export function useResetEnsoSelection({
  ensoEnabled,
  selectedToken,
  selectedChainId,
  assetAddress,
  chainId,
  showTokenSelector,
  setSelectedToken,
  setSelectedChainId,
  setShowTokenSelector
}: UseResetEnsoSelectionParams): void {
  useEffect(() => {
    if (ensoEnabled) {
      return
    }

    const hasNonAssetTokenSelected = selectedToken !== undefined && !isAddressEqual(selectedToken, assetAddress)
    const hasCrossChainSelection = selectedChainId !== undefined && selectedChainId !== chainId

    if (!hasNonAssetTokenSelected && !hasCrossChainSelection && !showTokenSelector) {
      return
    }

    if (hasNonAssetTokenSelected) {
      setSelectedToken(assetAddress)
    }
    if (hasCrossChainSelection) {
      setSelectedChainId(undefined)
    }
    if (showTokenSelector) {
      setShowTokenSelector(false)
    }
  }, [
    ensoEnabled,
    selectedToken,
    selectedChainId,
    assetAddress,
    chainId,
    showTokenSelector,
    setSelectedToken,
    setSelectedChainId,
    setShowTokenSelector
  ])
}
