import { getWantDisplayName, KATANA_CHAIN_ID } from '@pages/vaults/constants/addresses'
import { useClaimSplitterRewards } from '@pages/vaults/hooks/rewards/useClaimSplitterRewards'
import type { TSplitterPosition } from '@pages/vaults/types/splitter'
import { useYearn } from '@shared/contexts/useYearn'
import { toAddress, toNormalizedValue } from '@shared/utils'
import type { ReactElement } from 'react'
import { useCallback, useMemo } from 'react'
import type { UseSimulateContractReturnType } from 'wagmi'
import { useChainId, useWriteContract } from 'wagmi'
import type { TransactionStep } from '../shared/TransactionOverlay'
import { RewardRow } from './RewardRow'

type TSplitterRewardRowProps = {
  position: TSplitterPosition
  chainId: number
  onStartClaim: (step: TransactionStep) => void
  isFirst?: boolean
}

export function SplitterRewardRow(props: TSplitterRewardRowProps): ReactElement {
  const { position, chainId, onStartClaim, isFirst } = props

  const currentChainId = useChainId()
  const { isPending } = useWriteContract()
  const { getPrice } = useYearn()

  const { prepare } = useClaimSplitterRewards({
    strategyAddress: position.strategyAddress,
    enabled: position.earned > 0n
  })

  const displayName = getWantDisplayName(position.wantToken.address) || position.wantToken.symbol
  const normalizedAmount = toNormalizedValue(position.earned, position.wantToken.decimals)
  const formattedAmount = normalizedAmount.toFixed(4)
  const wantPrice = getPrice({ address: toAddress(position.wantToken.address), chainID: KATANA_CHAIN_ID }).normalized
  const usdValue = normalizedAmount * wantPrice

  const step = useMemo((): TransactionStep | undefined => {
    if (!prepare.isSuccess || !prepare.data?.request) {
      return undefined
    }
    return {
      prepare: prepare as unknown as UseSimulateContractReturnType,
      label: 'Claim',
      confirmMessage: `Claim ${formattedAmount} ${displayName} yield`,
      successTitle: 'Rewards Claimed',
      successMessage: `You claimed ${formattedAmount} ${displayName} yield`,
      showConfetti: true
    }
  }, [prepare, formattedAmount, displayName])

  const handleClaim = useCallback(() => {
    if (!step) return
    onStartClaim(step)
  }, [step, onStartClaim])

  return (
    <RewardRow
      chainId={chainId}
      currentChainId={currentChainId}
      tokenAddress={position.wantToken.address}
      symbol={displayName}
      amount={normalizedAmount.toString()}
      usdValue={usdValue}
      onClaim={handleClaim}
      isClaimPending={isPending}
      isClaimReady={prepare.isSuccess}
      isFirst={isFirst}
    />
  )
}
