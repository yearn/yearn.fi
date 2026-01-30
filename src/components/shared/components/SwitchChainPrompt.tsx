import { Button } from '@shared/components/Button'
import { SUPPORTED_NETWORKS } from '@shared/utils/constants'
import type { ReactElement } from 'react'

type TSwitchChainPromptProps = {
  chainId: number
  onSwitchChain: () => void
  isSwitching?: boolean
}

export function SwitchChainPrompt({ chainId, onSwitchChain, isSwitching }: TSwitchChainPromptProps): ReactElement {
  const chainName = SUPPORTED_NETWORKS.find((n) => n.id === chainId)?.name ?? `Chain ${chainId}`

  return (
    <div className="mt-4 flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-surface-secondary p-4">
      <span className="text-sm text-text-secondary text-center">Switch to {chainName} to claim these rewards</span>
      <Button
        onClick={onSwitchChain}
        isBusy={isSwitching}
        variant="filled"
        className="w-full md:w-auto !px-4 !py-1.5 !text-sm whitespace-nowrap"
      >
        Switch Chain
      </Button>
    </div>
  )
}
