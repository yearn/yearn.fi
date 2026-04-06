import { type Dispatch, type SetStateAction, useEffect } from 'react'
import { type Address, isAddressEqual } from 'viem'

interface UseResetEnsoSelectionParams {
  ensoEnabled: boolean
  allowedChainIds?: number[]
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
  allowedChainIds,
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
    const hasNonAssetTokenSelected = selectedToken !== undefined && !isAddressEqual(selectedToken, assetAddress)
    const hasCrossChainSelection = selectedChainId !== undefined && selectedChainId !== chainId
    const hasDisallowedChainSelection =
      selectedChainId !== undefined &&
      !!allowedChainIds &&
      allowedChainIds.length > 0 &&
      !allowedChainIds.includes(selectedChainId)
    const shouldResetForChainRestriction = hasCrossChainSelection && hasDisallowedChainSelection
    const shouldResetToken = hasNonAssetTokenSelected && (!ensoEnabled || shouldResetForChainRestriction)
    const shouldResetChain = hasCrossChainSelection && (!ensoEnabled || shouldResetForChainRestriction)
    const shouldCloseSelector = showTokenSelector && (!ensoEnabled || shouldResetForChainRestriction)

    if (!shouldResetToken && !shouldResetChain && !shouldCloseSelector) {
      return
    }

    if (shouldResetToken) {
      setSelectedToken(assetAddress)
    }
    if (shouldResetChain) {
      setSelectedChainId(undefined)
    }
    if (shouldCloseSelector) {
      setShowTokenSelector(false)
    }
  }, [
    ensoEnabled,
    allowedChainIds,
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
