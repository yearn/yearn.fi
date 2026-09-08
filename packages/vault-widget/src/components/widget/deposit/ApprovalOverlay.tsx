import { buildTransactionPlan, type VaultWidgetTransactionPlan } from '@yearn/vault-widget/headless'
import { Button } from '@yearn/vault-widget/internal/components/shared/Button'
import { InfoOverlay } from '@yearn/vault-widget/internal/components/widget/shared/InfoOverlay'
import { LifecycleTransactionOverlay } from '@yearn/vault-widget/internal/components/widget/shared/LifecycleTransactionOverlay'
import type { TransactionStep } from '@yearn/vault-widget/internal/components/widget/shared/TransactionOverlay'
import { getApproveAbi } from '@yearn/vault-widget/internal/utils/approve'
import { useVaultWidgetRuntime } from '@yearn/vault-widget/runtime'
import { useState } from 'react'
import { encodeFunctionData, maxUint256 } from 'viem'

interface ApprovalOverlayProps {
  isOpen: boolean
  onClose: () => void
  onDone?: () => Promise<void> | void
  disableSetUnlimited?: boolean
  tokenSymbol: string
  tokenAddress: `0x${string}`
  tokenDecimals: number
  spenderAddress: `0x${string}`
  spenderName: string
  chainId: number
  currentAllowance: string
  approvalWarning?: string
}
export function ApprovalOverlay(props: ApprovalOverlayProps) {
  return props.isOpen ? <ManageApproval {...props} /> : null
}
function ManageApproval(props: ApprovalOverlayProps) {
  const runtime = useVaultWidgetRuntime()
  const [active, setActive] = useState<{
    plan: VaultWidgetTransactionPlan
    step: TransactionStep
    owner: `0x${string}`
  }>()
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState('')
  const approve = async (amount: bigint) => {
    const owner = runtime.wallet.address
    if (!owner || props.approvalWarning || switching) return
    const label = amount === 0n ? 'Revoke approval' : 'Set unlimited approval'
    const request = {
      chainId: props.chainId,
      to: props.tokenAddress,
      data: encodeFunctionData({
        abi: getApproveAbi(props.tokenAddress),
        functionName: 'approve',
        args: [props.spenderAddress, amount]
      })
    }
    const plan = buildTransactionPlan({
      connectedChainId: props.chainId,
      walletType: runtime.safe.isSafe ? 'safe' : 'eoa',
      intent: {
        id: ['approval', owner, props.chainId, props.tokenAddress, props.spenderAddress, amount.toString()].join(':'),
        mode: 'deposit',
        calls: [{ id: 'approval', label, request }]
      }
    })
    const step: TransactionStep = {
      id: 'approval',
      label,
      confirmMessage: `${label} for ${props.spenderName}`,
      successTitle: 'Approval updated',
      successMessage: `Your ${props.tokenSymbol} allowance has been updated.`,
      prepare: {
        isSuccess: true,
        isError: false,
        isFetching: false,
        isLoading: false,
        status: 'success',
        data: { request: {} }
      },
      notification: {
        type: 'approve',
        amount: amount === 0n ? '0' : 'Unlimited',
        fromAddress: props.tokenAddress,
        fromChainId: props.chainId,
        fromSymbol: props.tokenSymbol
      }
    }
    setSwitching(true)
    setError('')
    try {
      if (!runtime.chains.isConnectedToExecutionChain(runtime.wallet.chainId, props.chainId))
        await runtime.execution.switchChain({ chainId: props.chainId })
      setActive({ plan, step, owner })
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not switch network')
    } finally {
      setSwitching(false)
    }
  }
  return (
    <InfoOverlay isOpen onClose={props.onClose} title="Manage approval" hideButton>
      {active ? (
        <div className="relative min-h-[390px]">
          <LifecycleTransactionOverlay
            isOpen
            reviewedOwner={active.owner}
            plan={active.plan}
            step={active.step}
            onClose={() => setActive(undefined)}
            onBeforeSuccess={async () => {
              await props.onDone?.()
            }}
            onAllComplete={props.onClose}
            deferOnAllCompleteUntilClose
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="font-medium text-sm text-text-primary">What is this?</p>
          <p className="text-sm text-text-secondary">
            Token approval allows {props.spenderName} to transfer your {props.tokenSymbol} up to a set limit.
          </p>
          {props.disableSetUnlimited ? (
            <p className="text-sm text-text-secondary">Revoke the current allowance before setting a new approval.</p>
          ) : null}
          <p className="text-sm">
            Current allowance: {props.currentAllowance} {props.tokenSymbol}
          </p>
          {props.approvalWarning || error ? (
            <p className="text-sm text-red-500">{props.approvalWarning || error}</p>
          ) : null}
          <Button
            onClick={() => void approve(0n)}
            isDisabled={
              !runtime.wallet.address ||
              switching ||
              Boolean(props.approvalWarning) ||
              Number(props.currentAllowance.replaceAll(',', '')) <= 0
            }
          >
            Revoke
          </Button>
          <Button
            onClick={() => void approve(maxUint256)}
            isDisabled={
              !runtime.wallet.address ||
              switching ||
              props.disableSetUnlimited ||
              props.currentAllowance === 'Unlimited' ||
              Boolean(props.approvalWarning)
            }
          >
            Set unlimited
          </Button>
        </div>
      )}
    </InfoOverlay>
  )
}
