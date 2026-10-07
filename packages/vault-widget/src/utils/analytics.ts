import type { VaultWidgetAnalyticsProperties, VaultWidgetAnalyticsRuntime } from '@yearn/vault-widget/runtime'

export type TWidgetAnalyticsContext = {
  action: string
  route: string
  source_chain: number
  destination_chain: number
  withdrawal_source?: string
  batch_capability: string
  batch_reason: string
  approval_required: boolean
}
type TAttempt = {
  props: VaultWidgetAnalyticsProperties
  started: number
  phase: string
  lastOutcome: string
  outcomes: Set<string>
}
type TFlow = {
  props: VaultWidgetAnalyticsProperties
  started: number
  track: VaultWidgetAnalyticsRuntime['track']
  stepAttempts: Map<string, number>
  retries: number
  batchUsed: boolean
  finished: boolean
  active?: TAttempt
}

function duration(start: number): string {
  const elapsed = performance.now() - start
  if (elapsed < 1000) return '<1s'
  if (elapsed < 3000) return '1-3s'
  if (elapsed < 10000) return '3-10s'
  if (elapsed < 30000) return '10-30s'
  if (elapsed < 60000) return '30-60s'
  return '60s+'
}

export function widgetErrorCategory(error: unknown, depth = 0): string {
  if (!error || typeof error !== 'object' || depth > 5) return 'unknown'
  const { code, name, message, cause } = error as { code?: number; name?: string; message?: string; cause?: unknown }
  if (code === 4001 || code === 5000 || /UserRejected|rejected|denied/i.test(`${name} ${message}`)) return 'rejected'
  if (code === 5750) return 'upgrade_rejected'
  if (code === 5700 || code === 5760) return 'unsupported_capability'
  if (code === 5710 || code === 4902) return 'unsupported_chain'
  if (code === -32002) return 'request_pending'
  if (/insufficient funds/i.test(message ?? '')) return 'insufficient_funds'
  if (/revert/i.test(`${name} ${message}`)) return 'reverted'
  if (/timeout/i.test(`${name} ${message}`)) return 'timeout'
  return cause ? widgetErrorCategory(cause, depth + 1) : 'unknown'
}

export function getBatchReason({
  approvalRequired,
  capability,
  hasBatch
}: {
  approvalRequired: boolean
  capability: string
  hasBatch: boolean
}): string {
  if (!approvalRequired) return 'approval_not_needed'
  if (hasBatch) return 'eligible'
  if (capability === 'error') return 'capability_error'
  if (capability === 'pending' || capability === 'unknown') return 'capability_unknown'
  if (capability === 'unsupported') return 'wallet_unsupported'
  return 'route_or_preparation_unavailable'
}

// Tokens remain local. Reporting never changes execution state and never includes call data or hashes.
export function createWidgetAnalytics(getTrack: () => VaultWidgetAnalyticsRuntime['track']) {
  const state: { flow?: TFlow } = {}
  const emit = (event: string, props: VaultWidgetAnalyticsProperties) => {
    try {
      state.flow?.track(event, props)
    } catch {
      /* A tracking failure must not affect a transaction. */
    }
  }
  const summary = (): VaultWidgetAnalyticsProperties => {
    const flow = state.flow
    return flow
      ? { ...flow.props, retry_count: flow.retries, step_count: flow.stepAttempts.size, batch_used: flow.batchUsed }
      : {}
  }
  const result = (attempt: TAttempt | undefined, outcome: string, errorCategory = 'none') => {
    const flow = state.flow
    if (!flow || flow.finished || !attempt || flow.active !== attempt || attempt.outcomes.has(outcome)) return
    // A confirmed receipt cannot become a failed transaction due to a subsequent UI refresh error.
    if (
      attempt.outcomes.has('confirmed') ||
      attempt.outcomes.has('signed') ||
      attempt.outcomes.has('error') ||
      attempt.outcomes.has('rejected')
    )
      return
    attempt.outcomes.add(outcome)
    attempt.lastOutcome = outcome
    if (outcome === 'confirmed') flow.props.completion_stage = 'source_confirmation'
    emit('widget_step_result', {
      ...attempt.props,
      outcome,
      stage: attempt.phase,
      error_category: errorCategory,
      duration_bucket: duration(attempt.started)
    })
    if (outcome === 'submitted') attempt.phase = 'confirmation'
  }
  const complete = (attempt: TAttempt | undefined, outcome: string, stage = 'execution') => {
    const flow = state.flow
    if (!flow || flow.finished || !attempt || flow.active !== attempt) return
    flow.finished = true
    flow.props.completion_stage = stage
    emit('widget_flow_result', {
      ...summary(),
      outcome,
      completion_stage: stage,
      duration_bucket: duration(flow.started)
    })
  }
  return {
    open(context?: TWidgetAnalyticsContext) {
      if (!context || state.flow) return
      state.flow = {
        props: { ...context },
        started: performance.now(),
        track: getTrack(),
        stepAttempts: new Map(),
        retries: 0,
        batchUsed: false,
        finished: false
      }
      emit('widget_flow_started', state.flow.props)
    },
    start(step: string, props: VaultWidgetAnalyticsProperties) {
      const flow = state.flow
      if (!flow || flow.finished) return undefined
      flow.props.execution_mode = props.execution_mode
      if (flow.stepAttempts.size === 0) {
        flow.props.batch_reason = props.batch_reason ?? flow.props.batch_reason
        flow.props.batch_capability = props.batch_capability ?? flow.props.batch_capability
      }
      const number = (flow.stepAttempts.get(step) ?? 0) + 1
      flow.stepAttempts.set(step, number)
      if (number > 1) flow.retries += 1
      flow.batchUsed ||= props.execution_mode === 'atomic_batch' || props.execution_mode === 'safe_batch'
      const attempt: TAttempt = {
        props: { ...flow.props, ...props, step, attempt_number: number },
        started: performance.now(),
        phase: 'wallet_request',
        lastOutcome: 'started',
        outcomes: new Set()
      }
      flow.active = attempt
      emit('widget_step_started', attempt.props)
      return attempt
    },
    phase(attempt: TAttempt | undefined, phase: string) {
      if (attempt) attempt.phase = phase
    },
    result,
    complete,
    summary,
    active: () => state.flow?.active,
    close() {
      const flow = state.flow
      if (!flow) return
      if (!flow.finished) {
        const outcome = flow.active?.lastOutcome
        const terminal =
          outcome === 'error' || outcome === 'rejected'
            ? outcome
            : outcome === 'submitted' ||
                outcome === 'confirmed' ||
                outcome === 'unknown' ||
                outcome === 'awaiting_execution'
              ? 'pending_or_unknown'
              : 'closed'
        if (flow.active) complete(flow.active, terminal)
        else
          emit('widget_flow_result', {
            ...summary(),
            outcome: 'closed_before_request',
            duration_bucket: duration(flow.started)
          })
      }
      state.flow = undefined
    }
  }
}
