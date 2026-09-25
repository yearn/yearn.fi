import {
  type ExecuteTransactionPlanParams,
  type TPreparedStep,
  type VaultWidgetPlanOutcome,
  VaultWidgetPreparationError
} from '@yearn/vault-widget/headless'
import type {
  TransactionOverlayProps,
  TransactionStep
} from '@yearn/vault-widget/internal/components/widget/shared/TransactionOverlay'
import type { TSettlementRequirement, TTransactionLifecycle } from '@yearn/vault-widget/lifecycle'
import {
  getContractTransactionRequest,
  getTransactionPreparationChainId,
  isRawTransactionPreparation,
  isTransactionPreparationReady
} from '@yearn/vault-widget/types'
import { type Abi, type Address, encodeFunctionData, isAddress, isHex, type TypedDataDefinition } from 'viem'

export type TOverlayRecipe = {
  settlement?: TSettlementRequirement
  previousIntentIds?: readonly string[]
  id: string
  chainId: number
  steps: readonly { id: string; label: string }[]
}
type TAttachment = {
  canonicalChainId: (chainId?: number) => number | undefined
  id: string
  props: TransactionOverlayProps
  owner?: Address
  isSafe: boolean
  recipe: TOverlayRecipe
}
const bridges = new WeakMap<TTransactionLifecycle, Map<string, ReturnType<typeof createPreparationBridge>>>()
const preparationError = (message: string) => new VaultWidgetPreparationError(new Error(message))

