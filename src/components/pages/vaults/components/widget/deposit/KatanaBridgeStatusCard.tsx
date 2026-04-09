import { Button } from '@shared/components/Button'
import type { TNotification } from '@shared/types/notifications'
import { cl } from '@shared/utils'
import { getNetwork } from '@shared/utils/wagmi'
import type { ReactElement } from 'react'

function getBridgeStatusCopy({
  notification,
  bridgeAmountLabel,
  assetSymbol
}: {
  notification: TNotification
  bridgeAmountLabel: string
  assetSymbol: string
}): {
  badgeLabel: string
  badgeClassName: string
  title: string
  description: string
} {
  const isBridgeToEthereum = notification.bridgeDirection === 'to-ethereum'

  if (notification.status === 'error') {
    return {
      badgeLabel: 'Error',
      badgeClassName: 'bg-[#C73203] text-white',
      title: 'Bridge failed',
      description: 'The bridge did not complete. Track the transfer on Katana Bridge for the latest status.'
    }
  }

  if (notification.status === 'success') {
    return {
      badgeLabel: 'Ready',
      badgeClassName: 'bg-[#00796D] text-white',
      title: isBridgeToEthereum ? 'Completed on Ethereum' : 'Ready on Katana',
      description: isBridgeToEthereum
        ? `Your bridged ${bridgeAmountLabel} ${assetSymbol} has completed on Ethereum.`
        : `Your bridged ${bridgeAmountLabel} ${assetSymbol} is available on Katana. You can deposit it now.`
    }
  }

  if (notification.bridgeLifecycleStatus === 'READY_TO_CLAIM') {
    return {
      badgeLabel: 'Finalizing',
      badgeClassName: 'bg-[#2563EB] text-white',
      title: isBridgeToEthereum ? 'Ready to claim on Ethereum' : 'Bridge finalizing on Katana',
      description: isBridgeToEthereum
        ? 'Your bridge is ready to claim on Ethereum. Finalize it in Katana Bridge to receive your assets.'
        : 'The bridge is ready to finalize on Katana. Track it if the funds have not landed in your wallet yet.'
    }
  }

  if (notification.status === 'pending') {
    return {
      badgeLabel: 'Pending',
      badgeClassName: 'bg-surface-tertiary text-text-primary',
      title: 'Waiting for source confirmation',
      description: isBridgeToEthereum
        ? 'Your Katana bridge transaction is being confirmed before settlement to Ethereum starts.'
        : 'Your Ethereum bridge transaction is being confirmed before settlement to Katana starts.'
    }
  }

  return {
    badgeLabel: 'Bridging',
    badgeClassName: 'bg-[#2563EB] text-white',
    title: isBridgeToEthereum ? 'Bridging to Ethereum' : 'Bridging to Katana',
    description: isBridgeToEthereum
      ? 'Your assets are on the way to Ethereum. This can take a few minutes before they are ready to claim.'
      : 'Your assets are on the way to Katana. This can take a few minutes to settle.'
  }
}

export function KatanaBridgeStatusCard({
  notification,
  bridgeAmountLabel,
  assetSymbol
}: {
  notification: TNotification
  bridgeAmountLabel: string
  assetSymbol: string
}): ReactElement {
  const sourceExplorerBase =
    notification.txHash && getNetwork(notification.executionChainId ?? notification.chainId).defaultBlockExplorer
  const sourceTransactionUrl =
    sourceExplorerBase && notification.txHash ? `${sourceExplorerBase}/tx/${notification.txHash}` : undefined
  const claimExplorerBase =
    notification.claimTxHash && notification.toChainId
      ? getNetwork(notification.toChainId).defaultBlockExplorer
      : undefined
  const claimTransactionUrl =
    claimExplorerBase && notification.claimTxHash ? `${claimExplorerBase}/tx/${notification.claimTxHash}` : undefined
  const statusCopy = getBridgeStatusCopy({ notification, bridgeAmountLabel, assetSymbol })

  return (
    <div className="rounded-lg border border-border bg-surface-secondary p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">Katana Bridge</p>
          <p className="mt-1 text-base font-semibold text-text-primary">{statusCopy.title}</p>
          <p className="mt-1 text-sm text-text-secondary">{statusCopy.description}</p>
        </div>
        <div className={cl('shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium', statusCopy.badgeClassName)}>
          {statusCopy.badgeLabel}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          as="a"
          href={notification.trackingUrl || 'https://bridge.katana.network/transactions'}
          target="_blank"
          rel="noopener noreferrer"
          variant="filled"
          classNameOverride="yearn--button--nextgen"
        >
          Track bridge
        </Button>

        {sourceTransactionUrl ? (
          <Button
            as="a"
            href={sourceTransactionUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
            classNameOverride="yearn--button--nextgen"
          >
            Source tx
          </Button>
        ) : null}

        {claimTransactionUrl ? (
          <Button
            as="a"
            href={claimTransactionUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
            classNameOverride="yearn--button--nextgen"
          >
            Claim tx
          </Button>
        ) : null}
      </div>
    </div>
  )
}
