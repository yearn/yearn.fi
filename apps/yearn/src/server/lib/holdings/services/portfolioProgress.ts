import type { THoldingsProgressReporter } from '@/server/lib/holdings/services/debug'
import { updateHoldingsProgress } from '@/server/lib/holdings/services/progress'

export type THoldingsPortfolioProgressLane = 'balance' | 'growth'

export type THoldingsPortfolioProgressLanes = Record<
  THoldingsPortfolioProgressLane,
  {
    progress: number
  }
>

export type THoldingsPortfolioProgressSnapshot = {
  progress: number
  message: string
  detail: null
}

const INITIAL_PROGRESS = 8
const MAX_PENDING_PROGRESS = 98
const BALANCE_WEIGHT = 40
const GROWTH_WEIGHT = 60

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round(progress)))
}

function getPortfolioProgressStage(lane: THoldingsPortfolioProgressLane, progress: number): string {
  if (progress <= INITIAL_PROGRESS) {
    return 'Checking saved portfolio history'
  }

  if (lane === 'balance') {
    if (progress < 36) return 'Loading wallet activity'
    if (progress < 62) return 'Preparing vault history'
    if (progress < 76) return 'Fetching historical prices'
    if (progress < 88) return 'Calculating balance and Growth'
    if (progress < 96) return 'Building portfolio charts'
    return 'Saving and finalizing portfolio history'
  }

  if (progress < 30) return 'Loading wallet activity'
  if (progress < 52) return 'Preparing vault history'
  if (progress < 72) return 'Fetching historical prices'
  if (progress < 82) return 'Calculating balance and Growth'
  if (progress < 92) return 'Building portfolio charts'
  return 'Saving and finalizing portfolio history'
}

function getActivePortfolioProgressLane(lanes: THoldingsPortfolioProgressLanes): THoldingsPortfolioProgressLane {
  const balanceRemaining = (100 - lanes.balance.progress) * BALANCE_WEIGHT
  const growthRemaining = (100 - lanes.growth.progress) * GROWTH_WEIGHT
  return growthRemaining >= balanceRemaining ? 'growth' : 'balance'
}

function getPortfolioProgressStageMinimum(message: string): number {
  if (message === 'Loading wallet activity') return 15
  if (message === 'Preparing vault history') return 30
  if (message === 'Fetching historical prices') return 45
  if (message === 'Calculating balance and Growth') return 80
  if (message === 'Building portfolio charts') return 90
  if (message === 'Saving and finalizing portfolio history') return 95
  return INITIAL_PROGRESS
}

export function resolveHoldingsPortfolioProgress(
  lanes: THoldingsPortfolioProgressLanes
): THoldingsPortfolioProgressSnapshot {
  const activeLane = getActivePortfolioProgressLane(lanes)
  const weightedProgress = Math.round(
    (lanes.balance.progress * BALANCE_WEIGHT + lanes.growth.progress * GROWTH_WEIGHT) / 100
  )
  const message =
    lanes.balance.progress >= 100 && lanes.growth.progress >= 100
      ? 'Saving and finalizing portfolio history'
      : getPortfolioProgressStage(activeLane, lanes[activeLane].progress)

  return {
    progress: Math.min(MAX_PENDING_PROGRESS, Math.max(weightedProgress, getPortfolioProgressStageMinimum(message))),
    message,
    detail: null
  }
}

export function createHoldingsPortfolioProgressTracker(progressId: string | null) {
  const lanes: THoldingsPortfolioProgressLanes = {
    balance: { progress: INITIAL_PROGRESS },
    growth: { progress: INITIAL_PROGRESS }
  }
  const state: {
    isTerminal: boolean
    lastSignature: string | null
    pendingWrite: Promise<void>
  } = {
    isTerminal: false,
    lastSignature: null,
    pendingWrite: Promise.resolve()
  }

  const publish = (): void => {
    if (!progressId || state.isTerminal) {
      return
    }

    const snapshot = resolveHoldingsPortfolioProgress(lanes)
    const signature = `${snapshot.progress}:${snapshot.message}:${snapshot.detail}`
    if (signature === state.lastSignature) {
      return
    }

    state.lastSignature = signature
    state.pendingWrite = state.pendingWrite
      .then(() => updateHoldingsProgress(progressId, snapshot))
      .catch(() => undefined)
  }

  const reportLane =
    (lane: THoldingsPortfolioProgressLane): THoldingsProgressReporter =>
    (progress): void => {
      if (state.isTerminal) {
        return
      }

      const nextProgress = clampProgress(progress)
      if (nextProgress <= lanes[lane].progress) {
        return
      }

      lanes[lane].progress = nextProgress
      publish()
    }

  const markLaneComplete = (lane: THoldingsPortfolioProgressLane): void => {
    reportLane(lane)(100, `${lane} ready`)
  }

  const finish = async (): Promise<void> => {
    if (!state.isTerminal) {
      lanes.balance.progress = 100
      lanes.growth.progress = 100
      publish()
      state.isTerminal = true
    }
    await state.pendingWrite
  }

  const abort = async (): Promise<void> => {
    state.isTerminal = true
    await state.pendingWrite
  }

  return {
    reportBalanceProgress: reportLane('balance'),
    reportGrowthProgress: reportLane('growth'),
    markBalanceComplete: (): void => markLaneComplete('balance'),
    markGrowthComplete: (): void => markLaneComplete('growth'),
    finish,
    abort,
    getSnapshot: (): THoldingsPortfolioProgressSnapshot => resolveHoldingsPortfolioProgress(lanes)
  }
}