/** A route supplies preparations; this bridge owns no wallet calls, receipts, or step advancement. */
function createPreparationBridge(owner: Address, recipe: TOverlayRecipe) {
  const state: { attachment?: TAttachment; active?: TransactionStep; isSafe?: boolean } = {}
  const listeners = new Set<() => void>()
  const prepared = new Map<string, TransactionStep>()
  const applied = new Set<string>()
  const notify = () =>
    listeners.forEach((listener) => {
      listener()
    })
  const current = (): TAttachment => {
    const attachment = state.attachment
    if (!attachment || attachment.owner?.toLowerCase() !== owner.toLowerCase() || attachment.recipe.id !== recipe.id)
      throw preparationError('The reviewed form or wallet changed. Close and review again.')
    return attachment
  }
  const applyConfirmed = async (outcome: VaultWidgetPlanOutcome): Promise<void> => {
    const attachment = state.attachment
    if (!attachment) return
    current()
    const signedId = Object.keys(outcome.signatures ?? {}).at(-1)
    const submission = outcome.submissions.at(-1)
    const completedId = recipe.steps.filter((step) => step.id === submission?.stepId || step.id === signedId).at(-1)?.id
    if (!completedId || completedId === recipe.steps.at(-1)?.id) return
    const key = `${attachment.id}:${completedId}`
    if (applied.has(key)) return
    applied.add(key)
    try {
      if (completedId === signedId && signedId && attachment.props.step?.id === signedId)
        attachment.props.step.onPermitSigned?.(outcome.signatures![signedId])
      await attachment.props.onStepSuccess?.(completedId, submission?.receipt)
    } catch (error) {
      applied.delete(key)
      throw new VaultWidgetPreparationError(error)
    }
  }
  const waitForStep = (stepId: string): Promise<TransactionStep> =>
    new Promise((resolve, reject) => {
      const finish = (error?: unknown, step?: TransactionStep) => {
        clearTimeout(timeout)
        listeners.delete(check)
        if (error) reject(error)
        else resolve(step!)
      }
      const check = () => {
        try {
          const step = current().props.step
          if (step?.id !== stepId) return
          if (step.isEnabled === false) return
          if (
            step.isPermit
              ? Boolean(step.permitData)
              : step.batch
                ? step.batch.calls.length > 0
                : isTransactionPreparationReady(step.prepare)
          )
            finish(undefined, step)
          else if (step.prepare.isError) finish(new VaultWidgetPreparationError(step.prepare.error))
        } catch (error) {
          finish(error)
        }
      }
      const timeout = setTimeout(
        () => finish(preparationError('The next action could not be prepared. Close and review again.')),
        30_000
      )
      listeners.add(check)
      check()
    })
  const prepareStep: NonNullable<ExecuteTransactionPlanParams['prepareStep']> = async (planned, outcome) => {
    await applyConfirmed(outcome)
    const step = await waitForStep(planned.id)
    const attachment = current()
    prepared.set(step.id, step)
    state.active = step
    state.isSafe = attachment.isSafe
    const base = { id: step.id, label: step.label, chainId: recipe.chainId }
    if (step.isPermit) {
      const data =
        step.permitData && 'getPermitData' in step.permitData ? await step.permitData.getPermitData() : step.permitData
      current()
      if (!data) throw preparationError('Permit data is unavailable')
      return { ...base, kind: 'permit', data: structuredClone(data) as TypedDataDefinition }
    }
    const requests = await (async () => {
      if (step.batch) {
        if (!attachment.isSafe || step.batch.chainId !== recipe.chainId)
          throw preparationError('Batch network or wallet changed')
        return step.batch.calls.map((call) => ({ ...call, chainId: recipe.chainId }))
      }
      if (isRawTransactionPreparation(step.prepare)) {
        const raw = structuredClone(step.prepare.transaction)
        if (
          !raw ||
          !step.prepare.validate ||
          raw.from.toLowerCase() !== owner.toLowerCase() ||
          raw.chainId !== recipe.chainId
        )
          throw preparationError('The protected quote changed. Review again.')
        await step.prepare.validate(raw)
        current()
        return [{ chainId: recipe.chainId, to: raw.to, data: raw.data, value: BigInt(raw.value) }]
      }
      const chain = getTransactionPreparationChainId(step.prepare)
      if (chain !== undefined && attachment.canonicalChainId(chain) !== recipe.chainId)
        throw preparationError('The prepared action changed networks')
      const request = getContractTransactionRequest(step.prepare) as
        | {
            to?: Address
            address?: Address
            data?: `0x${string}`
            abi?: Abi
            functionName?: string
            args?: readonly unknown[]
            value?: bigint
          }
        | undefined
      const to = request?.address ?? request?.to
      if (!request || !to || !isAddress(to)) throw preparationError('Prepared transaction is unavailable')
      const data = isHex(request.data)
        ? request.data
        : request.abi && request.functionName
          ? encodeFunctionData({ abi: request.abi, functionName: request.functionName, args: request.args })
          : undefined
      if (!data) throw preparationError('Prepared transaction has no calldata')
      return [{ chainId: recipe.chainId, to, data, value: request.value }]
    })()
    current()
    return attachment.isSafe
      ? { ...base, kind: 'safe-proposal', requests: structuredClone(requests) }
      : { ...base, kind: step.id.includes('approve') ? 'approve' : 'execute', request: structuredClone(requests[0]) }
  }
  return {
    prepared,
    authorize: () => {
      const attachment = current()
      if (state.isSafe !== undefined && attachment.isSafe !== state.isSafe)
        throw preparationError('The reviewed wallet type changed')
      const active = state.active
      const latest = attachment.props.step
      const fingerprint = (value: unknown) =>
        JSON.stringify(value, (_key, value) => (typeof value === 'bigint' ? value.toString() : value))
      if (active?.batch && fingerprint(active.batch) !== fingerprint(latest?.batch))
        throw preparationError('The reviewed Safe calls changed. Close and review again.')
      if (
        isRawTransactionPreparation(active?.prepare) &&
        (!isRawTransactionPreparation(latest?.prepare) ||
          fingerprint(active.prepare.transaction) !== fingerprint(latest.prepare.transaction))
      )
        throw preparationError('The protected quote changed. Close and review again.')
      if (attachment.props.step?.id !== state.active?.id || attachment.props.step?.isEnabled === false)
        throw preparationError('The reviewed action changed. Close and review again.')
    },
    attach: (attachment: TAttachment) => {
      state.attachment = attachment
      notify()
    },
    detach: (id: string) => {
      if (state.attachment?.id === id) {
        state.attachment = undefined
        notify()
      }
    },
    prepareStep,
    afterStep: async (_step: TPreparedStep, outcome: VaultWidgetPlanOutcome) => {
      await applyConfirmed(outcome)
    }
  }
}
/** Attach to the accepted flow; completed flows must not lend their recipe to a new command. */
export function getPreparationBridge(
  service: TTransactionLifecycle,
  owner: Address,
  recipe: TOverlayRecipe,
  commandId: string,
  create: boolean
) {
  const registry = bridges.get(service) ?? new Map()
  bridges.set(service, registry)
  const flow = service.findActiveFlow(owner, recipe.id, recipe.previousIntentIds)
  const key = flow?.id ?? commandId
  const existing = registry.get(key)
  if (existing || !create) return existing
  const bridge = createPreparationBridge(owner, recipe)
  registry.set(key, bridge)
  return bridge
}
