import { type Dispatch, type SetStateAction, useEffect } from 'react'
import { type Address, isAddressEqual } from 'viem'

interface UseResetEnsoSelectionParams {
  ensoEnabled: boolean
  selectedToken?: Address
  selectedChainId?: number
  assetAddress: Address
  allowedTokenAddress?: Address
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
  allowedTokenAddress,
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

    const hasAllowedTokenSelected =
      selectedToken !== undefined &&
      allowedTokenAddress !== undefined &&
      isAddressEqual(selectedToken, allowedTokenAddress) &&
      (selectedChainId === undefined || selectedChainId === chainId)
    const hasNonAssetTokenSelected =
      selectedToken !== undefined && !isAddressEqual(selectedToken, assetAddress) && !hasAllowedTokenSelected
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
    allowedTokenAddress,
    chainId,
    showTokenSelector,
    setSelectedToken,
    setSelectedChainId,
    setShowTokenSelector
  ])
}
